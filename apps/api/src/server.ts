import cors from '@fastify/cors';
import Fastify from 'fastify';
import { checkDatabase } from './db.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get('/api/health', async () => ({
  status: 'ok',
  database: checkDatabase()
}));

const port = Number(process.env.PORT ?? 3001);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
