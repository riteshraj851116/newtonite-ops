import { prisma } from '../config/db.js';

// @desc    Get dashboard summary counters and metrics
// @route   GET /api/dashboard/summary
// @access  Private
export const getSummary = async (req, res, next) => {
  try {
    const myTeamIds = req.user.memberships.map((m) => m.teamId);

    if (myTeamIds.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          totalOpen: 0,
          inProgress: 0,
          urgentUnassigned: 0,
          awaitingApproval: 0,
          assignedToMe: 0,
          totalItems: 0,
        },
        priorityBreakdown: { Low: 0, Medium: 0, High: 0, Urgent: 0 },
        recentItems: [],
        urgentItems: [],
      });
    }

    // Teams where user is Lead or Admin
    const leadTeamIds = req.user.memberships
      .filter((m) => m.role === 'Lead' || m.role === 'Admin')
      .map((m) => m.teamId);

    const baseWhere = { teamId: { in: myTeamIds } };

    const [
      totalOpen,
      inProgress,
      urgentUnassigned,
      awaitingApproval,
      assignedToMe,
      totalItems,
      priorityCounts,
      recentItems,
      urgentItems,
    ] = await Promise.all([
      // 1. Total Open
      prisma.workItem.count({
        where: { ...baseWhere, status: 'Open' },
      }),
      // 2. In Progress
      prisma.workItem.count({
        where: { ...baseWhere, status: 'In_Progress' },
      }),
      // 3. Urgent Unassigned
      prisma.workItem.count({
        where: {
          ...baseWhere,
          priority: 'Urgent',
          assigneeId: null,
          status: { notIn: ['Resolved', 'Closed'] },
        },
      }),
      // 4. Awaiting Approval (only in teams where user is Lead/Admin)
      leadTeamIds.length > 0
        ? prisma.workItem.count({
            where: {
              teamId: { in: leadTeamIds },
              status: 'Awaiting_Approval',
            },
          })
        : 0,
      // 5. Assigned to Me
      prisma.workItem.count({
        where: {
          ...baseWhere,
          assigneeId: req.user.id,
          status: { notIn: ['Resolved', 'Closed'] },
        },
      }),
      // 6. Total in authorized teams
      prisma.workItem.count({ where: baseWhere }),

      // 7. Group by priority
      prisma.workItem.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { id: true },
      }),

      // 8. Top 5 recently updated items
      prisma.workItem.findMany({
        where: baseWhere,
        include: {
          team: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),

      // 9. Urgent unassigned items preview
      prisma.workItem.findMany({
        where: {
          ...baseWhere,
          priority: 'Urgent',
          assigneeId: null,
          status: { notIn: ['Resolved', 'Closed'] },
        },
        include: {
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const priorityBreakdown = {
      Low: 0,
      Medium: 0,
      High: 0,
      Urgent: 0,
    };
    priorityCounts.forEach((pc) => {
      priorityBreakdown[pc.priority] = pc._count.id;
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalOpen,
        inProgress,
        urgentUnassigned,
        awaitingApproval,
        assignedToMe,
        totalItems,
      },
      priorityBreakdown,
      recentItems,
      urgentItems,
    });
  } catch (error) {
    next(error);
  }
};
