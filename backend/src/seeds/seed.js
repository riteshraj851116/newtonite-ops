import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma, initDatabase, stopDatabase } from '../config/db.js';

const seedDatabase = async () => {
  console.log('[Seed] Connecting to PostgreSQL database...');
  await initDatabase();

  console.log('[Seed] Clearing existing tables...');
  await prisma.$transaction([
    prisma.comment.deleteMany(),
    prisma.activityEvent.deleteMany(),
    prisma.outboxJob.deleteMany(),
    prisma.idempotencyKey.deleteMany(),
    prisma.workItem.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.team.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log('[Seed] Generating password hashes...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  console.log('[Seed] Creating demo users...');
  const usersData = [
    { email: 'admin@newtonite.io', name: 'Elena Rostova (Global Admin)' },
    { email: 'lead.infra@newtonite.io', name: 'Marcus Vance (Infra Lead)' },
    { email: 'lead.qa@newtonite.io', name: 'Sarah Chen (SecOps Lead)' },
    { email: 'lead.core@newtonite.io', name: 'David Kim (Payments Lead)' },
    { email: 'member.alex@newtonite.io', name: 'Alex Rivera (Staff Engineer)' },
    { email: 'member.priya@newtonite.io', name: 'Priya Sharma (Backend Engineer)' },
    { email: 'member.leo@newtonite.io', name: 'Leo Morales (QA Automation)' },
    { email: 'member.chloe@newtonite.io', name: 'Chloe Bennett (FinTech Dev)' },
    { email: 'viewer.rachel@newtonite.io', name: 'Rachel Green (Product Analyst)' },
    { email: 'viewer.tom@newtonite.io', name: 'Tom Hanson (Compliance Auditor)' },
  ];

  const createdUsers = {};
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: passwordHash,
      },
    });
    createdUsers[u.email] = user;
  }

  console.log('[Seed] Creating operational teams...');
  const teamsData = [
    {
      name: 'Platform Infrastructure & Cloud',
      description: 'Distributed cloud infrastructure, kubernetes ingress, database clusters, and reliability engineering.',
    },
    {
      name: 'Quality Assurance & SecOps',
      description: 'Penetration testing, compliance controls, automated regression pipelines, and vulnerability response.',
    },
    {
      name: 'Core Payments & Billing Engine',
      description: 'Payment gateway integrations, invoice ledger reconciliation, proration, and subscription lifecycles.',
    },
  ];

  const createdTeams = {};
  for (const t of teamsData) {
    const team = await prisma.team.create({ data: t });
    createdTeams[t.name] = team;
  }

  const teamInfra = createdTeams['Platform Infrastructure & Cloud'];
  const teamQA = createdTeams['Quality Assurance & SecOps'];
  const teamPayments = createdTeams['Core Payments & Billing Engine'];

  console.log('[Seed] Assigning team-scoped memberships...');
  const memberships = [
    // Team 1: Infrastructure
    { userId: createdUsers['admin@newtonite.io'].id, teamId: teamInfra.id, role: 'Admin' },
    { userId: createdUsers['lead.infra@newtonite.io'].id, teamId: teamInfra.id, role: 'Lead' },
    { userId: createdUsers['member.alex@newtonite.io'].id, teamId: teamInfra.id, role: 'Member' },
    { userId: createdUsers['member.priya@newtonite.io'].id, teamId: teamInfra.id, role: 'Member' },
    { userId: createdUsers['viewer.rachel@newtonite.io'].id, teamId: teamInfra.id, role: 'Viewer' },

    // Team 2: Quality & SecOps
    { userId: createdUsers['admin@newtonite.io'].id, teamId: teamQA.id, role: 'Admin' },
    { userId: createdUsers['lead.qa@newtonite.io'].id, teamId: teamQA.id, role: 'Lead' },
    { userId: createdUsers['member.alex@newtonite.io'].id, teamId: teamQA.id, role: 'Member' },
    { userId: createdUsers['member.leo@newtonite.io'].id, teamId: teamQA.id, role: 'Member' },
    { userId: createdUsers['viewer.tom@newtonite.io'].id, teamId: teamQA.id, role: 'Viewer' },

    // Team 3: Payments & Billing
    { userId: createdUsers['admin@newtonite.io'].id, teamId: teamPayments.id, role: 'Admin' },
    { userId: createdUsers['lead.core@newtonite.io'].id, teamId: teamPayments.id, role: 'Lead' },
    { userId: createdUsers['member.priya@newtonite.io'].id, teamId: teamPayments.id, role: 'Member' },
    { userId: createdUsers['member.chloe@newtonite.io'].id, teamId: teamPayments.id, role: 'Member' },
    { userId: createdUsers['viewer.tom@newtonite.io'].id, teamId: teamPayments.id, role: 'Viewer' },
  ];

  await prisma.membership.createMany({ data: memberships });

  console.log('[Seed] Creating curated work items with rich activity history...');

  // 1. Critical Incident in Progress
  const item1 = await prisma.workItem.create({
    data: {
      title: 'Mitigate Redis Cache Exhaustion in Prod US-East-1',
      description: 'Cluster memory usage reached 96% threshold under peak checkout traffic. Adjust eviction keyspace and bump maxmemory policy.',
      type: 'Incident',
      priority: 'Urgent',
      status: 'In_Progress',
      teamId: teamInfra.id,
      assigneeId: createdUsers['member.alex@newtonite.io'].id,
      createdById: createdUsers['lead.infra@newtonite.io'].id,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      version: 2,
    },
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        workItemId: item1.id,
        actorId: createdUsers['lead.infra@newtonite.io'].id,
        eventType: 'CREATED',
        details: { status: 'Open', priority: 'Urgent' },
        timestamp: new Date(Date.now() - 48 * 3600 * 1000),
      },
      {
        workItemId: item1.id,
        actorId: createdUsers['member.alex@newtonite.io'].id,
        eventType: 'ASSIGNED',
        details: { previousAssigneeId: null, newAssigneeId: createdUsers['member.alex@newtonite.io'].id },
        timestamp: new Date(Date.now() - 36 * 3600 * 1000),
      },
      {
        workItemId: item1.id,
        actorId: createdUsers['member.alex@newtonite.io'].id,
        eventType: 'STATUS_CHANGED',
        details: { previousStatus: 'Open', newStatus: 'In_Progress' },
        timestamp: new Date(Date.now() - 24 * 3600 * 1000),
      },
    ],
  });

  await prisma.comment.create({
    data: {
      workItemId: item1.id,
      authorId: createdUsers['member.alex@newtonite.io'].id,
      content: 'Identified root cause: session token leak on unclosed websockets. Fix committed to staging branch.',
    },
  });

  // 2. Item Awaiting Approval (Demonstrating Lead Approval Workflow)
  const item2 = await prisma.workItem.create({
    data: {
      title: 'Deploy Automated Database Failover Playbook v3',
      description: 'Runbook verified on staging replication replicas. Ready for final Lead signoff before promotion to production.',
      type: 'Task',
      priority: 'High',
      status: 'Awaiting_Approval',
      teamId: teamInfra.id,
      assigneeId: createdUsers['member.priya@newtonite.io'].id,
      createdById: createdUsers['member.priya@newtonite.io'].id,
      dueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      version: 3,
    },
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        workItemId: item2.id,
        actorId: createdUsers['member.priya@newtonite.io'].id,
        eventType: 'CREATED',
        details: { status: 'Open' },
        timestamp: new Date(Date.now() - 72 * 3600 * 1000),
      },
      {
        workItemId: item2.id,
        actorId: createdUsers['member.priya@newtonite.io'].id,
        eventType: 'STATUS_CHANGED',
        details: { previousStatus: 'In_Progress', newStatus: 'Awaiting_Approval' },
        timestamp: new Date(Date.now() - 12 * 3600 * 1000),
      },
    ],
  });

  // 3. Unassigned Urgent Item (Ready for concurrent claim demonstration)
  const item3 = await prisma.workItem.create({
    data: {
      title: 'Investigate Ingress HTTP 502 Rate Spike Under 15k RPS',
      description: 'Edge reverse proxy dropping upstream connections intermittently during autoscaling events. Unassigned and open for claiming.',
      type: 'Incident',
      priority: 'Urgent',
      status: 'Open',
      teamId: teamInfra.id,
      assigneeId: null, // Unassigned!
      createdById: createdUsers['lead.infra@newtonite.io'].id,
      dueDate: new Date(Date.now() + 12 * 3600 * 1000),
      version: 1,
    },
  });

  // 4. Payment Gateway Reconciliation Task
  const item4 = await prisma.workItem.create({
    data: {
      title: 'Reconcile Stripe Webhook Idempotency Token Failures',
      description: 'Webhook delivery payload retry queue reported signature verification timeouts on multi-threaded ledger updates.',
      type: 'Payment',
      priority: 'High',
      status: 'In_Progress',
      teamId: teamPayments.id,
      assigneeId: createdUsers['member.chloe@newtonite.io'].id,
      createdById: createdUsers['lead.core@newtonite.io'].id,
      dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      version: 2,
    },
  });

  // 5. Compliance Audit Resolved Item
  const item5 = await prisma.workItem.create({
    data: {
      title: 'SOC2 Type II Access Review Evidence Collection',
      description: 'Gathered automated audit logs and verified MFA enforcement across all production jumpboxes.',
      type: 'Compliance',
      priority: 'Medium',
      status: 'Resolved',
      teamId: teamQA.id,
      assigneeId: createdUsers['member.leo@newtonite.io'].id,
      createdById: createdUsers['lead.qa@newtonite.io'].id,
      version: 4,
    },
  });

  console.log('[Seed] Generating bulk work items (~2,100 items) for pagination & filter stress-testing...');
  const types = ['Incident', 'Customer_Issue', 'Payment', 'Compliance', 'Task'];
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];
  const statuses = ['Open', 'In_Progress', 'Awaiting_Approval', 'Resolved', 'Closed'];
  const teamsList = [teamInfra.id, teamQA.id, teamPayments.id];
  const userIds = Object.values(createdUsers).map((u) => u.id);

  const bulkItems = [];
  const TOTAL_BULK = 2100;

  for (let i = 1; i <= TOTAL_BULK; i++) {
    const teamId = teamsList[i % teamsList.length];
    const type = types[i % types.length];
    const priority = priorities[i % priorities.length];
    const status = statuses[i % statuses.length];
    const assigneeId = i % 4 === 0 ? null : userIds[i % userIds.length];
    const createdById = userIds[(i + 1) % userIds.length];

    bulkItems.push({
      title: `OPS-${1000 + i}: ${type} verification task for cluster node #${i % 256}`,
      description: `Automated operations item #${i} to test high-volume database queries, compound indexing, and server-side pagination for ${type}.`,
      type,
      priority,
      status,
      teamId,
      assigneeId,
      createdById,
      dueDate: i % 3 === 0 ? new Date(Date.now() + (i % 30) * 86400000) : null,
      version: 1,
      createdAt: new Date(Date.now() - (i % 90) * 86400000),
      updatedAt: new Date(Date.now() - (i % 10) * 3600000),
    });
  }

  // Insert in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < bulkItems.length; i += chunkSize) {
    const chunk = bulkItems.slice(i, i + chunkSize);
    await prisma.workItem.createMany({ data: chunk });
  }

  const finalCount = await prisma.workItem.count();
  console.log(`[Seed] Successfully created ${finalCount} total work items.`);

  console.log('========================================================================');
  console.log('  Newtonite Ops Database Successfully Seeded!');
  console.log('========================================================================');
  console.log('Demo Login Credentials (all passwords: Password123!):');
  console.log('  1. Global Admin:    admin@newtonite.io         (Admin in Infra, QA, Payments)');
  console.log('  2. Infra Lead:      lead.infra@newtonite.io    (Lead in Platform Infra)');
  console.log('  3. SecOps Lead:     lead.qa@newtonite.io       (Lead in QA & SecOps)');
  console.log('  4. Payments Lead:   lead.core@newtonite.io     (Lead in Payments & Billing)');
  console.log('  5. Staff Engineer:  member.alex@newtonite.io   (Member in Infra & QA)');
  console.log('  6. Backend Dev:     member.priya@newtonite.io  (Member in Infra & Payments)');
  console.log('  7. QA Automation:   member.leo@newtonite.io    (Member in QA & SecOps)');
  console.log('  8. FinTech Dev:     member.chloe@newtonite.io  (Member in Payments)');
  console.log('  9. Analyst/Viewer:  viewer.rachel@newtonite.io (Viewer in Infra)');
  console.log('  10. Auditor/Viewer: viewer.tom@newtonite.io    (Viewer in QA & Payments)');
  console.log('========================================================================');

  await stopDatabase();
  process.exit(0);
};

seedDatabase().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
