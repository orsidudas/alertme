import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

import { createDatabase } from './db.js';
import { createAuth } from './auth.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
}

const database = createDatabase();
const auth = createAuth(database);
const existingUser = auth.findUserByEmail(email);

if (existingUser) {
  database.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(existingUser.id);
  console.log(`Promoted ${email} to ADMIN.`);
} else {
  await auth.createUser(email, await auth.hashPassword(password), 'ADMIN');
  console.log(`Created admin user ${email}.`);
}

database.close();