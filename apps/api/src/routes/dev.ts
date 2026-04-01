/**
 * Development-only routes. Registered only when NODE_ENV=development.
 *
 * POST /dev/reset           — truncate all tables and re-run seed
 * GET  /dev/token/:telegramId — return a signed JWT for any existing user
 *                              (no initData validation — dev only!)
 */

import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { execSync } from 'node:child_process'
import { users } from '../db/schema.js'

export default async function devRoutes(app: FastifyInstance) {
  if (process.env.NODE_ENV !== 'development') return

  app.log.warn('⚠️  Dev routes enabled (POST /dev/reset, GET /dev/token/:telegramId)')

  // ── POST /dev/reset ─────────────────────────────────────────────────────────
  // Truncates all tables in dependency order, then runs seed.ts.

  app.post('/dev/reset', async (_req, reply) => {
    app.log.warn('DEV /dev/reset — truncating all tables…')

    await app.db.execute(/* sql */ `
      TRUNCATE TABLE
        chef_responses,
        requests,
        disputes,
        reviews,
        payments,
        orders,
        chef_profiles,
        users
      RESTART IDENTITY CASCADE
    `)

    // Run seed in the same working directory as main.ts (apps/api)
    try {
      execSync('npx tsx src/db/seed.ts', {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: 'inherit',
      })
    } catch (err) {
      app.log.error({ err }, 'seed failed after reset')
      return reply.code(500).send({ error: 'Truncate succeeded but seed failed', detail: String(err) })
    }

    return reply.send({ ok: true, message: 'Database reset and re-seeded' })
  })

  // ── GET /dev/token/:telegramId ───────────────────────────────────────────────
  // Returns a signed JWT for any user that already exists in the DB.
  // Useful for testing API calls with curl / Postman without a real Telegram client.

  app.get<{ Params: { telegramId: string } }>('/dev/token/:telegramId', {
    schema: {
      params: {
        type: 'object',
        required: ['telegramId'],
        properties: { telegramId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const telegramId = Number(request.params.telegramId)
    if (!Number.isFinite(telegramId)) {
      return reply.code(400).send({ error: 'Invalid telegramId' })
    }

    const [user] = await app.db
      .select({
        id:         users.id,
        role:       users.role,
        telegramId: users.telegramId,
        name:       users.name,
      })
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1)

    if (!user) {
      return reply.code(404).send({
        error: 'User not found. Run POST /dev/reset or npx tsx src/db/seed.ts first.',
      })
    }

    const token = app.jwt.sign(
      { sub: user.id, role: user.role, telegramId: user.telegramId },
      { expiresIn: '7d' },
    )

    return reply.send({
      token,
      user: { id: user.id, telegramId: user.telegramId, name: user.name, role: user.role },
      curl: `curl -H "Authorization: Bearer ${token}" http://localhost:3000/orders`,
    })
  })
}
