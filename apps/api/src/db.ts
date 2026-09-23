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

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      source_name TEXT,
      source_url TEXT,
      published_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS news_items_category_id_idx ON news_items(category_id);
    CREATE INDEX IF NOT EXISTS news_items_published_at_idx ON news_items(published_at);

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS alerts_user_id_idx ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS alerts_category_id_idx ON alerts(category_id);

    INSERT OR IGNORE INTO categories (name, slug) VALUES
      ('World', 'world'),
      ('Technology', 'technology'),
      ('Business', 'business'),
      ('Science', 'science'),
      ('Sports', 'sports');
  `);

  const newsColumns = database.prepare('PRAGMA table_info(news_items)').all() as Array<{ name: string; notnull: number }>;
  const sourceColumnsAreRequired = newsColumns.some((column) =>
    (column.name === 'source_name' || column.name === 'source_url') && column.notnull === 1
  );
  if (sourceColumnsAreRequired) {
    database.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      CREATE TABLE news_items_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        source_name TEXT,
        source_url TEXT,
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id)
      );
      INSERT INTO news_items_migrated
        (id, category_id, title, summary, content, source_name, source_url, published_at, created_at, created_by_user_id)
      SELECT id, category_id, title, summary, content, source_name, source_url, published_at, created_at, created_by_user_id
      FROM news_items;
      DROP TABLE news_items;
      ALTER TABLE news_items_migrated RENAME TO news_items;
      CREATE INDEX IF NOT EXISTS news_items_category_id_idx ON news_items(category_id);
      CREATE INDEX IF NOT EXISTS news_items_published_at_idx ON news_items(published_at);
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }

  const alertColumns = database.prepare('PRAGMA table_info(alerts)').all() as Array<{ name: string }>;
  if (alertColumns.some((column) => column.name === 'triggered_at')) {
    database.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      CREATE TABLE alerts_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO alerts_migrated (id, user_id, category_id, enabled, created_at)
        SELECT id, user_id, category_id, enabled, created_at FROM alerts;
      DROP TABLE alerts;
      ALTER TABLE alerts_migrated RENAME TO alerts;
      CREATE INDEX IF NOT EXISTS alerts_user_id_idx ON alerts(user_id);
      CREATE INDEX IF NOT EXISTS alerts_category_id_idx ON alerts(category_id);
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }

  database.exec(`
    DELETE FROM alerts
    WHERE id NOT IN (
      SELECT MIN(id) FROM alerts GROUP BY user_id, category_id
    );
    CREATE UNIQUE INDEX IF NOT EXISTS alerts_user_category_unique_idx ON alerts(user_id, category_id);
  `);

  return database;
}

export const database = createDatabase();

export function checkDatabase(databaseConnection: Database.Database = database): boolean {
  const result = databaseConnection.prepare('SELECT 1 AS healthy').get() as { healthy: number };
  return result.healthy === 1;
}
