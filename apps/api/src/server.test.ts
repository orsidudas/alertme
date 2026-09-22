import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createDatabase } from './db.js';
import { createApp } from './server.js';

let app: Awaited<ReturnType<typeof createApp>>;

beforeEach(async () => {
  const database = createDatabase(':memory:');
  app = await createApp(database, { logger: false });
});

afterEach(async () => {
  await app.close();
});

test('registers a user and returns the current user from its session', async () => {
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'user@example.com', password: 'password123' }
  });

  assert.equal(registration.statusCode, 201);
  assert.deepEqual(registration.json().user, {
    id: 1,
    email: 'user@example.com',
    role: 'USER'
  });

  const currentUser = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: registration.headers['set-cookie'] }
  });
  assert.equal(currentUser.statusCode, 200);
  assert.equal(currentUser.json().user.email, 'user@example.com');
});

test('logs in with a valid password and rejects an invalid one', async () => {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'user@example.com', password: 'password123' }
  });

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'user@example.com', password: 'wrong-password' }
  });
  assert.equal(invalid.statusCode, 401);

  const valid = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'user@example.com', password: 'password123' }
  });
  assert.equal(valid.statusCode, 200);
  assert.ok(valid.headers['set-cookie']);
});

test('logs out and protects admin routes by role', async () => {
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'user@example.com', password: 'password123' }
  });
  const cookie = registration.headers['set-cookie'];

  const forbidden = await app.inject({
    method: 'GET',
    url: '/api/admin/check',
    headers: { cookie }
  });
  assert.equal(forbidden.statusCode, 403);

  const loggedOut = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { cookie }
  });
  assert.equal(loggedOut.statusCode, 204);

  const unauthenticated = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie }
  });
  assert.equal(unauthenticated.statusCode, 401);
});