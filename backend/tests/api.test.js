import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { processPendingJobs } from '../src/services/outboxService.js';

describe('Newtonite Ops — Comprehensive Integration Test Suite (15 Scenarios)', () => {
  let adminToken, leadToken, memberAlexToken, viewerRachelToken, viewerTomToken;
  let adminUser, leadInfra, memberAlex, viewerRachel;
  let teamInfra, teamPayments;
  let sampleItem;

  beforeAll(async () => {
    // Fetch seeded users and teams
    adminUser = await prisma.user.findUnique({ where: { email: 'admin@newtonite.io' } });
    leadInfra = await prisma.user.findUnique({ where: { email: 'lead.infra@newtonite.io' } });
    memberAlex = await prisma.user.findUnique({ where: { email: 'member.alex@newtonite.io' } });
    viewerRachel = await prisma.user.findUnique({ where: { email: 'viewer.rachel@newtonite.io' } });
    const viewerTom = await prisma.user.findUnique({ where: { email: 'viewer.tom@newtonite.io' } });

    teamInfra = await prisma.team.findUnique({ where: { name: 'Platform Infrastructure & Cloud' } });
    teamPayments = await prisma.team.findUnique({ where: { name: 'Core Payments & Billing Engine' } });

    // Obtain tokens via actual login endpoint
    const resAdmin = await request(app).post('/api/auth/login').send({
      email: 'admin@newtonite.io',
      password: 'Password123!',
    });
    adminToken = resAdmin.body.token;

    const resLead = await request(app).post('/api/auth/login').send({
      email: 'lead.infra@newtonite.io',
      password: 'Password123!',
    });
    leadToken = resLead.body.token;

    const resAlex = await request(app).post('/api/auth/login').send({
      email: 'member.alex@newtonite.io',
      password: 'Password123!',
    });
    memberAlexToken = resAlex.body.token;

    const resRachel = await request(app).post('/api/auth/login').send({
      email: 'viewer.rachel@newtonite.io',
      password: 'Password123!',
    });
    viewerRachelToken = resRachel.body.token;

    const resTom = await request(app).post('/api/auth/login').send({
      email: 'viewer.tom@newtonite.io',
      password: 'Password123!',
    });
    viewerTomToken = resTom.body.token;
  });

  // TEST 1: Successful login
  it('1. should successfully authenticate seeded credentials and return a signed JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'member.alex@newtonite.io',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('member.alex@newtonite.io');
    expect(res.body.user.memberships.length).toBeGreaterThan(0);
  });

  // TEST 2: Invalid login
  it('2. should reject invalid login credentials with HTTP 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'member.alex@newtonite.io',
      password: 'IncorrectPassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid.*credentials/i);
  });

  // TEST 3: Unauthorized requests
  it('3. should reject requests to protected endpoints without authorization token with HTTP 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/access denied/i);
  });

  // TEST 4: Cross-team access rejection
  it('4. should reject cross-team resource access when user lacks membership in the target team', async () => {
    // Rachel is ONLY in Team Infra, NOT in Team Payments
    const itemInPayments = await prisma.workItem.findFirst({
      where: { teamId: teamPayments.id },
    });

    const res = await request(app)
      .get(`/api/items/${itemInPayments.id}`)
      .set('Authorization', `Bearer ${viewerRachelToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/forbidden.*permission/i);
  });

  // TEST 5: Role-based permission enforcement (Viewer cannot create work item)
  it('5. should enforce team role permissions: Viewers cannot create work items', async () => {
    // Rachel is a Viewer in Team Infra
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${viewerRachelToken}`)
      .send({
        title: 'Viewer Attempt Task',
        description: 'Should be rejected',
        teamId: teamInfra.id,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/viewers cannot create/i);
  });

  // TEST 6: Successful work-item creation
  it('6. should allow a Member to create a new work item and return HTTP 201', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .send({
        title: 'Integration Test Work Item',
        description: 'Comprehensive test description for verifying work item lifecycle.',
        type: 'Task',
        priority: 'High',
        teamId: teamInfra.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.item.title).toBe('Integration Test Work Item');
    expect(res.body.item.status).toBe('Open');
    expect(res.body.item.version).toBe(1);

    sampleItem = res.body.item;
  });

  // TEST 7: Successful allowed workflow transition
  it('7. should accept valid workflow transition from Open to In_Progress', async () => {
    const res = await request(app)
      .post(`/api/items/${sampleItem.id}/transition`)
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .send({
        status: 'In_Progress',
        version: 1,
        note: 'Starting execution',
      });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('In_Progress');
    expect(res.body.item.version).toBe(2);
  });

  // TEST 8: Invalid workflow transition rejection
  it('8. should reject invalid workflow jump from In_Progress directly to Resolved with HTTP 403', async () => {
    const res = await request(app)
      .post(`/api/items/${sampleItem.id}/transition`)
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .send({
        status: 'Resolved', // In_Progress -> Resolved is invalid! Must go to Awaiting_Approval first!
        version: 2,
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/invalid workflow transition/i);
  });

  // TEST 9: Lead-only approval enforcement
  it('9. should enforce that ONLY an authorized Team Lead or Admin can approve an item into Resolved', async () => {
    // First, move item from In_Progress to Awaiting_Approval
    await request(app)
      .post(`/api/items/${sampleItem.id}/transition`)
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .send({
        status: 'Awaiting_Approval',
        version: 2,
      });

    // Attempt 1: Regular Member Alex tries to approve -> REJECTED
    const resMemberAttempt = await request(app)
      .post(`/api/items/${sampleItem.id}/transition`)
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .send({
        status: 'Resolved',
        version: 3,
      });

    expect(resMemberAttempt.status).toBe(403);
    expect(resMemberAttempt.body.message).toMatch(/only an authorized team lead or admin can approve/i);

    // Attempt 2: Authorized Team Lead Marcus approves -> SUCCESS
    const resLeadApproval = await request(app)
      .post(`/api/items/${sampleItem.id}/transition`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        status: 'Resolved',
        version: 3,
        note: 'Approved after verification.',
      });

    expect(resLeadApproval.status).toBe(200);
    expect(resLeadApproval.body.item.status).toBe('Resolved');
    expect(resLeadApproval.body.item.version).toBe(4);
  });

  // TEST 10: Concurrent claim: exactly one winner
  it('10. should handle concurrent claims: exactly one request succeeds and competing request receives HTTP 409', async () => {
    // Create fresh unassigned work item
    const unassignedItem = await prisma.workItem.create({
      data: {
        title: 'Concurrent Race Condition Item',
        description: 'Simulating two simultaneous claims',
        type: 'Incident',
        priority: 'Urgent',
        status: 'Open',
        teamId: teamInfra.id,
        assigneeId: null, // Unassigned
        createdById: leadInfra.id,
        version: 1,
      },
    });

    const tokenAlex = memberAlexToken;
    const tokenLead = leadToken;

    // Fire two claim requests simultaneously via Promise.all
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/items/${unassignedItem.id}/claim`)
        .set('Authorization', `Bearer ${tokenAlex}`)
        .send(),
      request(app)
        .post(`/api/items/${unassignedItem.id}/claim`)
        .set('Authorization', `Bearer ${tokenLead}`)
        .send(),
    ]);

    const statusCodes = [resA.status, resB.status].sort();
    // Exactly one 200 OK and one 409 Conflict
    expect(statusCodes).toEqual([200, 409]);

    const loser = resA.status === 409 ? resA : resB;
    expect(loser.body.conflictType).toBe('CONCURRENT_CLAIM');
    expect(loser.body.message).toMatch(/already been assigned or claimed/i);

    // Verify DB consistency
    const itemInDb = await prisma.workItem.findUnique({ where: { id: unassignedItem.id } });
    expect(itemInDb.assigneeId).not.toBeNull();
    expect(itemInDb.version).toBe(2);
  });

  // TEST 11: Stale-version update rejection (Optimistic Locking)
  it('11. should reject stale update with HTTP 409 Conflict when client sends an outdated version number', async () => {
    const testItem = await prisma.workItem.create({
      data: {
        title: 'OCC Stale Update Item',
        description: 'Testing version conflict',
        type: 'Task',
        priority: 'Medium',
        status: 'Open',
        teamId: teamInfra.id,
        createdById: adminUser.id,
        version: 1,
      },
    });

    // User A updates from v1 to v2
    await request(app)
      .patch(`/api/items/${testItem.id}`)
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .send({
        title: 'First Update by Alex',
        version: 1,
      });

    // User B tries to apply changes using stale v1
    const resStale = await request(app)
      .patch(`/api/items/${testItem.id}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        title: 'Conflicting Overwrite by Lead',
        version: 1, // Stale!
      });

    expect(resStale.status).toBe(409);
    expect(resStale.body.conflictType).toBe('STALE_UPDATE');
    expect(resStale.body.submittedVersion).toBe(1);
    expect(resStale.body.currentVersion).toBe(2);
  });

  // TEST 12: Duplicate idempotency key: only one item created
  it('12. should prevent duplicate work items when repeat requests submit the same Idempotency-Key', async () => {
    const uniqueTitle = `Unique Idempotent Work Item ${Date.now()}`;
    const idempotencyKey = `idem-test-${Date.now()}`;
    const payload = {
      title: uniqueTitle,
      description: 'Testing duplicate submission suppression',
      type: 'Task',
      priority: 'Low',
      teamId: teamInfra.id,
    };

    // First request
    const res1 = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(201);
    const createdId = res1.body.item.id;

    // Repeat request with exact same Idempotency-Key
    const res2 = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.headers['x-idempotent-replay']).toBe('true');
    expect(res2.body.item.id).toBe(createdId);

    // Verify only ONE record in database
    const count = await prisma.workItem.count({
      where: { title: uniqueTitle },
    });
    expect(count).toBe(1);
  });

  // TEST 13: Activity event created in the same transaction as the change
  it('13. should create ActivityEvent in the same transaction when creating or modifying a work item', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .send({
        title: 'Transactional Activity Test Item',
        description: 'Verify activity log transactional atomicity',
        type: 'Task',
        priority: 'High',
        teamId: teamInfra.id,
      });

    expect(res.status).toBe(201);
    const itemId = res.body.item.id;

    const activityEvents = await prisma.activityEvent.findMany({
      where: { workItemId: itemId },
    });

    expect(activityEvents.length).toBeGreaterThan(0);
    expect(activityEvents[0].eventType).toBe('CREATED');
    expect(activityEvents[0].actorId).toBe(memberAlex.id);
  });

  // TEST 14: Server-side filtering and pagination
  it('14. should perform server-side filtering, sorting, and pagination across thousands of items', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${memberAlexToken}`)
      .query({
        status: 'Open',
        priority: 'Urgent',
        page: 2,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
    expect(res.body.items.length).toBeLessThanOrEqual(10);
    // Every returned item matches filter criteria
    for (const item of res.body.items) {
      expect(item.status).toBe('Open');
      expect(item.priority).toBe('Urgent');
    }
  });

  // TEST 15: Outbox retry and idempotent job processing
  it('15. should process outbox jobs, support retries with backoff, and mark completed jobs', async () => {
    // 1. Enqueue a successful demonstrable job
    const successJob = await prisma.outboxJob.create({
      data: {
        jobType: 'ASSIGNMENT_NOTIFICATION',
        payload: {
          workItemId: 'test-item-123',
          assigneeName: 'Alex Rivera',
          title: 'Mitigate Redis Cache',
          actorName: 'Marcus Vance',
        },
        status: 'PENDING',
        nextRunAt: new Date(Date.now() - 1000), // Ready to run
      },
    });

    // 2. Enqueue a simulated failure job
    const failJob = await prisma.outboxJob.create({
      data: {
        jobType: 'TEST_FAILURE_JOB',
        payload: { attempt: 1 },
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 2,
        nextRunAt: new Date(Date.now() - 1000),
      },
    });

    // Run outbox processor batch
    await processPendingJobs();

    // Verify successJob is COMPLETED
    const completedJob = await prisma.outboxJob.findUnique({ where: { id: successJob.id } });
    expect(completedJob.status).toBe('COMPLETED');
    expect(completedJob.payload._executionOutcome).toBeDefined();

    // Verify failJob incremented attempt and computed backoff
    const retriedJob = await prisma.outboxJob.findUnique({ where: { id: failJob.id } });
    expect(retriedJob.attempts).toBe(1);
    expect(retriedJob.lastError).toMatch(/simulated transient/i);
    expect(retriedJob.status).toBe('PENDING'); // Retry scheduled with backoff
  });
});
