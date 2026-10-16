import 'dotenv/config';
import { initDatabase } from '../config/db.js';
import { processPendingJobs } from '../services/outboxService.js';

const POLL_INTERVAL = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '3000', 10);

const runWorker = async () => {
  await initDatabase();
  console.log(`[OutboxWorker] Worker started. Polling every ${POLL_INTERVAL}ms...`);

  const poll = async () => {
    try {
      const processed = await processPendingJobs();
      if (processed.length > 0) {
        console.log(`[OutboxWorker] Processed ${processed.length} jobs:`, processed);
      }
    } catch (err) {
      console.error('[OutboxWorker Error]:', err.message);
    }
  };

  // Immediate poll then recurring interval
  await poll();
  setInterval(poll, POLL_INTERVAL);
};

// If run directly via node
if (process.argv[1].endsWith('outboxWorker.js')) {
  runWorker().catch((err) => {
    console.error('[OutboxWorker Fatal]:', err);
    process.exit(1);
  });
}
