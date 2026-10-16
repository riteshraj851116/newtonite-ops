import { prisma } from '../config/db.js';

/**
 * Creates an outbox job within an existing Prisma transaction.
 */
export const queueOutboxJob = async (tx, jobType, payload) => {
  return await tx.outboxJob.create({
    data: {
      jobType,
      payload,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: parseInt(process.env.OUTBOX_MAX_RETRIES || '3', 10),
      nextRunAt: new Date(),
    },
  });
};

/**
 * Demonstrable handler for outbox jobs.
 */
export const handleJobPayload = async (job) => {
  switch (job.jobType) {
    case 'ASSIGNMENT_NOTIFICATION': {
      const { workItemId, assigneeId, assigneeName, title, actorName } = job.payload;
      // In production, this would dispatch webhook / in-app push / WebSocket event.
      // We log and return success.
      return {
        deliveredAt: new Date().toISOString(),
        recipient: assigneeName,
        message: `User ${actorName} assigned task "${title}" to ${assigneeName}.`,
      };
    }

    case 'STATUS_CHANGE_NOTIFICATION': {
      const { title, previousStatus, newStatus, actorName } = job.payload;
      return {
        deliveredAt: new Date().toISOString(),
        message: `Task "${title}" moved from ${previousStatus} to ${newStatus} by ${actorName}.`,
      };
    }

    case 'TEST_FAILURE_JOB': {
      // Used by automated tests to verify retry and max attempt behavior
      throw new Error('Simulated transient worker exception');
    }

    default:
      return { processed: true, jobType: job.jobType };
  }
};

/**
 * Processes a single batch of pending outbox jobs with retry and exponential backoff.
 */
export const processPendingJobs = async () => {
  const now = new Date();

  // Find pending jobs ready to be executed
  const jobs = await prisma.outboxJob.findMany({
    where: {
      status: 'PENDING',
      nextRunAt: { lte: now },
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  const results = [];

  for (const job of jobs) {
    // Mark as processing
    await prisma.outboxJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING' },
    });

    try {
      const outcome = await handleJobPayload(job);

      // Successfully finished
      const updated = await prisma.outboxJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          lastError: null,
          payload: {
            ...job.payload,
            _executionOutcome: outcome,
          },
        },
      });
      results.push({ id: job.id, status: 'COMPLETED' });
    } catch (err) {
      const nextAttempt = job.attempts + 1;
      const isExhausted = nextAttempt >= job.maxAttempts;

      // Exponential backoff: 2^attempt seconds (e.g. 2s, 4s, 8s)
      const backoffMs = Math.pow(2, nextAttempt) * 1000;
      const nextRunAt = new Date(Date.now() + backoffMs);

      const updated = await prisma.outboxJob.update({
        where: { id: job.id },
        data: {
          status: isExhausted ? 'FAILED' : 'PENDING',
          attempts: nextAttempt,
          lastError: err.message,
          nextRunAt: isExhausted ? undefined : nextRunAt,
        },
      });

      results.push({
        id: job.id,
        status: isExhausted ? 'FAILED' : 'PENDING',
        attempts: nextAttempt,
        error: err.message,
      });
    }
  }

  return results;
};
