import bcrypt from 'bcryptjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';

export type UserRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
};

type UserRow = AuthUser & { password_hash: string };

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

const SESSION_COOKIE = 'alertme_session';
const SESSION_DAYS = 7;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createAuth(database: Database.Database) {
  function findUserByEmail(email: string): UserRow | undefined {
    return database.prepare(
      'SELECT id, email, password_hash, role FROM users WHERE email = ?'
    ).get(email) as UserRow | undefined;
  }

  function findUserById(id: number): AuthUser | undefined {
    return database.prepare(
      'SELECT id, email, role FROM users WHERE id = ?'
    ).get(id) as AuthUser | undefined;
  }

  function createUser(email: string, passwordHash: string, role: UserRole = 'USER'): AuthUser {
    const result = database.prepare(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)'
    ).run(email, passwordHash, role);
    return findUserById(Number(result.lastInsertRowid))!;
  }

  function createSession(userId: number): string {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    database.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).run(sessionId, userId, expiresAt);
    return sessionId;
  }

  function getUserForSession(sessionId: string | undefined): AuthUser | undefined {
    if (!sessionId) return undefined;
    const row = database.prepare(`
      SELECT users.id, users.email, users.role, sessions.expires_at
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
    `).get(sessionId) as (AuthUser & { expires_at: string }) | undefined;
    if (!row) return undefined;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      database.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
      return undefined;
    }
    return { id: row.id, email: row.email, role: row.role };
  }

  function setSessionCookie(reply: FastifyReply, sessionId: string): void {
    reply.header('Set-Cookie', `${SESSION_COOKIE}=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`);
  }

  function clearSessionCookie(reply: FastifyReply): void {
    reply.header('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = getUserForSession(request.cookies?.[SESSION_COOKIE]);
    if (!user) {
      await reply.code(401).send({ error: 'Authentication required' });
      return;
    }
    request.user = user;
  }

  async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireUser(request, reply);
    if (reply.sent) return;
    if (request.user?.role !== 'ADMIN') {
      await reply.code(403).send({ error: 'Administrator access required' });
    }
  }

  return {
    clearSessionCookie,
    createSession,
    createUser,
    findUserByEmail,
    getUserForSession,
    hashPassword,
    requireAdmin,
    requireUser,
    setSessionCookie,
    verifyPassword
  };
}

export { SESSION_COOKIE };