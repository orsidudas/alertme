import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath = resolve(process.env.DATABASE_PATH ?? './data/alertme.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

export const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

export function checkDatabase(): boolean {
  const result = database.prepare('SELECT 1 AS healthy').get() as { healthy: number };
  return result.healthy === 1;
}
