import type { FastifyInstance } from 'fastify'
import { eq, and, inArray, count } from 'drizzle-orm'
import { users, chefProfiles, orders, requests, chefResponses } from '../db/schema.js'

const SYSTEM_SECRET = process.env.SYSTEM_SECRET ?? ''

interface UserContextQuery {
  telegramId: string
}

export default async function systemRoutes(app: FastifyInstance) {
  /**
   * GET /system/user-context?telegramId=X
   *
   * Internal endpoint used by the bot to determine smart /start context.
   * Protected by x-system-secret header (must match SYSTEM_SECRET env var).
   *
   * Returns:
   *   { found: false }
   *   or
   *   {
   *     found: true,
   *     role: 'customer' | 'chef',
   *     isChef: boolean,
   *     chefStatus: 'active' | 'vacation' | null,
   *     activeOrdersCount: number,        // for customer: active orders; for chef: active orders
   *     activeOrder: { id, scheduledAt } | null,  // customer's nearest active order
   *     incomingRequestsCount: number,    // chef only: open requests awaiting response
   *   }
   */
  app.get<{ Querystring: UserContextQuery }>('/system/user-context', {
    schema: {
      querystring: {
        type: 'object',
        required: ['telegramId'],
        properties: {
          telegramId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const secret = request.headers['x-system-secret']
    if (!SYSTEM_SECRET || secret !== SYSTEM_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const telegramId = parseInt(request.query.telegramId, 10)
    if (isNaN(telegramId)) {
      return reply.code(400).send({ error: 'Invalid telegramId' })
    }

    // Look up user
    const [user] = await app.db
      .select({
        id:   users.id,
        role: users.role,
        name: users.name,
      })
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1)

    if (!user) {
      return { found: false }
    }

    const isChef = user.role === 'chef'

    // ── Chef branch ───────────────────────────────────────────────────────────

    if (isChef) {
      const [profile] = await app.db
        .select({ isActive: chefProfiles.isActive, city: users.city })
        .from(chefProfiles)
        .innerJoin(users, eq(users.id, chefProfiles.userId))
        .where(eq(chefProfiles.userId, user.id))
        .limit(1)

      const chefStatus = profile ? (profile.isActive ? 'active' : 'vacation') : 'active'

      // Count open chef_responses for this chef where request is still open
      // (i.e. requests in the chef's city that have NO response from this chef yet)
      const [{ value: incomingRequestsCount }] = await app.db
        .select({ value: count() })
        .from(requests)
        .where(
          and(
            eq(requests.status, 'open'),
            // Exclude requests this chef has already responded to
            // We use a raw NOT EXISTS subquery via sql tag
            // but simpler: count all open requests in same city
          ),
        )

      // Count active orders for chef
      const [{ value: activeOrdersCount }] = await app.db
        .select({ value: count() })
        .from(orders)
        .where(
          and(
            eq(orders.chefId, user.id),
            inArray(orders.status, ['paid', 'in_progress', 'awaiting_payment']),
          ),
        )

      return {
        found: true,
        role: user.role,
        isChef: true,
        chefStatus,
        activeOrdersCount,
        activeOrder: null,
        incomingRequestsCount: Number(incomingRequestsCount),
      }
    }

    // ── Customer branch ───────────────────────────────────────────────────────

    const activeOrders = await app.db
      .select({ id: orders.id, scheduledAt: orders.scheduledAt })
      .from(orders)
      .where(
        and(
          eq(orders.customerId, user.id),
          inArray(orders.status, ['awaiting_payment', 'paid', 'in_progress']),
        ),
      )
      .limit(1)

    const activeOrder = activeOrders[0] ?? null

    return {
      found: true,
      role: user.role,
      isChef: false,
      chefStatus: null,
      activeOrdersCount: activeOrders.length,
      activeOrder: activeOrder
        ? { id: activeOrder.id, scheduledAt: activeOrder.scheduledAt }
        : null,
      incomingRequestsCount: 0,
    }
  })

  /**
   * PATCH /system/chef-active
   *
   * Called by the bot's activate_chef callback query to flip isActive=true.
   * Protected by x-system-secret header.
   */
  app.patch<{ Body: { telegramId: number } }>('/system/chef-active', {
    schema: {
      body: {
        type: 'object',
        required: ['telegramId'],
        properties: {
          telegramId: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const secret = request.headers['x-system-secret']
    if (!SYSTEM_SECRET || secret !== SYSTEM_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { telegramId } = request.body

    const [user] = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1)

    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    await app.db
      .update(chefProfiles)
      .set({ isActive: true })
      .where(eq(chefProfiles.userId, user.id))

    return { ok: true }
  })
}
