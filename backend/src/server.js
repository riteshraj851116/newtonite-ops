import 'dotenv/config';
import app from './app.js';
import { initDatabase } from './config/db.js';
import { processPendingJobs } from './services/outboxService.js';

const PORT = process.env.PORT || 5000;
const POLL_INTERVAL = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '3000', 10);

const startServer = async () => {
  try {
    await initDatabase();

    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log('  Newtonite Ops — Operations Under Pressure API');
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Server URL:  http://localhost:${PORT}`);
      console.log('====================================================');
    });

    // Start background outbox processor loop
    const outboxTimer = setInterval(async () => {
      try {
        await processPendingJobs();
      } catch (err) {
        // Suppress worker errors in console loop
      }
    }, POLL_INTERVAL);

    const shutdown = async () => {
      console.log('\nShutting down Newtonite Ops server...');
      clearInterval(outboxTimer);
      server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
};

startServer();
