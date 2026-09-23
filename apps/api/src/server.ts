import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type Database from 'better-sqlite3';
import { createAuth } from './auth.js';
import { matchAlerts } from './alert-matching.js';
import { checkDatabase, database as defaultDatabase } from './db.js';
import { DevelopmentEmailAdapter, notifyAlertMatches, type EmailAdapter } from './email.js';

type Credentials = { email?: unknown; password?: unknown };

function isCredentials(value: unknown): value is Credentials {
  return typeof value === 'object' && value !== null;
}

const newsSelect = `
  SELECT news_items.id, news_items.title, news_items.summary, news_items.content,
    news_items.source_name AS sourceName, news_items.source_url AS sourceUrl,
    news_items.published_at AS publishedAt, categories.id AS categoryId,
    categories.name AS categoryName, categories.slug AS categorySlug
  FROM news_items JOIN categories ON categories.id = news_items.category_id
`;

const alertSelect = `
  SELECT alerts.id, alerts.user_id AS userId, alerts.category_id AS categoryId,
    alerts.enabled, alerts.created_at AS createdAt,
    categories.name AS categoryName, categories.slug AS categorySlug
  FROM alerts JOIN categories ON categories.id = alerts.category_id
`;

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isNewsPayload(body: unknown): body is Record<string, unknown> {
  if (typeof body !== 'object' || body === null) return false;
  const fields = body as Record<string, unknown>;
  return ['title', 'summary', 'content'].every((field) => typeof fields[field] === 'string' && fields[field].trim().length > 0)
    && typeof fields.categoryId === 'number';
}

export async function createApp(
  database: Database.Database = defaultDatabase,
  options: FastifyServerOptions = { logger: true },
  emailAdapter: EmailAdapter = new DevelopmentEmailAdapter()
) {
  const app = Fastify(options);
  const auth = createAuth(database);

  await app.register(cookie);
  await app.register(cors, { origin: true, credentials: true });

  app.get('/api/health', async () => ({ status: 'ok', database: checkDatabase(database) }));

  app.post('/api/auth/register', async (request, reply) => {
    if (!isCredentials(request.body) || typeof request.body.email !== 'string' || typeof request.body.password !== 'string') {
      return reply.code(400).send({ error: 'Email and password are required' });
    }
    const email = request.body.email.trim().toLowerCase();
    if (!email || request.body.password.length < 8) {
      return reply.code(400).send({ error: 'Email must be valid and password must be at least 8 characters' });
    }
    if (auth.findUserByEmail(email)) return reply.code(409).send({ error: 'Email is already registered' });
    const user = auth.createUser(email, await auth.hashPassword(request.body.password));
    auth.setSessionCookie(reply, auth.createSession(user.id));
    return reply.code(201).send({ user });
  });

  app.post('/api/auth/login', async (request, reply) => {
    if (!isCredentials(request.body) || typeof request.body.email !== 'string' || typeof request.body.password !== 'string') {
      return reply.code(400).send({ error: 'Email and password are required' });
    }
    const user = auth.findUserByEmail(request.body.email.trim().toLowerCase());
    if (!user || !(await auth.verifyPassword(request.body.password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    auth.setSessionCookie(reply, auth.createSession(user.id));
    return reply.send({ user: { id: user.id, email: user.email, role: user.role } });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const sessionId = request.cookies.alertme_session;
    if (sessionId) database.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    auth.clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get('/api/auth/me', { preHandler: auth.requireUser }, async (request) => ({ user: request.user }));
  app.get('/api/admin/check', { preHandler: auth.requireAdmin }, async () => ({ ok: true }));

  app.get('/api/admin/users', { preHandler: auth.requireAdmin }, async () => ({
    users: database.prepare('SELECT id, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC, id DESC').all()
  }));

  app.put('/api/admin/users/:id/role', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { role?: unknown };
    if (body?.role !== 'USER' && body?.role !== 'ADMIN') {
      return reply.code(400).send({ error: 'Role must be USER or ADMIN' });
    }
    const target = database.prepare('SELECT id, email, role FROM users WHERE id = ?').get(Number(id)) as { id: number; email: string; role: string } | undefined;
    if (!target) return reply.code(404).send({ error: 'User not found' });
    if (target.id === request.user!.id && body.role === 'USER') {
      const adminCount = database.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'").get() as { count: number };
      if (adminCount.count <= 1) return reply.code(409).send({ error: 'The last administrator cannot be demoted' });
    }
    database.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, Number(id));
    return { user: database.prepare('SELECT id, email, role, created_at AS createdAt FROM users WHERE id = ?').get(Number(id)) };
  });

  app.get('/api/categories', async () => ({
    categories: database.prepare('SELECT id, name, slug FROM categories ORDER BY name').all()
  }));

  app.get('/api/news', async () => ({
    news: database.prepare(`${newsSelect} ORDER BY news_items.published_at DESC, news_items.id DESC`).all()
  }));

  app.get('/api/news/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const news = database.prepare(`${newsSelect} WHERE news_items.id = ?`).get(Number(id));
    if (!news) return reply.code(404).send({ error: 'News item not found' });
    return { news };
  });

  app.get('/api/alerts', { preHandler: auth.requireUser }, async (request) => ({
    alerts: database.prepare(`${alertSelect} WHERE alerts.user_id = ? ORDER BY alerts.created_at DESC, alerts.id DESC`).all(request.user!.id)
  }));

  app.post('/api/alerts', { preHandler: auth.requireUser }, async (request, reply) => {
    const body = request.body as { categoryId?: unknown };
    if (typeof body?.categoryId !== 'number' || !Number.isInteger(body.categoryId)) {
      return reply.code(400).send({ error: 'Category is required' });
    }
    const category = database.prepare('SELECT id FROM categories WHERE id = ?').get(body.categoryId);
    if (!category) return reply.code(400).send({ error: 'Category not found' });
    let result;
    try {
      result = database.prepare(
        'INSERT INTO alerts (user_id, category_id, enabled) VALUES (?, ?, 1)'
      ).run(request.user!.id, body.categoryId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        return reply.code(409).send({ error: 'You already have an alert for this category' });
      }
      throw error;
    }
    return reply.code(201).send({
      alert: database.prepare(`${alertSelect} WHERE alerts.id = ? AND alerts.user_id = ?`).get(result.lastInsertRowid, request.user!.id)
    });
  });

  app.patch('/api/alerts/:id', { preHandler: auth.requireUser }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { enabled?: unknown };
    if (typeof body?.enabled !== 'boolean') return reply.code(400).send({ error: 'Enabled must be a boolean' });
    const result = database.prepare(
      'UPDATE alerts SET enabled = ? WHERE id = ? AND user_id = ?'
    ).run(body.enabled ? 1 : 0, Number(id), request.user!.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Alert not found' });
    return { alert: database.prepare(`${alertSelect} WHERE alerts.id = ? AND alerts.user_id = ?`).get(Number(id), request.user!.id) };
  });

  app.delete('/api/alerts/:id', { preHandler: auth.requireUser }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = database.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?').run(Number(id), request.user!.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Alert not found' });
    return reply.code(204).send();
  });

  app.post('/api/admin/news', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!isNewsPayload(body)) {
      return reply.code(400).send({ error: 'Title, summary, content, and category are required' });
    }
    const category = database.prepare('SELECT id FROM categories WHERE id = ?').get(body.categoryId);
    if (!category) return reply.code(400).send({ error: 'Category not found' });
    const publishedAt = typeof body.publishedAt === 'string' && body.publishedAt
      ? body.publishedAt
      : new Date().toISOString();
    const result = database.prepare(`
      INSERT INTO news_items
        (category_id, title, summary, content, source_name, source_url, published_at, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.categoryId,
      (body.title as string).trim(),
      (body.summary as string).trim(),
      (body.content as string).trim(),
      typeof body.sourceName === 'string' && body.sourceName.trim() ? body.sourceName.trim() : null,
      typeof body.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : null,
      publishedAt,
      request.user!.id
    );
    const news = database.prepare('SELECT * FROM news_items WHERE id = ?').get(result.lastInsertRowid);
    const notificationNews = database.prepare(`
      SELECT news_items.title, news_items.summary, news_items.content,
        news_items.published_at AS publishedAt, news_items.source_name AS sourceName,
        news_items.source_url AS sourceUrl, categories.name AS categoryName
      FROM news_items JOIN categories ON categories.id = news_items.category_id
      WHERE news_items.id = ?
    `).get(result.lastInsertRowid) as {
      title: string;
      summary: string;
      content: string;
      publishedAt: string;
      sourceName: string | null;
      sourceUrl: string | null;
      categoryName: string;
    };
    const matches = matchAlerts(database, body.categoryId as number);
    await notifyAlertMatches(database, matches, notificationNews, emailAdapter);
    return reply.code(201).send({ news });
  });

  app.get('/api/admin/news', { preHandler: auth.requireAdmin }, async () => ({
    news: database.prepare(`${newsSelect} ORDER BY news_items.published_at DESC, news_items.id DESC`).all()
  }));

  app.get('/api/admin/news/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const news = database.prepare(`${newsSelect} WHERE news_items.id = ?`).get(Number(id));
    if (!news) return reply.code(404).send({ error: 'News item not found' });
    return { news };
  });

  app.put('/api/admin/news/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isNewsPayload(request.body)) {
      return reply.code(400).send({ error: 'Title, summary, content, and category are required' });
    }
    const body = request.body;
    const existing = database.prepare('SELECT id FROM news_items WHERE id = ?').get(Number(id));
    if (!existing) return reply.code(404).send({ error: 'News item not found' });
    const category = database.prepare('SELECT id FROM categories WHERE id = ?').get(body.categoryId);
    if (!category) return reply.code(400).send({ error: 'Category not found' });
    database.prepare(`
      UPDATE news_items SET category_id = ?, title = ?, summary = ?, content = ?, source_name = ?, source_url = ?
      WHERE id = ?
    `).run(
      body.categoryId, (body.title as string).trim(), (body.summary as string).trim(), (body.content as string).trim(),
      typeof body.sourceName === 'string' && body.sourceName.trim() ? body.sourceName.trim() : null,
      typeof body.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : null,
      Number(id)
    );
    return { news: database.prepare(`${newsSelect} WHERE news_items.id = ?`).get(Number(id)) };
  });

  app.delete('/api/admin/news/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = database.prepare('DELETE FROM news_items WHERE id = ?').run(Number(id));
    if (result.changes === 0) return reply.code(404).send({ error: 'News item not found' });
    return reply.code(204).send();
  });

  app.get('/api/admin/categories', { preHandler: auth.requireAdmin }, async () => ({
    categories: database.prepare('SELECT id, name, slug FROM categories ORDER BY name').all()
  }));

  app.get('/api/admin/categories/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = database.prepare('SELECT id, name, slug FROM categories WHERE id = ?').get(Number(id));
    if (!category) return reply.code(404).send({ error: 'Category not found' });
    return { category };
  });

  app.post('/api/admin/categories', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const body = request.body as { name?: unknown };
    if (typeof body?.name !== 'string' || !body.name.trim()) return reply.code(400).send({ error: 'Category name is required' });
    const name = body.name.trim();
    const slug = slugify(name);
    if (!slug) return reply.code(400).send({ error: 'Category name must contain letters or numbers' });
    try {
      const result = database.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, slug);
      return reply.code(201).send({ category: database.prepare('SELECT id, name, slug FROM categories WHERE id = ?').get(result.lastInsertRowid) });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) return reply.code(409).send({ error: 'Category name or slug already exists' });
      throw error;
    }
  });

  app.put('/api/admin/categories/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: unknown };
    if (typeof body?.name !== 'string' || !body.name.trim()) return reply.code(400).send({ error: 'Category name is required' });
    const existing = database.prepare('SELECT id FROM categories WHERE id = ?').get(Number(id));
    if (!existing) return reply.code(404).send({ error: 'Category not found' });
    const name = body.name.trim();
    const slug = slugify(name);
    try {
      database.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').run(name, slug, Number(id));
      return { category: database.prepare('SELECT id, name, slug FROM categories WHERE id = ?').get(Number(id)) };
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) return reply.code(409).send({ error: 'Category name or slug already exists' });
      throw error;
    }
  });

  app.delete('/api/admin/categories/:id', { preHandler: auth.requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = database.prepare('SELECT id FROM categories WHERE id = ?').get(Number(id));
    if (!category) return reply.code(404).send({ error: 'Category not found' });
    const usage = database.prepare('SELECT COUNT(*) AS count FROM news_items WHERE category_id = ?').get(Number(id)) as { count: number };
    if (usage.count > 0) return reply.code(409).send({ error: 'Category cannot be deleted while news uses it' });
    database.prepare('DELETE FROM categories WHERE id = ?').run(Number(id));
    return reply.code(204).send();
  });

  return app;
}

const port = Number(process.env.PORT ?? 3001);

if (process.argv[1]?.endsWith('/server.ts') || process.argv[1]?.endsWith('/server.js')) {
  const app = await createApp();
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
