import 'dotenv/config'
import Fastify from 'fastify'

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

// Fail fast if required env vars are missing
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'BOT_TOKEN'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env variable: ${key}`)
    process.exit(1)
  }
}

const app = Fastify({ logger: true })

async function bootstrap() {
  // Plugins
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

  app.get('/health', async () => ({ status: 'ok' }))

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