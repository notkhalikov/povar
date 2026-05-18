import { FastifyInstance } from 'fastify';
import { uploadToR2 } from '../services/r2.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/upload', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
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
        // Check size as we stream to fail fast on large files
        const currentSize = chunks.reduce((sum, buf) => sum + buf.length, 0) + chunk.length;
        if (currentSize > MAX_FILE_SIZE) {
          return reply.code(413).send({ error: 'Файл слишком большой. Максимум 5 МБ' });
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length > MAX_FILE_SIZE) {
        return reply.code(413).send({ error: 'Файл слишком большой. Максимум 5 МБ' });
      }

      const folder = (request.query as any).folder ?? 'avatars';
      const url = await uploadToR2(buffer, data.filename, data.mimetype, folder);

      return reply.send({ url });
    } catch (err: any) {
      if (err.code === 'FST_FILES_LIMIT' || err.statusCode === 413 || err.message?.includes('too large')) {
        return reply.status(413).send({ error: 'Файл слишком большой. Максимум 5 МБ' });
      }
      throw err;
    }
  });
}
