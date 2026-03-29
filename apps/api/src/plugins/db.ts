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
  const sql = postgres(process.env.DATABASE_URL!)
  const db = drizzle(sql, { schema })

  app.decorate('db', db)

  app.addHook('onClose', async () => {
    await sql.end()
  })
})
