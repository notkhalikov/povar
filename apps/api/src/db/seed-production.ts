/**
 * Production seed — creates the first admin user by Telegram ID.
 *
 * Usage:
 *   npx tsx src/db/seed-production.ts <telegram_id>
 *
 * Example:
 *   npx tsx src/db/seed-production.ts 123456789
 *
 * Run once after the first deploy. Subsequent runs are idempotent.
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { users } from './schema.js'

const telegramIdArg = process.argv[2]

if (!telegramIdArg || isNaN(Number(telegramIdArg))) {
  console.error('Usage: npx tsx src/db/seed-production.ts <telegram_id>')
  process.exit(1)
}

const telegramId = Number(telegramIdArg)

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL)
const db  = drizzle(sql)

async function seedProduction() {
  console.log(`\n🔑 Creating admin user for telegramId=${telegramId}…\n`)

  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1)

  if (existing[0]) {
    const u = existing[0]
    if (u.role === 'admin') {
      console.log(`✓ User #${u.id} is already an admin. Nothing to do.`)
    } else {
      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, u.id))
      console.log(`✓ Promoted existing user #${u.id} to admin.`)
    }
  } else {
    const [created] = await db
      .insert(users)
      .values({
        telegramId,
        name: 'Admin',
        role: 'admin',
        lang: 'ru',
      })
      .returning({ id: users.id })

    console.log(`✓ Created admin user #${created.id} for telegramId=${telegramId}.`)
  }

  console.log('\n✅ Done.\n')
}

seedProduction()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => sql.end())
