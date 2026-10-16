const Team = require('../models/Team');

/**
 * Checks whether user can view a given work item
 * Admins: always yes
 * Managers/Employees: must be member/lead of the item's team OR assignee OR creator
 */
const canAccessWorkItem = async (user, workItem) => {
  if (user.role === 'Admin') return true;

  const userIdStr = user._id.toString();

  // If directly assigned or created by user
  if (workItem.assignedTo && workItem.assignedTo.toString() === userIdStr) {
    return true;
  }
  if (workItem.createdBy && workItem.createdBy.toString() === userIdStr) {
    return true;
  }

  // Check team membership
  const team = await Team.findById(workItem.team);
  if (!team) return false;

  const isLead = team.lead && team.lead.toString() === userIdStr;
  const isMember = team.members.some((m) => m.toString() === userIdStr);

  return isLead || isMember;
};

/**
 * Checks whether user can edit general fields of a work item
 * Admins: always
 * Managers: if in item's team
 * Employees: if assigned to them or created by them (limited fields)
 */
const canModifyWorkItem = async (user, workItem) => {
  if (user.role === 'Admin') return true;

  const userIdStr = user._id.toString();
  const team = await Team.findById(workItem.team);
  if (!team) return false;

  const isLead = team.lead && team.lead.toString() === userIdStr;
  if (user.role === 'Manager' && isLead) return true;

  const isAssignee = workItem.assignedTo && workItem.assignedTo.toString() === userIdStr;
  const isCreator = workItem.createdBy && workItem.createdBy.toString() === userIdStr;

  return isAssignee || isCreator;
};

/**
 * Checks whether user can assign or reassign a work item
 * Admins: always
 * Managers: can assign within their teams
 * Employees: can only claim an unassigned item for themselves
 */
const canAssignWorkItem = async (user, workItem, targetAssigneeId) => {
  if (user.role === 'Admin') return true;

  const userIdStr = user._id.toString();
  const team = await Team.findById(workItem.team);
  if (!team) return false;

  const isLead = team.lead && team.lead.toString() === userIdStr;
  if (user.role === 'Manager' && isLead) return true;

  // Employee claiming for themselves
  if (user.role === 'Employee') {
    const isMember = team.members.some((m) => m.toString() === userIdStr);
    const isTargetingSelf = targetAssigneeId && targetAssigneeId.toString() === userIdStr;
    if (isMember && isTargetingSelf) {
      return true;
    }
  }

  return false;
};

module.exports = {
  canAccessWorkItem,
  canModifyWorkItem,
  canAssignWorkItem,
};
