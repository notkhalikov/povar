import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'

export default async function usersRoutes(app: FastifyInstance) {
  /**
   * GET /users/me
   * Authenticated. Returns the current user's profile.
   */
  app.get(
    '/users/me',
    { onRequest: [app.authenticate] },
    async (request) => {
      const userId = (request.user as any).id

      const [user] = await app.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user) {
        return { error: 'User not found' }
      }

      return {
        id: user.id,
        name: user.name,
        telegramId: user.telegramId,
        role: user.role,
        isChef: user.role === 'chef',
        avatarUrl: user.avatarUrl,
        city: user.city,
        portfolioPhotos: user.portfolioPhotos,
        onboardingDone: user.onboardingDone,
      }
    }
  )

  app.patch<{ Body: { avatarUrl?: string; portfolioPhotos?: string[]; city?: string; bio?: string } }>(
    '/users/me',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { avatarUrl, portfolioPhotos, city, bio } = request.body
      const userId = (request.user as any).id

      const updates: any = {}
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl
      if (portfolioPhotos !== undefined) updates.portfolioPhotos = portfolioPhotos
      if (city !== undefined) updates.city = city

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
