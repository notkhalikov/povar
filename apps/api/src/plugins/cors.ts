import fp from 'fastify-plugin';
import cors from '@fastify/cors';

const PROD_ORIGINS = ['https://povar-one.vercel.app']

export default fp(async (app) => {
  let origin: string[] | true

  if (process.env.CORS_ORIGIN) {
    // Explicit list always wins (covers custom domains, staging, etc.)
    origin = process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  } else if (process.env.NODE_ENV === 'production') {
    // In production with no explicit override, only allow the Vercel domain
    origin = PROD_ORIGINS
  } else {
    // Development — allow all origins so the local Vite dev server works
    origin = true
  }

  await app.register(cors, { origin })
});