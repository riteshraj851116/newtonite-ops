const ActivityLog = require('../models/ActivityLog');

/**
 * Log an activity event for a work item
 * @param {object} params
 * @param {string} params.workItemId
 * @param {string} params.userId
 * @param {string} params.action - 'CREATED'|'UPDATED'|'STATUS_CHANGED'|'ASSIGNED'|'UNASSIGNED'|'RESOLVED'|'COMMENT_ADDED'
 * @param {object} params.details - { previousStatus, newStatus, previousAssignee, newAssignee, changes, comment }
 * @param {object} [params.session] - optional mongoose session for transaction support
 */
const logActivity = async ({ workItemId, userId, action, details = {}, session = null }) => {
  try {
    const logDoc = new ActivityLog({
      workItem: workItemId,
      user: userId,
      action,
      details,
      timestamp: new Date(),
    });

    if (session) {
      await logDoc.save({ session });
    } else {
      await logDoc.save();
    }
    return logDoc;
  } catch (error) {
    // Activity logging should not fail the primary business operation if outside transaction
    console.error(`[ActivityLogger Error] Failed to log activity ${action} for item ${workItemId}:`, error.message);
    return null;
  }
};

module.exports = { logActivity };
