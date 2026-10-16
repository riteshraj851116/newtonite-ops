import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../../pgdata');

const pg = new EmbeddedPostgres({
  port: 5432,
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
});

try {
  console.log('[PostgresDaemon] Starting PostgreSQL on port 5432...');
  await pg.start();
  console.log('[PostgresDaemon] PostgreSQL is active and ready on port 5432.');
} catch (err) {
  console.error('[PostgresDaemon Error]:', err);
}

// Keep daemon alive
setInterval(() => {}, 60000);
