import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../db/schema.js'

type DB = ReturnType<typeof drizzle<typeof schema>>

declare module 'fastify' {
  interface FastifyInstance {
    db: DB
  }
}

export default fp(async (app: FastifyInstance) => {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('Missing required env variable DATABASE_URL')
  }

  const sql = postgres(url)
  const db = drizzle(sql, { schema })

  app.decorate('db', db)

  app.addHook('onClose', async () => {
    await sql.end()
  })
})
