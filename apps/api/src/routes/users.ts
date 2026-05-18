import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'

export default async function usersRoutes(app: FastifyInstance) {
  app.patch<{ Body: { avatarUrl?: string; portfolioPhotos?: string[] } }>(
    '/users/me',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { avatarUrl, portfolioPhotos } = request.body
      const userId = (request.user as any).id

      const updates: any = {}
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl
      if (portfolioPhotos !== undefined) updates.portfolioPhotos = portfolioPhotos

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'At least one field is required' })
      }

      await app.db.update(users)
        .set(updates)
        .where(eq(users.id, userId))

      return { ok: true }
    }
  )

  app.patch<{ Body: { role: 'chef' | 'customer' } }>(
    '/users/me/role',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { role } = request.body
      const userId = (request.user as any).id

      if (!role || !['chef', 'customer'].includes(role)) {
        return reply.status(400).send({ error: 'role must be "chef" or "customer"' })
      }

      await app.db.update(users)
        .set({ role })
        .where(eq(users.id, userId))

      return { ok: true }
    }
  )
}
