import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { payments, orders, users } from '../db/schema.js'
import { notifyOrderPaid } from '../services/notify.js'

interface CreateInvoiceBody {
  orderId: number
}

interface TelegramWebhookBody {
  orderId: number
  telegramPaymentChargeId: string
  providerPaymentChargeId?: string
  totalAmount: number
  currency: string
}

export default async function paymentsRoutes(app: FastifyInstance) {

  // ─── POST /payments/invoice ───────────────────────────────────────────────────
  // Authenticated. Creates a Telegram invoice link for the given order.
  // Returns { invoiceUrl } to be opened via WebApp.openInvoice().

  app.post<{ Body: CreateInvoiceBody }>('/payments/invoice', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['orderId'],
        additionalProperties: false,
        properties: {
          orderId: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { orderId } = request.body

    const [order] = await app.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, userId)))
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
      return reply.code(503).send({ error: 'Payment provider not configured (PAYMENTS_TOKEN missing)' })
    }

    // Telegram requires amount in smallest currency unit (tetri: 1 GEL = 100 tetri)
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
      app.log.error({ tgJson, orderId }, 'createInvoiceLink failed')
      return reply.code(502).send({ error: 'Failed to create invoice', detail: tgJson.description })
    }

    // Record the pending payment so the webhook can match it later
    await app.db.insert(payments).values({
      orderId: order.id,
      amount: order.agreedPrice,
      currency: 'GEL',
      provider: 'telegram',
      status: 'created',
    })

    return reply.send({ invoiceUrl: tgJson.result })
  })

  // ─── POST /payments/telegram-webhook ─────────────────────────────────────────
  // Called internally by the bot when it receives a successful_payment update.
  // Authenticated via x-webhook-secret header (shared secret, not user JWT).

  app.post<{ Body: TelegramWebhookBody }>('/payments/telegram-webhook', {
    schema: {
      body: {
        type: 'object',
        required: ['orderId', 'telegramPaymentChargeId', 'totalAmount', 'currency'],
        properties: {
          orderId:                   { type: 'integer' },
          telegramPaymentChargeId:   { type: 'string' },
          providerPaymentChargeId:   { type: 'string' },
          totalAmount:               { type: 'integer' },
          currency:                  { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    // Verify shared secret
    const secret = request.headers['x-webhook-secret']
    const expected = process.env.WEBHOOK_SECRET
    if (!expected || secret !== expected) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { orderId, telegramPaymentChargeId, totalAmount, currency } = request.body

    // Find the pending payment for this order
    const [payment] = await app.db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, orderId), eq(payments.status, 'created')))
      .orderBy(payments.createdAt)
      .limit(1)

    if (!payment) {
      return reply.code(404).send({ error: 'Pending payment not found for this order' })
    }

    // Check order exists and is in the right state
    const [order] = await app.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' })
    }
    if (order.status !== 'awaiting_payment') {
      // Idempotent: already paid is fine
      if (order.status === 'paid') return reply.send({ ok: true, alreadyPaid: true })
      return reply.code(422).send({ error: `Order is in unexpected status "${order.status}"` })
    }

    // Mark payment as paid
    await app.db
      .update(payments)
      .set({
        status: 'paid',
        providerTxId: telegramPaymentChargeId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id))

    // Advance order status to paid
    await app.db
      .update(orders)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    app.log.info({ orderId, telegramPaymentChargeId, totalAmount, currency }, 'Payment confirmed')

    // Notify chef that the order is paid and they should prepare (fire-and-forget)
    const [chef] = await app.db
      .select({ telegramId: users.telegramId })
      .from(users)
      .where(eq(users.id, order.chefId))
      .limit(1)

    if (chef) {
      notifyOrderPaid(order, chef.telegramId)
        .catch(err => app.log.warn({ err }, 'notify chef paid failed'))
    }

    return reply.send({ ok: true })
  })
}
