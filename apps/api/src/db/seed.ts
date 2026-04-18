/**
 * Seed script — creates stable demo data for manual E2E testing.
 * Idempotent: checks telegramId before inserting, skips if exists.
 * Run with:  npm run seed --workspace=apps/api
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { users, chefProfiles } from './schema.js'

const sql = postgres(process.env.DATABASE_URL!)
const db  = drizzle(sql)

// ─── Chefs ────────────────────────────────────────────────────────────────────

const CHEFS: Array<{
  telegramId: number
  name: string
  city: string
  profile: {
    bio: string
    cuisineTags: string[]
    workFormats: string[]
    districts: string[]
    avgPrice: string
    ratingCache: string
    ordersCount: number
  }
}> = [
  {
    telegramId: 1000001,
    name: 'Нино Гогиберидзе',
    city: 'Тбилиси',
    profile: {
      bio: 'Готовлю грузинскую кухню уже 15 лет. Хинкали, хачапури, мцвади — всё как дома. Приеду к вам или привезу готовое.',
      cuisineTags: ['Грузинская', 'Домашняя'],
      workFormats: ['home_visit', 'delivery'],
      districts: ['Сабуртало'],
      avgPrice: '80',
      ratingCache: '4.90',
      ordersCount: 25,
    },
  },
  {
    telegramId: 1000002,
    name: 'Мариам Джавахишвили',
    city: 'Тбилиси',
    profile: {
      bio: 'Домашняя грузинская кухня с любовью. Только свежие продукты с Дезертирского рынка. Доставлю прямо к вашему столу.',
      cuisineTags: ['Грузинская', 'Домашняя'],
      workFormats: ['delivery'],
      districts: ['Ваке'],
      avgPrice: '60',
      ratingCache: '4.70',
      ordersCount: 18,
    },
  },
  {
    telegramId: 1000003,
    name: 'Анна Петрова',
    city: 'Тбилиси',
    profile: {
      bio: 'Европейская кухня и паста ручной работы. Профессиональный повар с опытом в итальянских ресторанах. Готовлю у вас дома.',
      cuisineTags: ['Европейская', 'Итальянская', 'Паста'],
      workFormats: ['home_visit'],
      districts: ['Дидубе'],
      avgPrice: '120',
      ratingCache: '4.80',
      ordersCount: 12,
    },
  },
  {
    telegramId: 1000004,
    name: 'Лейла Мамедова',
    city: 'Тбилиси',
    profile: {
      bio: 'Азиатская кухня и суши на заказ. Привожу свежие ингредиенты, готовлю прямо у вас. Идеально для вечеринок.',
      cuisineTags: ['Азиатская', 'Японская', 'Суши'],
      workFormats: ['delivery'],
      districts: ['Глдани'],
      avgPrice: '50',
      ratingCache: '4.50',
      ordersCount: 9,
    },
  },
  {
    telegramId: 1000005,
    name: 'Тамара Коридзе',
    city: 'Батуми',
    profile: {
      bio: 'Веганская и здоровая кухня из локальных продуктов. Готовлю вкусно и без компромиссов. ЗОЖ — это не скучно!',
      cuisineTags: ['Веганская', 'ЗОЖ', 'Здоровое питание'],
      workFormats: ['home_visit', 'delivery'],
      districts: ['Центр'],
      avgPrice: '70',
      ratingCache: '4.60',
      ordersCount: 7,
    },
  },
]

// ─── Customers ────────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { telegramId: 2000001, name: 'Алекс Иванов', city: 'Тбилиси' },
  { telegramId: 2000002, name: 'Саша Ким',     city: 'Тбилиси' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Starting seed…\n')

  // ── Chefs ──────────────────────────────────────────────────────────────────
  console.log('Creating chefs…')

  for (const c of CHEFS) {
    // Check user
    const existing = await db.select().from(users)
      .where(eq(users.telegramId, c.telegramId)).limit(1)

    let userId: number

    if (existing[0]) {
      console.log(`  skip  user  ${c.name}  (telegramId=${c.telegramId} already exists)`)
      userId = existing[0].id
    } else {
      const [row] = await db.insert(users).values({
        telegramId: c.telegramId,
        name: c.name,
        role: 'chef',
        status: 'active',
        city: c.city,
      }).returning({ id: users.id })
      userId = row.id
      console.log(`  ✓  user  ${c.name}  userId=${userId}`)
    }

    // Check chef profile
    const existingProfile = await db.select({ id: chefProfiles.id }).from(chefProfiles)
      .where(eq(chefProfiles.userId, userId)).limit(1)

    if (existingProfile[0]) {
      console.log(`  skip  profile  ${c.name}  (profile already exists)`)
      continue
    }

    const [p] = await db.insert(chefProfiles).values({
      userId,
      bio:                c.profile.bio,
      cuisineTags:        c.profile.cuisineTags,
      workFormats:        c.profile.workFormats,
      districts:          c.profile.districts,
      avgPrice:           c.profile.avgPrice,
      ratingCache:        c.profile.ratingCache,
      ordersCount:        c.profile.ordersCount,
      verificationStatus: 'approved',
      isActive:           true,
    }).returning({ id: chefProfiles.id })

    console.log(`  ✓  profile  ${c.name}  profileId=${p.id}`)
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  console.log('\nCreating customers…')

  for (const c of CUSTOMERS) {
    const existing = await db.select().from(users)
      .where(eq(users.telegramId, c.telegramId)).limit(1)

    if (existing[0]) {
      console.log(`  skip  ${c.name}  (telegramId=${c.telegramId} already exists)`)
      continue
    }

    const [row] = await db.insert(users).values({
      telegramId: c.telegramId,
      name: c.name,
      role: 'customer',
      status: 'active',
      city: c.city,
    }).returning({ id: users.id })

    console.log(`  ✓  ${c.name}  userId=${row.id}`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('TEST ACCOUNTS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\nCustomers:')
  CUSTOMERS.forEach(c => console.log(`  telegramId=${c.telegramId}  "${c.name}"`))
  console.log('\nChefs (verificationStatus=approved):')
  CHEFS.forEach(c => console.log(`  telegramId=${c.telegramId}  "${c.name}"  ${c.city}  avg=${c.profile.avgPrice}₾`))
  console.log('\nDev JWT tokens (NODE_ENV=development):')
  console.log(`  curl http://localhost:3000/dev/token/${CUSTOMERS[0].telegramId}`)
  console.log(`  curl http://localhost:3000/dev/token/${CHEFS[0].telegramId}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

seed()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => sql.end())
