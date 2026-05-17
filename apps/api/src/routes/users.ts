import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'

export default async function usersRoutes(app: FastifyInstance) {
  app.patch<{ Body: { avatarUrl: string } }>(
    '/users/me',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { avatarUrl } = request.body
      const userId = (request.user as any).id

      if (!avatarUrl || typeof avatarUrl !== 'string') {
        return reply.status(400).send({ error: 'avatarUrl is required' })
      }

      await app.db.update(users)
        .set({ avatarUrl })
        .where(eq(users.id, userId))

      return { ok: true }
    }
  )
}
