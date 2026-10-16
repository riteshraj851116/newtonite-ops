import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import EmbeddedPostgres from 'embedded-postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let embeddedPgInstance = null;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * Checks if PostgreSQL is reachable on target port.
 */
const isPostgresReachable = async (host, port) => {
  return new Promise((resolve) => {
    const client = new pg.Client({
      host,
      port,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: 'postgres',
      connectionTimeoutMillis: 1500,
    });

    client.connect((err) => {
      if (err) {
        resolve(false);
      } else {
        client.end();
        resolve(true);
      }
    });
  });
};

/**
 * Ensure PostgreSQL is running and target database exists.
 * If no external Postgres/Docker is running on port 5432, launches Embedded PostgreSQL automatically!
 */
export const initDatabase = async () => {
  const host = 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const targetDb = process.env.POSTGRES_DB || 'newtonite_ops';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';

  const reachable = await isPostgresReachable(host, port);

  if (!reachable) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Database] No PostgreSQL detected on port ${port}. Booting embedded PostgreSQL server...`);
    }
    const dataDir = path.resolve(__dirname, '../../../pgdata');
    embeddedPgInstance = new EmbeddedPostgres({
      port,
      databaseDir: dataDir,
      user,
      password,
    });

    try {
      await embeddedPgInstance.initialise();
    } catch {
      // Cluster may already have been initialized in existing directory
    }
    await embeddedPgInstance.start();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Database] Embedded PostgreSQL server started successfully on port ${port}.`);
    }
  }

  // Ensure target database exists
  const adminClient = new pg.Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const checkRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );
    if (checkRes.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${targetDb}"`);
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[Database] Database '${targetDb}' created.`);
      }
    }
  } catch (err) {
    console.error(`[Database Admin Warning]:`, err.message);
  } finally {
    await adminClient.end();
  }

  // Verify Prisma connection
  await prisma.$connect();
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Prisma] Connected to PostgreSQL at ${host}:${port}/${targetDb}`);
  }
};

export const stopDatabase = async () => {
  await prisma.$disconnect();
  if (embeddedPgInstance) {
    await embeddedPgInstance.stop();
  }
};
