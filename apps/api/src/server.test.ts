import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createDatabase } from './db.js';
import { createApp } from './server.js';

let app: Awaited<ReturnType<typeof createApp>>;
let database: ReturnType<typeof createDatabase>;

beforeEach(async () => {
  database = createDatabase(':memory:');
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

test('lists categories and lets an admin create news for a category', async () => {
  const categories = await app.inject({ method: 'GET', url: '/api/categories' });
  assert.equal(categories.statusCode, 200);
  const technology = categories.json().categories.find((category: { slug: string }) => category.slug === 'technology');
  assert.ok(technology);

  const adminPassword = 'adminpass123';
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'admin@example.com', password: adminPassword }
  });
  const userId = registration.json().user.id;
  database.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(userId);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@example.com', password: adminPassword }
  });
  assert.equal(login.statusCode, 200);
  const create = await app.inject({
    method: 'POST',
    url: '/api/admin/news',
    headers: { cookie: login.headers['set-cookie'] },
    payload: {
      categoryId: technology.id,
      title: 'A new technology story',
      summary: 'A short summary.',
      content: 'The full story.',
      sourceName: 'Alertme News',
      sourceUrl: 'https://example.com/story'
    }
  });
  assert.equal(create.statusCode, 201);

  const news = await app.inject({ method: 'GET', url: '/api/news' });
  assert.equal(news.statusCode, 200);
  assert.equal(news.json().news[0].categorySlug, 'technology');
});

test('allows admin news without RSS source fields', async () => {
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'admin@example.com', password: 'adminpass123' }
  });
  database.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(registration.json().user.id);

  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/news',
    headers: { cookie: registration.headers['set-cookie'] },
    payload: {
      categoryId: 1,
      title: 'Internal newsroom update',
      summary: 'A source is not required for admin-created news.',
      content: 'This story was created directly by an administrator.'
    }
  });

  assert.equal(created.statusCode, 201);
  assert.equal(created.json().news.source_name, null);
  assert.equal(created.json().news.source_url, null);
});

test('supports admin news and category management', async () => {
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'manager@example.com', password: 'adminpass123' }
  });
  database.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(registration.json().user.id);
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'manager@example.com', password: 'adminpass123' }
  });
  const cookie = login.headers['set-cookie'];

  const createdCategory = await app.inject({
    method: 'POST',
    url: '/api/admin/categories',
    headers: { cookie },
    payload: { name: 'Climate' }
  });
  assert.equal(createdCategory.statusCode, 201);
  const categoryId = createdCategory.json().category.id;
  assert.equal(createdCategory.json().category.slug, 'climate');

  const updatedCategory = await app.inject({
    method: 'PUT',
    url: `/api/admin/categories/${categoryId}`,
    headers: { cookie },
    payload: { name: 'Climate News' }
  });
  assert.equal(updatedCategory.statusCode, 200);
  assert.equal(updatedCategory.json().category.slug, 'climate-news');

  const createdNews = await app.inject({
    method: 'POST',
    url: '/api/admin/news',
    headers: { cookie },
    payload: { categoryId, title: 'Climate report', summary: 'Summary', content: 'Content' }
  });
  const newsId = createdNews.json().news.id;
  assert.equal(createdNews.statusCode, 201);

  const adminNews = await app.inject({ method: 'GET', url: '/api/admin/news', headers: { cookie } });
  assert.equal(adminNews.statusCode, 200);
  assert.equal(adminNews.json().news[0].id, newsId);

  const adminNewsDetail = await app.inject({ method: 'GET', url: `/api/admin/news/${newsId}`, headers: { cookie } });
  assert.equal(adminNewsDetail.statusCode, 200);

  const updatedNews = await app.inject({
    method: 'PUT',
    url: `/api/admin/news/${newsId}`,
    headers: { cookie },
    payload: { categoryId, title: 'Updated climate report', summary: 'Updated summary', content: 'Updated content' }
  });
  assert.equal(updatedNews.statusCode, 200);
  assert.equal(updatedNews.json().news.title, 'Updated climate report');

  const blockedCategoryDelete = await app.inject({ method: 'DELETE', url: `/api/admin/categories/${categoryId}`, headers: { cookie } });
  assert.equal(blockedCategoryDelete.statusCode, 409);

  const deletedNews = await app.inject({ method: 'DELETE', url: `/api/admin/news/${newsId}`, headers: { cookie } });
  assert.equal(deletedNews.statusCode, 204);
  const deletedCategory = await app.inject({ method: 'DELETE', url: `/api/admin/categories/${categoryId}`, headers: { cookie } });
  assert.equal(deletedCategory.statusCode, 204);
});

test('requires admin authorization for management routes', async () => {
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'reader@example.com', password: 'password123' }
  });
  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/categories',
    headers: { cookie: registration.headers['set-cookie'] }
  });
  assert.equal(response.statusCode, 403);
});

test('keeps signups as USER and lets only admins change roles', async () => {
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'new-user@example.com', password: 'password123' }
  });
  assert.equal(signup.statusCode, 201);
  assert.equal(signup.json().user.role, 'USER');

  const adminSignup = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'admin@example.com', password: 'adminpass123' }
  });
  database.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(adminSignup.json().user.id);
  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@example.com', password: 'adminpass123' }
  });
  const adminCookie = adminLogin.headers['set-cookie'];

  const users = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { cookie: adminCookie } });
  assert.equal(users.statusCode, 200);
  assert.equal(users.json().users.length, 2);

  const promoted = await app.inject({
    method: 'PUT',
    url: `/api/admin/users/${signup.json().user.id}/role`,
    headers: { cookie: adminCookie },
    payload: { role: 'ADMIN' }
  });
  assert.equal(promoted.statusCode, 200);
  assert.equal(promoted.json().user.role, 'ADMIN');

  const demoted = await app.inject({
    method: 'PUT',
    url: `/api/admin/users/${signup.json().user.id}/role`,
    headers: { cookie: adminCookie },
    payload: { role: 'USER' }
  });
  assert.equal(demoted.statusCode, 200);
  assert.equal(demoted.json().user.role, 'USER');

  const lastAdmin = await app.inject({
    method: 'PUT',
    url: `/api/admin/users/${adminSignup.json().user.id}/role`,
    headers: { cookie: adminCookie },
    payload: { role: 'USER' }
  });
  assert.equal(lastAdmin.statusCode, 409);

  const regularUser = await app.inject({
    method: 'PUT',
    url: `/api/admin/users/${adminSignup.json().user.id}/role`,
    headers: { cookie: signup.headers['set-cookie'] },
    payload: { role: 'USER' }
  });
  assert.equal(regularUser.statusCode, 403);
});