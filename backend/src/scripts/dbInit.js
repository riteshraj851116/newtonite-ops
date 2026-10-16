import 'dotenv/config';
import { initDatabase } from '../config/db.js';

const run = async () => {
  try {
    await initDatabase();
    console.log('[dbInit] PostgreSQL is initialized and ready for migrations.');
    process.exit(0);
  } catch (err) {
    console.error('[dbInit] Error:', err);
    process.exit(1);
  }
};

run();
