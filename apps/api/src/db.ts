import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function createDatabase(databasePath = process.env.DATABASE_PATH ?? './data/alertme.sqlite') {
  const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(databasePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  const database = new Database(resolvedPath);
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('USER', 'ADMIN')) DEFAULT 'USER',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  `);

  return database;
}

export const database = createDatabase();

export function checkDatabase(databaseConnection: Database.Database = database): boolean {
  const result = databaseConnection.prepare('SELECT 1 AS healthy').get() as { healthy: number };
  return result.healthy === 1;
}
