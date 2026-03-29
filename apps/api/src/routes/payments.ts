import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { payments, orders, users } from '../db/schema.js'
import { notifyUser } from '../services/notify.js'

interface TelegramWebhookBody {
  orderId: number
  telegramPaymentChargeId: string
  providerPaymentChargeId?: string
  totalAmount: number
  currency: string
}

export default async function paymentsRoutes(app: FastifyInstance) {

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
      notifyUser(chef.telegramId, `💳 Заказ #${orderId} оплачен! Клиент ждёт вас.`, orderId)
        .catch(err => app.log.warn({ err }, 'notify chef paid failed'))
    }

    return reply.send({ ok: true })
  })
}
