import type Database from 'better-sqlite3';
import { Resend } from 'resend';
import type { AlertMatch } from './alert-matching.js';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

export class ResendEmailAdapter implements EmailAdapter {
  private readonly client: Resend;

  constructor(
    private readonly from: string,
    apiKey: string
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text
    });
    if (error) throw new Error(`Email provider failed: ${error.message}`);
  }
}

export function createEmailAdapterFromEnv(
  environment: NodeJS.ProcessEnv = process.env
): EmailAdapter {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const from = environment.EMAIL_FROM?.trim();
  const missing = [
    !apiKey ? 'RESEND_API_KEY' : null,
    !from ? 'EMAIL_FROM' : null
  ].filter((value): value is string => value !== null);
  if (missing.length > 0) {
    throw new Error(`Email configuration missing: ${missing.join(', ')}. Set these environment variables before starting the API.`);
  }
  return new ResendEmailAdapter(from as string, apiKey as string);
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
    const user = database.prepare('SELECT email FROM users WHERE id = ?').get(match.userId) as { email: string | null } | undefined;
    if (!user?.email) {
      console.warn(`[email skipped] no email address for user ${match.userId}`);
      continue;
    }

    const source = news.sourceName && news.sourceUrl
      ? `Source: ${news.sourceName}\n${news.sourceUrl}`
      : 'Source: Admin newsroom';
    try {
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
    } catch (error) {
      const providerError = error instanceof Error ? error.message : String(error);
      console.error(`[email delivery failed] recipient=${user.email} error=${providerError}`);
    }
  }
}