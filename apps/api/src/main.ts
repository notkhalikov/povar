import 'dotenv/config'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import * as Sentry from '@sentry/node'

import { eq, isNull, lt, sql, and } from 'drizzle-orm'
import { orders, users, chefProfiles } from './db/schema.js'
import { sendReviewReminder } from './services/notify.js'
import corsPlugin from './plugins/cors.js'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import chefsRoutes from './routes/chefs.js'
import ordersRoutes from './routes/orders.js'
import paymentsRoutes from './routes/payments.js'
import reviewsRoutes from './routes/reviews.js'
import disputesRoutes from './routes/disputes.js'
import requestsRoutes from './routes/requests.js'
import adminRoutes from './routes/admin.js'
import devRoutes from './routes/dev.js'
import systemRoutes from './routes/system.js'

// Fail fast if required env vars are missing
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'BOT_TOKEN'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env variable: ${key}`)
    process.exit(1)
  }
}

// ─── Sentry ───────────────────────────────────────────────────────────────────

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN })
}

// ─── App version ─────────────────────────────────────────────────────────────

const APP_VERSION = process.env.npm_package_version ?? '0.0.1'

// ─── In-memory request counter (rolling 1-hour window) ───────────────────────

const REQUEST_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const requestTimestamps: number[] = []

function recordRequest() {
  const now = Date.now()
  requestTimestamps.push(now)
  // Evict entries older than 1 hour to keep the array bounded
  const cutoff = now - REQUEST_WINDOW_MS
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift()
  }
}

const app = Fastify({ logger: true })

// ─── Global error handler ─────────────────────────────────────────────────────

app.setErrorHandler((err, _request, reply) => {
  app.log.error(err)

  const status = err.statusCode ?? 500
  const code   = err.code ?? 'INTERNAL_ERROR'

  // Fastify validation errors
  if (err.validation) {
    return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' })
  }

  // Rate limit errors come with statusCode 429
  if (status === 429) {
    return reply.code(429).send({ error: 'Too many requests, please slow down', code: 'RATE_LIMITED' })
  }

  const message = status < 500 ? err.message : 'Internal server error'
  return reply.code(status).send({ error: message, code })
})

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  // Plugins
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' })
  await app.register(corsPlugin)
  await app.register(dbPlugin)
  await app.register(authPlugin)

  // Routes
  await app.register(authRoutes)
  await app.register(chefsRoutes)
  await app.register(ordersRoutes)
  await app.register(paymentsRoutes)
  await app.register(reviewsRoutes)
  await app.register(disputesRoutes)
  await app.register(requestsRoutes)
  await app.register(adminRoutes)
  await app.register(devRoutes)
  await app.register(systemRoutes)

  app.get('/health', async () => {
    let dbOk = false
    try {
      await app.db.execute(sql`SELECT 1`)
      dbOk = true
    } catch { /* db unreachable */ }

    return {
      status:    dbOk ? 'ok' : 'degraded',
      db:        dbOk ? 'ok' : 'error',
      uptime:    Math.floor(process.uptime()),
      version:   APP_VERSION,
      timestamp: new Date().toISOString(),
    }
  })

  app.get('/health/detailed', {
    onRequest: async (request, reply) => {
      if (request.headers['x-system-secret'] !== process.env.SYSTEM_SECRET) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }
    },
  }, async () => {
    const [ordersCount] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
    const [usersCount] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
    const [chefsCount] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefProfiles)
      .where(eq(chefProfiles.verificationStatus, 'approved'))

    return {
      status: 'ok',
      counts: {
        orders:       ordersCount.count,
        users:        usersCount.count,
        active_chefs: chefsCount.count,
      },
      uptime: Math.floor(process.uptime()),
    }
  })

  // ─── Metrics (Railway health check / ops dashboard) ─────────────────────────
  app.get('/metrics', { config: { rateLimit: false } }, async () => ({
    uptime:           process.uptime(),
    requestsLastHour: requestTimestamps.length,
    version:          APP_VERSION,
  }))

  // ─── Client error sink ───────────────────────────────────────────────────────
  app.post<{ Body: { message: string; stack?: string; url?: string } }>('/client-error', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        additionalProperties: true,
        properties: {
          message: { type: 'string', maxLength: 2000 },
          stack:   { type: 'string', maxLength: 5000 },
          url:     { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request) => {
    app.log.error({ event: 'client_error', ...request.body })
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(new Error(request.body.message))
    }
    return { ok: true }
  })

  // Count every request for /metrics
  app.addHook('onRequest', async () => { recordRequest() })

  // Start
  try {
    await app.listen({
      port: Number(process.env.PORT ?? 3000),
      host: '0.0.0.0'
    })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

bootstrap()

// ─── Review reminder cron (every 30 min) ──────────────────────────────────────
// Finds completed orders with no review and no reminder sent yet, where
// completion was > 2 hours ago, and sends a review nudge to the customer.

setInterval(async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const candidates = await app.db
      .select({
        orderId:            orders.id,
        customerTelegramId: users.telegramId,
        chefName:           sql<string>`(SELECT name FROM users WHERE id = ${orders.chefId})`,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.customerId))
      .where(
        and(
          eq(orders.status, 'completed'),
          lt(orders.updatedAt, twoHoursAgo),
          isNull(orders.reviewReminderSentAt),
          sql`NOT EXISTS (SELECT 1 FROM reviews WHERE reviews.order_id = ${orders.id})`,
        ),
      )
      .limit(50)

    for (const row of candidates) {
      try {
        await sendReviewReminder(row.orderId, row.chefName, row.customerTelegramId)
        await app.db
          .update(orders)
          .set({ reviewReminderSentAt: new Date() })
          .where(eq(orders.id, row.orderId))
      } catch (err) {
        app.log.warn({ err, orderId: row.orderId }, 'review reminder send failed')
      }
    }

    if (candidates.length > 0) {
      app.log.info({ event: 'review_reminders_sent', count: candidates.length })
    }
  } catch (err) {
    app.log.error({ event: 'review_reminder_cron_error', error: String(err), err }, 'review reminder cron failed')
  }
}, 30 * 60 * 1000)