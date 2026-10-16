import { prisma } from '../config/db.js';
import { getUserTeamRole } from '../middleware/rbac.js';

export const ALLOWED_TRANSITIONS = {
  Open: ['In_Progress'],
  In_Progress: ['Awaiting_Approval', 'Open'],
  Awaiting_Approval: ['Resolved', 'In_Progress'],
  Resolved: ['Closed', 'Open'],
  Closed: ['Open'],
};

/**
 * Validates a status transition against the workflow rules and team role permissions.
 * @param {object} params
 * @param {string} params.currentStatus
 * @param {string} params.targetStatus
 * @param {object} params.user
 * @param {object} params.item
 * @returns {{ allowed: boolean, reason?: string }}
 */
export const validateTransition = ({ currentStatus, targetStatus, user, item }) => {
  if (currentStatus === targetStatus) {
    return { allowed: true };
  }

  const validTargets = ALLOWED_TRANSITIONS[currentStatus];
  if (!validTargets || !validTargets.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Invalid workflow transition from "${currentStatus.replace('_', ' ')}" to "${targetStatus.replace('_', ' ')}". Allowed transitions: ${validTargets ? validTargets.map((s) => s.replace('_', ' ')).join(', ') : 'None'}.`,
    };
  }

  // Get user's role in the item's team
  const role = getUserTeamRole(user, item.teamId);
  if (!role) {
    return {
      allowed: false,
      reason: 'Forbidden: You do not belong to the team that owns this work item.',
    };
  }

  // Viewers cannot change any workflow status
  if (role === 'Viewer') {
    return {
      allowed: false,
      reason: 'Forbidden: Viewers have read-only access and cannot perform workflow actions.',
    };
  }

  // APPROVAL RULE: Only Lead or Admin of the item's team can approve an item into 'Resolved'
  if (currentStatus === 'Awaiting_Approval' && targetStatus === 'Resolved') {
    if (role !== 'Lead' && role !== 'Admin') {
      return {
        allowed: false,
        reason: 'Approval Required: Only an authorized Team Lead or Admin can approve this item into Resolved state.',
      };
    }
  }

  // Re-opening closed items requires Lead or Admin
  if (currentStatus === 'Closed' && targetStatus === 'Open') {
    if (role !== 'Lead' && role !== 'Admin') {
      return {
        allowed: false,
        reason: 'Only a Team Lead or Admin can reopen a permanently closed work item.',
      };
    }
  }

  return { allowed: true };
};

/**
 * Executes a state transition atomically inside a database transaction,
 * updating the item version, recording the ActivityEvent, and queuing an outbox job.
 */
export const executeTransition = async ({
  itemId,
  targetStatus,
  expectedVersion,
  user,
  note = null,
}) => {
  const item = await prisma.workItem.findUnique({
    where: { id: itemId },
    include: {
      team: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  if (!item) {
    const error = new Error('Work item not found');
    error.statusCode = 404;
    throw error;
  }

  // Check version for Optimistic Locking
  if (item.version !== expectedVersion) {
    const error = new Error(
      `Conflict: Stale update rejected. You submitted revision v${expectedVersion}, but the server is at v${item.version}.`
    );
    error.statusCode = 409;
    error.conflictType = 'STALE_UPDATE';
    error.currentVersion = item.version;
    error.currentItem = item;
    throw error;
  }

  // Validate state machine and team role permissions
  const validation = validateTransition({
    currentStatus: item.status,
    targetStatus,
    user,
    item,
  });

  if (!validation.allowed) {
    const error = new Error(validation.reason);
    error.statusCode = 403;
    throw error;
  }

  // Atomic database transaction:
  // 1. Update WorkItem (matching id and expected version)
  // 2. Append ActivityEvent
  // 3. Insert OutboxJob (Transactional Outbox Pattern)
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.workItem.update({
      where: {
        id: itemId,
        version: expectedVersion,
      },
      data: {
        status: targetStatus,
        version: { increment: 1 },
      },
      include: {
        team: true,
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    const event = await tx.activityEvent.create({
      data: {
        workItemId: itemId,
        actorId: user.id,
        eventType: 'STATUS_CHANGED',
        details: {
          previousStatus: item.status,
          newStatus: targetStatus,
          note: note || undefined,
        },
      },
    });

    // Create Outbox job if important milestone
    if (targetStatus === 'Awaiting_Approval' || targetStatus === 'Resolved') {
      await tx.outboxJob.create({
        data: {
          jobType: 'STATUS_CHANGE_NOTIFICATION',
          payload: {
            workItemId: itemId,
            title: updated.title,
            previousStatus: item.status,
            newStatus: targetStatus,
            actorId: user.id,
            actorName: user.name,
            teamId: item.teamId,
          },
        },
      });
    }

    return { updated, event };
  });

  return result.updated;
};
