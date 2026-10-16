import { prisma } from '../config/db.js';
import { getUserTeamRole } from '../middleware/rbac.js';

// @desc    Get all teams accessible by current user
// @route   GET /api/teams
// @access  Private
export const getTeams = async (req, res, next) => {
  try {
    const userTeamIds = req.user.memberships.map((m) => m.teamId);

    const teams = await prisma.team.findMany({
      where: {
        id: { in: userTeamIds },
      },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formattedTeams = teams.map((team) => {
      const myMembership = req.user.memberships.find((m) => m.teamId === team.id);
      return {
        id: team.id,
        name: team.name,
        description: team.description,
        myRole: myMembership ? myMembership.role : null,
        memberCount: team.memberships.length,
        members: team.memberships.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        })),
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedTeams.length,
      teams: formattedTeams,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get team details by ID
// @route   GET /api/teams/:id
// @access  Private
export const getTeamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const myRole = getUserTeamRole(req.user, id);
    if (!myRole) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not belong to this team.',
      });
    }

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { role: 'asc' },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    return res.status(200).json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        myRole,
        members: team.memberships.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        })),
        createdAt: team.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
