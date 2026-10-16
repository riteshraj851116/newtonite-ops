import { prisma } from '../config/db.js';
import { getUserTeamRole } from '../middleware/rbac.js';
import { executeTransition } from '../services/workflowService.js';
import { queueOutboxJob } from '../services/outboxService.js';

// @desc    Get paginated, filtered, sorted work items scoped to authorized teams
// @route   GET /api/items
// @access  Private
export const getItems = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      status,
      priority,
      type,
      teamId,
      assigneeId,
      search,
      awaitingMyApproval,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Resource-level scoping: user can only query teams they belong to
    const myTeamIds = req.user.memberships.map((m) => m.teamId);

    if (myTeamIds.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        page: pageNum,
        pages: 0,
        items: [],
      });
    }

    const where = {
      teamId: { in: myTeamIds },
    };

    // Filter by specific team if provided (must be in authorized teams)
    if (teamId) {
      if (!myTeamIds.includes(teamId)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not belong to the requested team.',
        });
      }
      where.teamId = teamId;
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;

    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        where.assigneeId = null;
      } else if (assigneeId === 'me') {
        where.assigneeId = req.user.id;
      } else {
        where.assigneeId = assigneeId;
      }
    }

    // Awaiting my approval filter: status is Awaiting_Approval in teams where user is Lead or Admin
    if (awaitingMyApproval === 'true') {
      const leadTeamIds = req.user.memberships
        .filter((m) => m.role === 'Lead' || m.role === 'Admin')
        .map((m) => m.teamId);
      where.teamId = { in: leadTeamIds };
      where.status = 'Awaiting_Approval';
    }

    // Server-side text search on title or description
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Validate sort field
    const allowedSortFields = ['updatedAt', 'createdAt', 'priority', 'status', 'title', 'dueDate'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      prisma.workItem.findMany({
        where,
        include: {
          team: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [sortField]: sortDirection },
        skip,
        take: limitNum,
      }),
      prisma.workItem.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
      items,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single work item by ID
// @route   GET /api/items/:id
// @access  Private
export const getItemById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await prisma.workItem.findUnique({
      where: { id },
      include: {
        team: true,
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Work item not found.',
      });
    }

    // Check resource-level authorization
    const role = getUserTeamRole(req.user, item.teamId);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view items for this team.',
      });
    }

    return res.status(200).json({
      success: true,
      item,
      userRole: role,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new work item (Idempotency protected)
// @route   POST /api/items
// @access  Private
export const createItem = async (req, res, next) => {
  try {
    const { title, description, type, priority, teamId, assigneeId, dueDate } = req.body;

    const role = getUserTeamRole(req.user, teamId);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not belong to the designated team.',
      });
    }

    if (role === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Viewers cannot create work items.',
      });
    }

    // Transactional write: WorkItem + ActivityEvent + OutboxJob
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.workItem.create({
        data: {
          title,
          description,
          type: type || 'Task',
          priority: priority || 'Medium',
          status: 'Open',
          teamId,
          assigneeId: assigneeId || null,
          createdById: req.user.id,
          dueDate: dueDate ? new Date(dueDate) : null,
          version: 1,
        },
        include: {
          team: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Record ActivityEvent
      await tx.activityEvent.create({
        data: {
          workItemId: created.id,
          actorId: req.user.id,
          eventType: 'CREATED',
          details: {
            title: created.title,
            type: created.type,
            priority: created.priority,
            assigneeId: created.assigneeId,
          },
        },
      });

      // Transactional Outbox Job if assigned
      if (created.assigneeId && created.assignee) {
        await queueOutboxJob(tx, 'ASSIGNMENT_NOTIFICATION', {
          workItemId: created.id,
          title: created.title,
          assigneeId: created.assigneeId,
          assigneeName: created.assignee.name,
          actorName: req.user.name,
        });
      }

      return created;
    });

    return res.status(201).json({
      success: true,
      item,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update work item with Optimistic Locking
// @route   PATCH /api/items/:id
// @access  Private
export const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, type, priority, assigneeId, dueDate, version } = req.body;

    const currentItem = await prisma.workItem.findUnique({
      where: { id },
      include: { assignee: true },
    });

    if (!currentItem) {
      return res.status(404).json({
        success: false,
        message: 'Work item not found.',
      });
    }

    const role = getUserTeamRole(req.user, currentItem.teamId);
    if (!role || role === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to modify this work item.',
      });
    }

    // Critical Requirement B: Optimistic Locking version check
    if (currentItem.version !== version) {
      return res.status(409).json({
        success: false,
        message: `Conflict: This work item has been modified by another user. You sent v${version}, but current server version is v${currentItem.version}.`,
        conflictType: 'STALE_UPDATE',
        submittedVersion: version,
        currentVersion: currentItem.version,
        currentItem,
      });
    }

    const updateData = {};
    const changes = {};

    if (title !== undefined && title !== currentItem.title) {
      updateData.title = title;
      changes.title = { from: currentItem.title, to: title };
    }
    if (description !== undefined && description !== currentItem.description) {
      updateData.description = description;
      changes.description = { from: 'Updated', to: 'Updated' };
    }
    if (type !== undefined && type !== currentItem.type) {
      updateData.type = type;
      changes.type = { from: currentItem.type, to: type };
    }
    if (priority !== undefined && priority !== currentItem.priority) {
      updateData.priority = priority;
      changes.priority = { from: currentItem.priority, to: priority };
    }
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
      changes.dueDate = { from: currentItem.dueDate, to: updateData.dueDate };
    }
    if (assigneeId !== undefined) {
      updateData.assigneeId = assigneeId || null;
      changes.assigneeId = { from: currentItem.assigneeId, to: updateData.assigneeId };
    }

    // Atomic update with version match and increment
    const updated = await prisma.$transaction(async (tx) => {
      const itemUpdate = await tx.workItem.update({
        where: {
          id,
          version, // Optimistic lock condition
        },
        data: {
          ...updateData,
          version: { increment: 1 },
        },
        include: {
          team: true,
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Activity Event in transaction
      if (Object.keys(changes).length > 0) {
        await tx.activityEvent.create({
          data: {
            workItemId: id,
            actorId: req.user.id,
            eventType: changes.assigneeId ? 'ASSIGNED' : changes.priority ? 'PRIORITY_CHANGED' : 'FIELD_UPDATED',
            details: { changes },
          },
        });
      }

      // Outbox job if assignee changed
      if (changes.assigneeId && itemUpdate.assignee) {
        await queueOutboxJob(tx, 'ASSIGNMENT_NOTIFICATION', {
          workItemId: id,
          title: itemUpdate.title,
          assigneeId: itemUpdate.assigneeId,
          assigneeName: itemUpdate.assignee.name,
          actorName: req.user.name,
        });
      }

      return itemUpdate;
    });

    return res.status(200).json({
      success: true,
      item: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Claim an unassigned work item (Critical Requirement A: Concurrent Claim)
// @route   POST /api/items/:id/claim
// @access  Private
export const claimItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await prisma.workItem.findUnique({
      where: { id },
      include: { assignee: true },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Work item not found.',
      });
    }

    const role = getUserTeamRole(req.user, item.teamId);
    if (!role || role === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot claim items for this team.',
      });
    }

    // Critical Requirement A: Atomic conditional update
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.workItem.updateMany({
        where: {
          id,
          assigneeId: null, // Only match if currently unassigned
        },
        data: {
          assigneeId: req.user.id,
          status: item.status === 'Open' ? 'In_Progress' : item.status,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        // Lost race condition: someone else claimed it first!
        const current = await tx.workItem.findUnique({
          where: { id },
          include: { assignee: { select: { id: true, name: true, email: true } } },
        });

        const error = new Error('Conflict: This work item has already been assigned or claimed by another user.');
        error.statusCode = 409;
        error.conflictType = 'CONCURRENT_CLAIM';
        error.currentAssignee = current.assignee;
        error.currentVersion = current.version;
        throw error;
      }

      const updated = await tx.workItem.findUnique({
        where: { id },
        include: {
          team: true,
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Transactional ActivityEvent
      await tx.activityEvent.create({
        data: {
          workItemId: id,
          actorId: req.user.id,
          eventType: 'ASSIGNED',
          details: {
            previousAssigneeId: null,
            newAssigneeId: req.user.id,
            newAssigneeName: req.user.name,
            note: `${req.user.name} claimed this work item.`,
          },
        },
      });

      // Transactional Outbox Job
      await queueOutboxJob(tx, 'ASSIGNMENT_NOTIFICATION', {
        workItemId: id,
        title: updated.title,
        assigneeId: req.user.id,
        assigneeName: req.user.name,
        actorName: req.user.name,
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: 'Work item successfully claimed.',
      item: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Perform workflow transition (Workflow Engine)
// @route   POST /api/items/:id/transition
// @access  Private
export const transitionItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, version, note } = req.body;

    const updated = await executeTransition({
      itemId: id,
      targetStatus: status,
      expectedVersion: version,
      user: req.user,
      note,
    });

    return res.status(200).json({
      success: true,
      message: `Status successfully updated to ${status.replace('_', ' ')}.`,
      item: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity timeline for work item
// @route   GET /api/items/:id/activity
// @access  Private
export const getActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await prisma.workItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Work item not found.' });
    }

    const role = getUserTeamRole(req.user, item.teamId);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const events = await prisma.activityEvent.findMany({
      where: { workItemId: id },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { timestamp: 'desc' },
    });

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comments for work item
// @route   GET /api/items/:id/comments
// @access  Private
export const getComments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const item = await prisma.workItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Work item not found.' });
    }

    const role = getUserTeamRole(req.user, item.teamId);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const comments = await prisma.comment.findMany({
      where: { workItemId: id },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to work item
// @route   POST /api/items/:id/comments
// @access  Private
export const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const item = await prisma.workItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Work item not found.' });
    }

    const role = getUserTeamRole(req.user, item.teamId);
    if (!role || role === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Viewers cannot post comments.',
      });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const createdComment = await tx.comment.create({
        data: {
          workItemId: id,
          authorId: req.user.id,
          content: content.trim(),
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });

      // Record ActivityEvent
      await tx.activityEvent.create({
        data: {
          workItemId: id,
          actorId: req.user.id,
          eventType: 'COMMENT_ADDED',
          details: {
            commentId: createdComment.id,
            snippet: content.trim().substring(0, 100),
          },
        },
      });

      return createdComment;
    });

    return res.status(201).json({
      success: true,
      comment,
    });
  } catch (error) {
    next(error);
  }
};
