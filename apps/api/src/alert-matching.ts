import type Database from 'better-sqlite3';

export type AlertMatch = {
  alertId: number;
  userId: number;
  categoryId: number;
};

export function matchAlerts(database: Database.Database, categoryId: number): AlertMatch[] {
  const matchingAlerts = database.prepare(
    'SELECT id, user_id AS userId FROM alerts WHERE category_id = ? AND enabled = 1'
  ).all(categoryId) as Array<{ id: number; userId: number }>;

  return matchingAlerts.map((alert) => ({
    alertId: alert.id,
    userId: alert.userId,
    categoryId
  }));
}