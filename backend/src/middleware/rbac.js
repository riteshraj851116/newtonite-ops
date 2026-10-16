import { prisma } from '../config/db.js';

/**
 * Returns the user's role in a given team, or null if not a member.
 */
export const getUserTeamRole = (user, teamId) => {
  if (!user || !user.memberships) return null;
  const membership = user.memberships.find((m) => m.teamId === teamId);
  return membership ? membership.role : null;
};

/**
 * Checks if user is at least one of the specified roles in a team
 */
export const hasTeamRole = (user, teamId, allowedRoles) => {
  const role = getUserTeamRole(user, teamId);
  if (!role) return false;
  return allowedRoles.includes(role);
};

/**
 * Middleware ensuring user has membership in the team
 */
export const requireTeamAccess = (teamIdExtractor) => {
  return (req, res, next) => {
    const teamId = teamIdExtractor(req);
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'Team identifier is required for access verification.',
      });
    }

    const role = getUserTeamRole(req.user, teamId);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not belong to this team and cannot access its resources.',
      });
    }

    req.teamRole = role;
    next();
  };
};

/**
 * Middleware requiring specific roles within the target team
 */
export const requireRoleInTeam = (teamIdExtractor, allowedRoles = []) => {
  return (req, res, next) => {
    const teamId = teamIdExtractor(req);
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'Team identifier is required.',
      });
    }

    const role = getUserTeamRole(req.user, teamId);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Access to this team resource is not permitted.',
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${role}' lacks permission for this action. Required: ${allowedRoles.join(', ')}.`,
      });
    }

    req.teamRole = role;
    next();
  };
};
