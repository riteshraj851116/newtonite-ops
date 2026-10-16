/**
 * WorkItem Status State Machine
 * Allowed status transitions:
 * - Open: can move to In Progress, Blocked
 * - In Progress: can move to Blocked, Resolved, Open
 * - Blocked: can move to In Progress, Open
 * - Resolved: can move to Open (re-open only by Manager, Admin, or the Creator)
 */

const ALLOWED_TRANSITIONS = {
  Open: ['In Progress', 'Blocked'],
  'In Progress': ['Blocked', 'Resolved', 'Open'],
  Blocked: ['In Progress', 'Open'],
  Resolved: ['Open'],
};

/**
 * Validates whether a status transition is allowed
 * @param {string} currentStatus 
 * @param {string} newStatus 
 * @param {object} user { id, role }
 * @param {string} creatorId 
 * @returns {{ allowed: boolean, reason?: string }}
 */
const validateStatusTransition = (currentStatus, newStatus, user, creatorId) => {
  if (currentStatus === newStatus) {
    return { allowed: true };
  }

  const validTargets = ALLOWED_TRANSITIONS[currentStatus];
  if (!validTargets || !validTargets.includes(newStatus)) {
    return {
      allowed: false,
      reason: `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${validTargets ? validTargets.join(', ') : 'None'}.`,
    };
  }

  // Re-opening a resolved item requires Admin, Manager, or original creator
  if (currentStatus === 'Resolved' && newStatus === 'Open') {
    const isPrivileged = user.role === 'Admin' || user.role === 'Manager';
    const isCreator = user._id.toString() === creatorId.toString();
    if (!isPrivileged && !isCreator) {
      return {
        allowed: false,
        reason: 'Only Managers, Admins, or the original creator can reopen a resolved work item.',
      };
    }
  }

  return { allowed: true };
};

module.exports = {
  ALLOWED_TRANSITIONS,
  validateStatusTransition,
};
