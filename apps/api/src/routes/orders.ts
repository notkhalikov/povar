import type { FastifyInstance } from 'fastify'
import { eq, or, and, sql, inArray } from 'drizzle-orm'
import { orders, chefProfiles, payments, users } from '../db/schema.js'
import { canTransition } from '../services/order-state.js'
import { notifyUser, statusNotifyText } from '../services/notify.js'
import type { OrderStatus, ProductsBuyer, WorkFormat } from '../types/index.js'

interface CreateOrderBody {
  chefProfileId: number
  type: WorkFormat
  city: string
  district?: string
  address?: string
  scheduledAt: string
  persons: number
  description?: string
  agreedPrice?: number
  productsBuyer?: ProductsBuyer
  productsBudget?: number
}

interface PatchStatusBody {
  status: OrderStatus
}

export default async function ordersRoutes(app: FastifyInstance) {

  // ─── POST /orders ────────────────────────────────────────────────────────────

  app.post<{ Body: CreateOrderBody }>('/orders', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['chefProfileId', 'type', 'city', 'scheduledAt', 'persons'],
        additionalProperties: false,
        properties: {
          chefProfileId: { type: 'integer' },
          type:           { type: 'string', enum: ['home_visit', 'delivery'] },
          city:           { type: 'string', minLength: 1 },
          district:       { type: 'string' },
          address:        { type: 'string' },
          scheduledAt:    { type: 'string' },
          persons:        { type: 'integer', minimum: 1, maximum: 50 },
          description:    { type: 'string', maxLength: 2000 },
          agreedPrice:    { type: 'number', minimum: 0 },
          productsBuyer:  { type: 'string', enum: ['customer', 'chef'] },
          productsBudget: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const customerId = request.user.sub
    const body = request.body

    // Resolve chefProfileId → chef users.id
    const [profile] = await app.db
      .select({ userId: chefProfiles.userId, isActive: chefProfiles.isActive, verificationStatus: chefProfiles.verificationStatus })
      .from(chefProfiles)
      .where(eq(chefProfiles.id, body.chefProfileId))
      .limit(1)

    if (!profile) return reply.code(404).send({ error: 'Chef not found' })
    if (!profile.isActive || profile.verificationStatus !== 'approved') {
      return reply.code(422).send({ error: 'Chef is not available' })
    }

    const [order] = await app.db
      .insert(orders)
      .values({
        customerId,
        chefId: profile.userId,
        type: body.type,
        city: body.city,
        district: body.district,
        address: body.address,
        scheduledAt: new Date(body.scheduledAt),
        persons: body.persons,
        description: body.description,
        agreedPrice: body.agreedPrice !== undefined ? String(body.agreedPrice) : undefined,
        productsBuyer: body.productsBuyer,
        productsBudget: body.productsBudget !== undefined ? String(body.productsBudget) : undefined,
        status: 'awaiting_payment',
      })
      .returning()

    // Notify chef about the new order (fire-and-forget)
    const participants = await app.db
      .select({ id: users.id, name: users.name, telegramId: users.telegramId })
      .from(users)
      .where(inArray(users.id, [profile.userId, customerId]))

    const chef     = participants.find(u => u.id === profile.userId)
    const customer = participants.find(u => u.id === customerId)

    if (chef) {
      const date = new Date(body.scheduledAt).toLocaleString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
      notifyUser(
        chef.telegramId,
        `🍽 Новый заказ #${order.id} от ${customer?.name ?? 'клиента'}\n📅 ${date} · 👥 ${body.persons} чел.`,
        order.id,
      ).catch(err => app.log.warn({ err }, 'notify chef failed'))
    }

    return reply.code(201).send(order)
  })

  // ─── GET /orders ─────────────────────────────────────────────────────────────

  app.get('/orders', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const userId = request.user.sub

    const rows = await app.db
      .select({
        id: orders.id,
        type: orders.type,
        city: orders.city,
        scheduledAt: orders.scheduledAt,
        persons: orders.persons,
        agreedPrice: orders.agreedPrice,
        status: orders.status,
        createdAt: orders.createdAt,
        chefName: sql<string>`chef_user.name`,
        customerName: sql<string>`customer_user.name`,
      })
      .from(orders)
      .leftJoin(sql`users AS chef_user`, sql`chef_user.id = ${orders.chefId}`)
      .leftJoin(sql`users AS customer_user`, sql`customer_user.id = ${orders.customerId}`)
      .where(or(eq(orders.customerId, userId), eq(orders.chefId, userId)))
      .orderBy(sql`${orders.createdAt} DESC`)

    return { data: rows }
  })

  // ─── GET /orders/:id ─────────────────────────────────────────────────────────

  app.get<{ Params: { id: number } }>('/orders/:id', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { id } = request.params

    const [row] = await app.db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        chefId: orders.chefId,
        type: orders.type,
        city: orders.city,
        district: orders.district,
        address: orders.address,
        scheduledAt: orders.scheduledAt,
        persons: orders.persons,
        description: orders.description,
        agreedPrice: orders.agreedPrice,
        productsBuyer: orders.productsBuyer,
        productsBudget: orders.productsBudget,
        status: orders.status,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        chefName: sql<string>`chef_user.name`,
        customerName: sql<string>`customer_user.name`,
      })
      .from(orders)
      .leftJoin(sql`users AS chef_user`, sql`chef_user.id = ${orders.chefId}`)
      .leftJoin(sql`users AS customer_user`, sql`customer_user.id = ${orders.customerId}`)
      .where(
        and(
          eq(orders.id, id),
          or(eq(orders.customerId, userId), eq(orders.chefId, userId)),
        ),
      )
      .limit(1)

    if (!row) return reply.code(404).send({ error: 'Order not found' })
    return row
  })

  // ─── POST /orders/:id/invoice ────────────────────────────────────────────────

  app.post<{ Params: { id: number } }>('/orders/:id/invoice', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { id } = request.params

    const [order] = await app.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.customerId, userId)))
      .limit(1)

    if (!order) return reply.code(404).send({ error: 'Order not found' })
    if (order.status !== 'awaiting_payment') {
      return reply.code(422).send({ error: `Cannot invoice order in status "${order.status}"` })
    }
    if (!order.agreedPrice) {
      return reply.code(422).send({ error: 'Agreed price must be set before creating an invoice' })
    }

    const paymentsToken = process.env.PAYMENTS_TOKEN
    if (!paymentsToken) {
      return reply.code(503).send({ error: 'Payment provider not configured' })
    }

    // Amount in smallest currency unit (tetri for GEL: 1 GEL = 100 tetri)
    const amountTetri = Math.round(Number(order.agreedPrice) * 100)

    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Заказ #${order.id}`,
          description: `${order.type === 'home_visit' ? 'Повар на дом' : 'Доставка'} · ${order.persons} чел. · ${order.city}`,
          payload: `order:${order.id}`,
          provider_token: paymentsToken,
          currency: 'GEL',
          prices: [{ label: 'Итого', amount: amountTetri }],
        }),
      },
    )

    const tgJson = await tgRes.json() as { ok: boolean; result?: string; description?: string }
    if (!tgJson.ok) {
      app.log.error({ tgJson }, 'createInvoiceLink failed')
      return reply.code(502).send({ error: 'Failed to create invoice', detail: tgJson.description })
    }

    // Record the pending payment
    await app.db.insert(payments).values({
      orderId: order.id,
      amount: order.agreedPrice,
      currency: 'GEL',
      provider: 'telegram',
      status: 'created',
    })

    return reply.send({ invoiceUrl: tgJson.result })
  })

  // ─── PATCH /orders/:id/status ────────────────────────────────────────────────

  app.patch<{ Params: { id: number }; Body: PatchStatusBody }>('/orders/:id/status', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['draft','awaiting_payment','paid','in_progress','completed','dispute_pending','refunded','cancelled'],
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const role = request.user.role as import('../types/index.js').UserRole
    const { id } = request.params
    const { status: nextStatus } = request.body

    const [order] = await app.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, id),
          or(eq(orders.customerId, userId), eq(orders.chefId, userId)),
        ),
      )
      .limit(1)

    if (!order) return reply.code(404).send({ error: 'Order not found' })

    const err = canTransition(order.status, nextStatus, role)
    if (err) {
      return reply.code(err.code === 'FORBIDDEN' ? 403 : 422).send({ error: err.message })
    }

    const [updated] = await app.db
      .update(orders)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning()

    // Notify the other party (fire-and-forget)
    const otherUserId = userId === order.customerId ? order.chefId : order.customerId
    const [otherUser] = await app.db
      .select({ telegramId: users.telegramId })
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1)

    if (otherUser) {
      notifyUser(otherUser.telegramId, statusNotifyText(nextStatus, id), id)
        .catch(err => app.log.warn({ err }, 'notify status change failed'))
    }

    return updated
  })
}
