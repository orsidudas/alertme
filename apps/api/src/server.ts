import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type Database from 'better-sqlite3';
import { createAuth } from './auth.js';
import { checkDatabase, database as defaultDatabase } from './db.js';

type Credentials = { email?: unknown; password?: unknown };

function isCredentials(value: unknown): value is Credentials {
  return typeof value === 'object' && value !== null;
}

export async function createApp(
  database: Database.Database = defaultDatabase,
  options: FastifyServerOptions = { logger: true }
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
