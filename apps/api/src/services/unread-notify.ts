import type { FastifyInstance } from 'fastify'
import { eq, and, isNull, lt, sql } from 'drizzle-orm'
import { messages, orders, requests, users } from '../db/schema.js'

const TICK_INTERVAL_MS = 60_000
const BATCH_SIZE = 50
const STALE_INTERVAL_SQL = sql`now() - interval '2 minutes'`

interface MessageRow {
  id: number
  orderId:   number | null
  requestId: number | null
  chefId:    number | null
  senderId:  number
  body:      string
}

export function startUnreadNotifier(app: FastifyInstance) {
  setInterval(() => {
    run(app).catch(err => {
      app.log.warn({ err, event: 'unread_notifier_tick_error' })
    })
  }, TICK_INTERVAL_MS)
  app.log.info('[unread-notify] started, tick every 60s')
}

async function run(app: FastifyInstance) {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) return
  const frontendUrl = process.env.FRONTEND_URL ?? ''

  const candidates = await app.db
    .select({
      id:        messages.id,
      orderId:   messages.orderId,
      requestId: messages.requestId,
      chefId:    messages.chefId,
      senderId:  messages.senderId,
      body:      messages.body,
    })
    .from(messages)
    .where(
      and(
        lt(messages.createdAt, STALE_INTERVAL_SQL),
        isNull(messages.readAt),
        isNull(messages.notifiedAt),
      ),
    )
    .limit(BATCH_SIZE)

  if (candidates.length === 0) return

  let sent = 0
  for (const m of candidates) {
    try {
      const ok = await notifyOne(app, m, botToken, frontendUrl)
      if (ok) sent += 1
    } catch (err) {
      app.log.warn({ err, messageId: m.id }, '[unread-notify] per-message error')
    }
  }

  app.log.info({ event: 'unread_notifier_batch', scanned: candidates.length, sent })
}

async function notifyOne(
  app: FastifyInstance,
  m: MessageRow,
  botToken: string,
  frontendUrl: string,
): Promise<boolean> {
  let recipientUserId: number | null = null
  let entityLabel = ''
  let entityPath  = ''

  if (m.orderId !== null) {
    const [o] = await app.db
      .select({ customerId: orders.customerId, chefId: orders.chefId })
      .from(orders)
      .where(eq(orders.id, m.orderId))
      .limit(1)
    if (!o) return false
    recipientUserId = m.senderId === o.customerId ? o.chefId : o.customerId
    entityLabel = `по заказу #${m.orderId}`
    entityPath  = `/orders/${m.orderId}?chat=1`
  } else if (m.requestId !== null && m.chefId !== null) {
    const [r] = await app.db
      .select({ customerId: requests.customerId })
      .from(requests)
      .where(eq(requests.id, m.requestId))
      .limit(1)
    if (!r) return false
    // Pair is customer ↔ m.chefId. Recipient is the one who's not the sender.
    recipientUserId = m.senderId === r.customerId ? m.chefId : r.customerId
    entityLabel = `по заявке #${m.requestId}`
    entityPath  = `/requests/${m.requestId}?chat=1`
  } else {
    return false
  }

  const [recipient] = await app.db
    .select({ telegramId: users.telegramId })
    .from(users)
    .where(eq(users.id, recipientUserId))
    .limit(1)
  if (!recipient?.telegramId) return false

  const text = `💬 У вас непрочитанное сообщение ${entityLabel}\n\n"${m.body.slice(0, 100)}"`
  const url  = `${frontendUrl}${entityPath}`

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: recipient.telegramId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть чат', url }]],
      },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    app.log.warn(
      { messageId: m.id, status: res.status, detail },
      '[unread-notify] telegram send failed',
    )
    return false
  }

  await app.db
    .update(messages)
    .set({ notifiedAt: new Date() })
    .where(eq(messages.id, m.id))

  return true
}
