import { FastifyInstance } from 'fastify';
import { uploadToR2 } from '../services/r2.js';

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/upload', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Only JPEG, PNG, WEBP allowed' });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length > 10 * 1024 * 1024) {
      return reply.code(400).send({ error: 'File too large (max 10MB)' });
    }

    const folder = (request.query as any).folder ?? 'avatars';
    const url = await uploadToR2(buffer, data.filename, data.mimetype, folder);

    return reply.send({ url });
  });
}
