import type Database from 'better-sqlite3';
import type { AlertMatch } from './alert-matching.js';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

export class DevelopmentEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<void> {
    console.log('[development email]', message);
  }
}

type NewsDetails = {
  title: string;
  summary: string;
  content: string;
  categoryName: string;
  publishedAt: string;
  sourceName: string | null;
  sourceUrl: string | null;
};

export async function notifyAlertMatches(
  database: Database.Database,
  matches: AlertMatch[],
  news: NewsDetails,
  emailAdapter: EmailAdapter
): Promise<void> {
  for (const match of matches) {
    const user = database.prepare('SELECT email FROM users WHERE id = ?').get(match.userId) as { email: string } | undefined;
    if (!user) continue;

    const source = news.sourceName && news.sourceUrl
      ? `Source: ${news.sourceName}\n${news.sourceUrl}`
      : 'Source: Admin newsroom';
    await emailAdapter.send({
      to: user.email,
      subject: `New ${news.categoryName} alert: ${news.title}`,
      text: [
        `A new ${news.categoryName} news item matches your alert.`,
        '',
        news.title,
        news.summary,
        news.content,
        `Published: ${news.publishedAt}`,
        source
      ].join('\n')
    });
  }
}