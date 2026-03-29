import fp from 'fastify-plugin';
import cors from '@fastify/cors';

export default fp(async (app) => {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
  });
});