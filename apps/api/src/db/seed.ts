/**
 * Seed script — creates stable test data for manual E2E testing.
 * Idempotent: existing rows (matched by telegramId / status / etc.) are skipped.
 * Run with:  npx tsx src/db/seed.ts
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, and } from 'drizzle-orm'
import {
  users, chefProfiles, orders, reviews,
  disputes, requests, chefResponses,
} from './schema.js'

const sql = postgres(process.env.DATABASE_URL!)
const db  = drizzle(sql)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(14, 0, 0, 0)
  return d
}

async function upsertUser(telegramId: number, data: {
  name: string
  role: 'customer' | 'chef' | 'support' | 'admin'
  city?: string
  lang?: string
}): Promise<number> {
  const existing = await db.select({ id: users.id }).from(users)
    .where(eq(users.telegramId, telegramId)).limit(1)
  if (existing[0]) return existing[0].id
  const [row] = await db.insert(users).values({ telegramId, ...data }).returning({ id: users.id })
  return row.id
}

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
    name: 'Нино Беридзе',
    city: 'Тбилиси',
    profile: {
      bio: 'Готовлю грузинскую кухню уже 12 лет. Специализируюсь на хинкали, хачапури и мясных блюдах на мангале. Приеду к вам домой или привезу готовое.',
      cuisineTags: ['Грузинская', 'Домашняя'],
      workFormats: ['home_visit', 'delivery'],
      districts: ['Ваке', 'Сабуртало', 'Мтацминда'],
      avgPrice: '120',
      ratingCache: '4.90',
      ordersCount: 47,
    },
  },
  {
    telegramId: 1000002,
    name: 'Тамара Кварацхелия',
    city: 'Тбилиси',
    profile: {
      bio: 'Домашняя аджарская кухня — моя страсть. Только натуральные продукты с рынка Дезертирка.',
      cuisineTags: ['Аджарская', 'Грузинская', 'Вегетарианская'],
      workFormats: ['delivery'],
      districts: ['Исани', 'Самгори', 'Надзаладеви'],
      avgPrice: '80',
      ratingCache: '4.70',
      ordersCount: 31,
    },
  },
  {
    telegramId: 1000003,
    name: 'Давит Чикованани',
    city: 'Тбилиси',
    profile: {
      bio: 'Профессиональный повар с 8-летним опытом в ресторанах. Европейская и грузинская кухня для ужинов у вас дома.',
      cuisineTags: ['Европейская', 'Грузинская', 'Fusion'],
      workFormats: ['home_visit'],
      districts: ['Ваке', 'Вера', 'Мтацминда'],
      avgPrice: '200',
      ratingCache: '4.80',
      ordersCount: 22,
    },
  },
  {
    telegramId: 1000004,
    name: 'Лали Гоголашвили',
    city: 'Тбилиси',
    profile: {
      bio: 'Пеку торты и готовлю десерты на заказ. Также делаю мегрельскую кухню — гебжалия, эларджи.',
      cuisineTags: ['Мегрельская', 'Грузинская', 'Десерты'],
      workFormats: ['delivery'],
      districts: ['Глдани', 'Дидубе', 'Чугурети'],
      avgPrice: '70',
      ratingCache: '4.60',
      ordersCount: 58,
    },
  },
  {
    telegramId: 1000005,
    name: 'Зураб Элиава',
    city: 'Батуми',
    profile: {
      bio: 'Морепродукты и рыба — мой конёк. Живу в Батуми всю жизнь, знаю лучших поставщиков.',
      cuisineTags: ['Морепродукты', 'Рыбная', 'Аджарская'],
      workFormats: ['home_visit', 'delivery'],
      districts: ['Центр', 'Старый город', 'Химшиашвили'],
      avgPrice: '150',
      ratingCache: '4.90',
      ordersCount: 35,
    },
  },
  {
    telegramId: 1000006,
    name: 'Манана Хурцидзе',
    city: 'Батуми',
    profile: {
      bio: 'Готовлю домашнюю еду с любовью. Лобиани, харчо, сациви — всё как у бабушки. Доставка по всему Батуми.',
      cuisineTags: ['Грузинская', 'Домашняя'],
      workFormats: ['delivery'],
      districts: ['Центр', 'Новый бульвар', 'Руставели'],
      avgPrice: '65',
      ratingCache: '4.50',
      ordersCount: 74,
    },
  },
  {
    telegramId: 1000007,
    name: 'Анна Попова',
    city: 'Тбилиси',
    profile: {
      bio: 'Русская и европейская кухня для русскоязычного комьюнити в Тбилиси. Борщ, пельмени, котлеты.',
      cuisineTags: ['Русская', 'Европейская', 'Домашняя'],
      workFormats: ['delivery', 'home_visit'],
      districts: ['Сабуртало', 'Дидгори', 'Ортачала'],
      avgPrice: '90',
      ratingCache: '4.70',
      ordersCount: 29,
    },
  },
  {
    telegramId: 1000008,
    name: 'Гиорги Табатадзе',
    city: 'Батуми',
    profile: {
      bio: 'Специализируюсь на барбекю и блюдах на огне. Идеально для вечеринок.',
      cuisineTags: ['BBQ', 'Мясная', 'Грузинская'],
      workFormats: ['home_visit'],
      districts: ['Центр', 'Старый город', 'Аэропорт'],
      avgPrice: '250',
      ratingCache: '5.00',
      ordersCount: 18,
    },
  },
]

// ─── Customers ────────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { telegramId: 2000001, name: 'Тестовый Заказчик 1', city: 'Тбилиси' },
  { telegramId: 2000002, name: 'Тестовый Заказчик 2', city: 'Тбилиси' },
]

// ─── Upsert helpers ───────────────────────────────────────────────────────────

async function ensureOrder(
  key: { customerId: number; chefId: number },
  data: {
    type: 'home_visit' | 'delivery'
    city: string
    district?: string
    address?: string
    scheduledAt: Date
    persons: number
    description?: string
    agreedPrice?: string
    status: 'draft' | 'awaiting_payment' | 'paid' | 'in_progress' | 'completed' | 'dispute_pending' | 'refunded' | 'cancelled'
  },
): Promise<number> {
  const existing = await db.select({ id: orders.id }).from(orders)
    .where(and(
      eq(orders.customerId, key.customerId),
      eq(orders.chefId, key.chefId),
      eq(orders.status, data.status),
    ))
    .limit(1)
  if (existing[0]) return existing[0].id

  const [row] = await db.insert(orders)
    .values({ ...key, ...data })
    .returning({ id: orders.id })
  return row.id
}

async function ensureReview(
  orderId: number,
  data: {
    authorId: number
    chefId: number
    rating: number
    tagsQuality?: string[]
    text?: string
    chefReply?: string
  },
): Promise<number> {
  const existing = await db.select({ id: reviews.id }).from(reviews)
    .where(eq(reviews.orderId, orderId)).limit(1)
  if (existing[0]) return existing[0].id

  const [row] = await db.insert(reviews).values({
    orderId,
    authorId: data.authorId,
    chefId: data.chefId,
    rating: data.rating,
    tagsQuality: data.tagsQuality ?? [],
    text: data.text,
    chefReply: data.chefReply,
  }).returning({ id: reviews.id })
  return row.id
}

async function ensureDispute(
  orderId: number,
  data: {
    openedBy: 'customer' | 'chef'
    reasonCode: string
    description?: string
    status: 'open' | 'awaiting_other_party' | 'support_review' | 'resolved'
  },
): Promise<number> {
  const existing = await db.select({ id: disputes.id }).from(disputes)
    .where(eq(disputes.orderId, orderId)).limit(1)
  if (existing[0]) return existing[0].id

  const [row] = await db.insert(disputes).values({
    orderId,
    openedBy: data.openedBy,
    reasonCode: data.reasonCode,
    description: data.description,
    status: data.status,
  }).returning({ id: disputes.id })
  return row.id
}

async function ensureRequest(
  customerId: number,
  data: {
    city: string
    district?: string
    scheduledAt: Date
    format: 'home_visit' | 'delivery'
    persons: number
    description?: string
    budget?: string
  },
): Promise<number> {
  const existing = await db.select({ id: requests.id }).from(requests)
    .where(and(
      eq(requests.customerId, customerId),
      eq(requests.format, data.format),
      eq(requests.status, 'open'),
    ))
    .limit(1)
  if (existing[0]) return existing[0].id

  const [row] = await db.insert(requests)
    .values({ customerId, ...data })
    .returning({ id: requests.id })
  return row.id
}

async function ensureResponse(
  requestId: number,
  chefId: number,
  data: { proposedPrice?: string; comment?: string },
): Promise<void> {
  const existing = await db.select({ id: chefResponses.id }).from(chefResponses)
    .where(and(eq(chefResponses.requestId, requestId), eq(chefResponses.chefId, chefId)))
    .limit(1)
  if (existing[0]) return

  await db.insert(chefResponses).values({
    requestId,
    chefId,
    proposedPrice: data.proposedPrice,
    comment: data.comment,
    status: 'new',
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Starting seed…\n')

  // ── Chefs ──────────────────────────────────────────────────────────────────
  console.log('Creating chefs…')
  const chefUserIds: number[]    = []
  const chefProfileIds: number[] = []

  for (const c of CHEFS) {
    const userId = await upsertUser(c.telegramId, { name: c.name, role: 'chef', city: c.city })
    chefUserIds.push(userId)

    const existing = await db.select({ id: chefProfiles.id }).from(chefProfiles)
      .where(eq(chefProfiles.userId, userId)).limit(1)

    if (existing[0]) {
      chefProfileIds.push(existing[0].id)
      console.log(`  skip  ${c.name}`)
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

    chefProfileIds.push(p.id)
    console.log(`  ✓  ${c.name}  userId=${userId}  profileId=${p.id}`)
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  console.log('\nCreating customers…')
  const customerIds: number[] = []

  for (const c of CUSTOMERS) {
    const id = await upsertUser(c.telegramId, { name: c.name, role: 'customer', city: c.city })
    customerIds.push(id)
    console.log(`  ✓  ${c.name}  userId=${id}`)
  }

  const [cust1, cust2]                    = customerIds
  const [chef1, chef2, chef3, , chef5Idx] = chefUserIds  // chef5Idx = Зураб (Батуми)
  void chef5Idx

  // ── Orders ─────────────────────────────────────────────────────────────────
  console.log('\nCreating orders…')

  const ord1 = await ensureOrder(
    { customerId: cust1, chefId: chef1 },
    {
      type: 'home_visit', city: 'Тбилиси', district: 'Ваке',
      address: 'ул. Пекинская, 15, кв. 3',
      scheduledAt: daysFromNow(1), persons: 4,
      description: 'Хочу хинкали и хачапури на семейный ужин',
      agreedPrice: '280', status: 'awaiting_payment',
    },
  )
  console.log(`  ✓  order #${ord1}  awaiting_payment`)

  const ord2 = await ensureOrder(
    { customerId: cust1, chefId: chef2 },
    {
      type: 'delivery', city: 'Тбилиси', district: 'Сабуртало',
      address: 'ул. Важа-Пшавела, 45',
      scheduledAt: daysFromNow(-1), persons: 2,
      description: 'Доставка аджарских хачапури и пхали',
      agreedPrice: '120', status: 'paid',
    },
  )
  console.log(`  ✓  order #${ord2}  paid`)

  const ord3 = await ensureOrder(
    { customerId: cust2, chefId: chef3 },
    {
      type: 'home_visit', city: 'Тбилиси', district: 'Вера',
      address: 'пр. Чавчавадзе, 12',
      scheduledAt: daysFromNow(-7), persons: 6,
      description: 'Ужин на 6 человек, европейское меню',
      agreedPrice: '600', status: 'completed',
    },
  )
  console.log(`  ✓  order #${ord3}  completed`)

  const ord4 = await ensureOrder(
    { customerId: cust2, chefId: chef1 },
    {
      type: 'home_visit', city: 'Тбилиси', district: 'Мтацминда',
      address: 'ул. Коте Месхи, 7',
      scheduledAt: daysFromNow(-3), persons: 3,
      agreedPrice: '220', status: 'dispute_pending',
    },
  )
  console.log(`  ✓  order #${ord4}  dispute_pending`)

  // Extra completed order needed for second review
  const ord5 = await ensureOrder(
    { customerId: cust1, chefId: chef2 },
    {
      type: 'delivery', city: 'Тбилиси',
      scheduledAt: daysFromNow(-14), persons: 2,
      agreedPrice: '90', status: 'completed',
    },
  )
  console.log(`  ✓  order #${ord5}  completed (for review)`)

  // ── Reviews ────────────────────────────────────────────────────────────────
  console.log('\nCreating reviews…')

  const rev1 = await ensureReview(ord3, {
    authorId: cust2, chefId: chef3, rating: 5,
    tagsQuality: ['вкус', 'подача', 'пунктуальность'],
    text: 'Давит — настоящий профессионал! Ужин прошёл великолепно, гости были в восторге от подачи и вкуса.',
  })
  console.log(`  ✓  review #${rev1}  rating=5  (order #${ord3})`)

  const rev2 = await ensureReview(ord5, {
    authorId: cust1, chefId: chef2, rating: 4,
    tagsQuality: ['вкус', 'порции'],
    text: 'Вкусно и быстро. Пхали идеальные, хачапури чуть остыли при доставке.',
    chefReply: 'Спасибо за отзыв! В следующий раз упакуем теплее 🙏',
  })
  console.log(`  ✓  review #${rev2}  rating=4  with chef reply  (order #${ord5})`)

  // ── Dispute ────────────────────────────────────────────────────────────────
  console.log('\nCreating dispute…')

  const dis1 = await ensureDispute(ord4, {
    openedBy: 'customer', reasonCode: 'bad_quality', status: 'support_review',
    description: 'Повар приготовил блюдо, которого не было в согласованном меню. Вместо хинкали был подан суп. Прошу вернуть часть средств.',
  })
  console.log(`  ✓  dispute #${dis1}  support_review  (order #${ord4})`)

  // ── Requests ───────────────────────────────────────────────────────────────
  console.log('\nCreating requests…')

  const req1 = await ensureRequest(cust1, {
    city: 'Тбилиси', district: 'Ваке',
    scheduledAt: daysFromNow(5),
    format: 'home_visit', persons: 8,
    description: 'Ищу повара для дня рождения. Нужны грузинские блюда: хинкали, хачапури, мцвади.',
    budget: '500',
  })
  await ensureResponse(req1, chef1, {
    proposedPrice: '450',
    comment: 'Готовлю такие блюда регулярно. Могу приехать чуть раньше для подготовки.',
  })
  await ensureResponse(req1, chef3, {
    proposedPrice: '480',
    comment: 'Предлагаю расширенное меню: хинкали, хачапури, мцвади + мезе на выбор.',
  })
  console.log(`  ✓  request #${req1}  2 responses`)

  const req2 = await ensureRequest(cust2, {
    city: 'Тбилиси', district: 'Сабуртало',
    scheduledAt: daysFromNow(3),
    format: 'delivery', persons: 3,
    description: 'Нужна доставка домашней еды. Предпочтительно вегетарианское меню.',
    budget: '150',
  })
  await ensureResponse(req2, chef2, {
    proposedPrice: '130',
    comment: 'Специализируюсь на вегетарианской грузинской кухне. Пхали, баклажаны, лобиани.',
  })
  console.log(`  ✓  request #${req2}  1 response`)

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('TEST ACCOUNTS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\nCustomers (role=customer):')
  CUSTOMERS.forEach((c, i) =>
    console.log(`  telegramId=${c.telegramId}  name="${c.name}"  userId=${customerIds[i]}`),
  )
  console.log('\nChefs (first 5, Тбилиси, role=chef):')
  CHEFS.slice(0, 5).forEach((c, i) =>
    console.log(`  telegramId=${c.telegramId}  name="${c.name}"  userId=${chefUserIds[i]}  profileId=${chefProfileIds[i]}`),
  )
  console.log('\nDev JWT endpoint (NODE_ENV=development):')
  console.log(`  curl http://localhost:3000/dev/token/${CUSTOMERS[0].telegramId}`)
  console.log(`  curl http://localhost:3000/dev/token/${CUSTOMERS[1].telegramId}`)
  console.log(`  curl http://localhost:3000/dev/token/${CHEFS[0].telegramId}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

seed()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => sql.end())
