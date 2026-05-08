import fp from 'fastify-plugin';
import cors from '@fastify/cors';

// Default whitelist — covers production Vercel deployments and local dev.
// Override in any environment via ALLOWED_ORIGINS (comma-separated).
const DEFAULT_ORIGINS = [
  'https://povar-one.vercel.app',
  'https://povar-notkhalikovs-projects.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

export default fp(async (app) => {
  const origin = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : DEFAULT_ORIGINS

  await app.register(cors, { origin })
});
