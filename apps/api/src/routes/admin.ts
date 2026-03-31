import type { FastifyInstance } from 'fastify'
import { eq, and, gte, lte, desc, sql, count, sum } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { users, orders, disputes, reviews, chefProfiles } from '../db/schema.js'

// ─── Query interfaces ─────────────────────────────────────────────────────────

interface UsersQuery {
  role?: string
  status?: string
  limit?: number
  offset?: number
}

interface OrdersQuery {
  status?: string
  city?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

interface DisputesQuery {
  status?: string
  limit?: number
  offset?: number
}

interface ReviewsQuery {
  flagged?: string
  limit?: number
  offset?: number
}

interface StatsQuery {
  from?:      string
  to?:        string
  city?:      string
  utmSource?: string
}

interface PatchUserStatusBody {
  status: 'active' | 'banned'
}

interface ResolveDisputeBody {
  resolutionType: 'full_refund' | 'partial_refund' | 'no_refund'
  resolutionComment?: string
}

// ─── Access guard ─────────────────────────────────────────────────────────────

function isAdminOrSupport(role: string) {
  return role === 'admin' || role === 'support'
}

export default async function adminRoutes(app: FastifyInstance) {
  /**
   * GET /admin/users
   * Admin/support. Paginated user list with optional role/status filters.
   */
  app.get<{ Querystring: UsersQuery }>('/admin/users', {
    onRequest: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          role:   { type: 'string' },
          status: { type: 'string' },
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    if (!isAdminOrSupport(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const { role, status, limit = 50, offset = 0 } = request.query

    const conditions = []
    if (role)   conditions.push(sql`${users.role}::text = ${role}`)
    if (status) conditions.push(sql`${users.status}::text = ${status}`)

    const rows = await app.db
      .select({
        id:         users.id,
        telegramId: users.telegramId,
        name:       users.name,
        role:       users.role,
        status:     users.status,
        city:       users.city,
        createdAt:  users.createdAt,
      })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset)

    return { data: rows, limit, offset }
  })

  /**
   * PATCH /admin/users/:id/status
   * Admin/support. Bans or unbans a user.
   */
  app.patch<{ Params: { id: number }; Body: PatchUserStatusBody }>('/admin/users/:id/status', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['active', 'banned'] },
        },
      },
    },
  }, async (request, reply) => {
    if (!isAdminOrSupport(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const { id } = request.params
    const { status } = request.body

    const [updated] = await app.db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, status: users.status })

    if (!updated) return reply.code(404).send({ error: 'User not found' })
    return updated
  })

  /**
   * GET /admin/orders
   * Admin/support. Paginated order list with optional filters.
   */
  app.get<{ Querystring: OrdersQuery }>('/admin/orders', {
    onRequest: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          city:   { type: 'string' },
          from:   { type: 'string' },
          to:     { type: 'string' },
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    if (!isAdminOrSupport(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const { status, city, from, to, limit = 50, offset = 0 } = request.query

    const customerUser = alias(users, 'customer_user')
    const chefUser     = alias(users, 'chef_user')

    const conditions = []
    if (status) conditions.push(sql`${orders.status}::text = ${status}`)
    if (city)   conditions.push(eq(orders.city, city))
    if (from)   conditions.push(gte(orders.createdAt, new Date(from)))
    if (to)     conditions.push(lte(orders.createdAt, new Date(to)))

    const rows = await app.db
      .select({
        id:           orders.id,
        status:       orders.status,
        type:         orders.type,
        city:         orders.city,
        district:     orders.district,
        scheduledAt:  orders.scheduledAt,
        agreedPrice:  orders.agreedPrice,
        persons:      orders.persons,
        createdAt:    orders.createdAt,
        customerName: customerUser.name,
        chefName:     chefUser.name,
        customerId:   orders.customerId,
        chefId:       orders.chefId,
      })
      .from(orders)
      .innerJoin(customerUser, eq(customerUser.id, orders.customerId))
      .innerJoin(chefUser,     eq(chefUser.id,     orders.chefId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset)

    return { data: rows, limit, offset }
  })

  /**
   * GET /admin/disputes
   * Admin/support. Paginated dispute list with party names.
   */
  app.get<{ Querystring: DisputesQuery }>('/admin/disputes', {
    onRequest: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit:  { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    if (!isAdminOrSupport(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const { status, limit = 50, offset = 0 } = request.query

    const customerUser = alias(users, 'customer_user')
    const chefUser     = alias(users, 'chef_user')

    const conditions = []
    if (status) conditions.push(sql`${disputes.status}::text = ${status}`)

    const rows = await app.db
      .select({
        id:                disputes.id,
        orderId:           disputes.orderId,
        openedBy:          disputes.openedBy,
        reasonCode:        disputes.reasonCode,
        description:       disputes.description,
        status:            disputes.status,
        resolutionType:    disputes.resolutionType,
        resolutionComment: disputes.resolutionComment,
        createdAt:         disputes.createdAt,
        updatedAt:         disputes.updatedAt,
        customerName:      customerUser.name,
        chefName:          chefUser.name,
        customerId:        orders.customerId,
        chefId:            orders.chefId,
      })
      .from(disputes)
      .innerJoin(orders,       eq(orders.id,       disputes.orderId))
      .innerJoin(customerUser, eq(customerUser.id, orders.customerId))
      .innerJoin(chefUser,     eq(chefUser.id,     orders.chefId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(disputes.createdAt))
      .limit(limit)
      .offset(offset)

    return { data: rows, limit, offset }
  })

  /**
   * PATCH /admin/disputes/:id/resolve
   * Support/admin only. Delegates to core resolve logic (duplicated here for the admin prefix).
   */
  app.patch<{ Params: { id: number }; Body: ResolveDisputeBody }>('/admin/disputes/:id/resolve', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        required: ['resolutionType'],
        additionalProperties: false,
        properties: {
          resolutionType:    { type: 'string', enum: ['full_refund', 'partial_refund', 'no_refund'] },
          resolutionComment: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (request, reply) => {
    if (!isAdminOrSupport(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const { id } = request.params
    const { resolutionType, resolutionComment } = request.body

    const [dispute] = await app.db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1)

    if (!dispute)                    return reply.code(404).send({ error: 'Dispute not found' })
    if (dispute.status === 'resolved') return reply.code(422).send({ error: 'Already resolved' })

    const finalOrderStatus = resolutionType === 'no_refund' ? 'completed' : 'refunded'

    await app.db
      .update(orders)
      .set({ status: finalOrderStatus, updatedAt: new Date() })
      .where(eq(orders.id, dispute.orderId))

    const [resolved] = await app.db
      .update(disputes)
      .set({ status: 'resolved', resolutionType, resolutionComment, updatedAt: new Date() })
      .where(eq(disputes.id, id))
      .returning()

    return resolved
  })

  /**
   * GET /admin/reviews
   * Admin/support. Returns reviews for moderation (newest first).
   */
  app.get<{ Querystring: ReviewsQuery }>('/admin/reviews', {
    onRequest: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          flagged: { type: 'string' },
          limit:   { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset:  { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    if (!isAdminOrSupport(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }
    const { limit = 50, offset = 0 } = request.query

    const authorUser = alias(users, 'author_user')

    const rows = await app.db
      .select({
        id:          reviews.id,
        orderId:     reviews.orderId,
        chefId:      reviews.chefId,
        rating:      reviews.rating,
        tagsQuality: reviews.tagsQuality,
        text:        reviews.text,
        createdAt:   reviews.createdAt,
        authorName:  authorUser.name,
      })
      .from(reviews)
      .innerJoin(authorUser, eq(authorUser.id, reviews.authorId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset)

    return { data: rows, limit, offset }
  })

  /**
   * GET /admin/stats
   * Admin/support. Returns aggregate metrics + UTM/city breakdowns.
   * Optional filters: from, to (ISO dates), city, utmSource.
   */
  app.get<{ Querystring: StatsQuery }>('/admin/stats', {
    onRequest: [app.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from:      { type: 'string' },
          to:        { type: 'string' },
          city:      { type: 'string' },
          utmSource: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (!isAdminOrSupport(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const { from, to, city, utmSource } = request.query

    // Build date + city conditions for orders table
    const orderConditions = []
    if (from) orderConditions.push(gte(orders.createdAt, new Date(from)))
    if (to)   orderConditions.push(lte(orders.createdAt, new Date(to)))
    if (city) orderConditions.push(eq(orders.city, city))

    // Condition applied to users join for UTM filter
    const utmCondition = utmSource
      ? sql`${users.utmSource} = ${utmSource}`
      : undefined

    const baseOrderWhere = orderConditions.length ? and(...orderConditions) : undefined

    // Orders joined with customers for UTM filter
    const orderWithUtmWhere = () => {
      const parts = [...orderConditions]
      if (utmCondition) parts.push(utmCondition)
      return parts.length ? and(...parts) : undefined
    }

    const [
      totalOrdersRow,
      revenueRow,
      homeVisitRow,
      deliveryRow,
      disputesRow,
      openDisputesRow,
      chefsRow,
      usersRow,
      byCityRows,
      byUtmRows,
    ] = await Promise.all([
      // totals (filtered)
      app.db.select({ n: count() }).from(orders)
        .innerJoin(users, eq(users.id, orders.customerId))
        .where(orderWithUtmWhere()),

      app.db.select({ total: sum(orders.agreedPrice) })
        .from(orders)
        .innerJoin(users, eq(users.id, orders.customerId))
        .where(and(
          sql`${orders.status}::text IN ('completed', 'refunded')`,
          ...(orderConditions.length ? orderConditions : []),
          ...(utmCondition ? [utmCondition] : []),
        )),

      app.db.select({ n: count() }).from(orders)
        .innerJoin(users, eq(users.id, orders.customerId))
        .where(and(sql`${orders.type}::text = 'home_visit'`, orderWithUtmWhere())),

      app.db.select({ n: count() }).from(orders)
        .innerJoin(users, eq(users.id, orders.customerId))
        .where(and(sql`${orders.type}::text = 'delivery'`, orderWithUtmWhere())),

      // disputes unfiltered
      app.db.select({ n: count() }).from(disputes),
      app.db.select({ n: count() }).from(disputes)
        .where(sql`${disputes.status}::text != 'resolved'`),

      // chefs & users unfiltered
      app.db.select({ n: count() }).from(chefProfiles)
        .where(eq(chefProfiles.verificationStatus, 'approved')),
      app.db.select({ n: count() }).from(users),

      // orders_by_city
      app.db
        .select({
          city:    orders.city,
          count:   count(),
          revenue: sum(orders.agreedPrice),
        })
        .from(orders)
        .innerJoin(users, eq(users.id, orders.customerId))
        .where(and(
          sql`${orders.status}::text IN ('completed', 'refunded')`,
          ...(orderConditions.length ? orderConditions : []),
          ...(utmCondition ? [utmCondition] : []),
        ))
        .groupBy(orders.city)
        .orderBy(desc(count())),

      // orders_by_utm
      app.db
        .select({
          utmSource: users.utmSource,
          count:     count(),
          revenue:   sum(orders.agreedPrice),
        })
        .from(orders)
        .innerJoin(users, eq(users.id, orders.customerId))
        .where(and(
          sql`${orders.status}::text IN ('completed', 'refunded')`,
          ...(orderConditions.length ? orderConditions : []),
        ))
        .groupBy(users.utmSource)
        .orderBy(desc(count())),
    ])

    // Funnel: registered / paid
    const registeredRow  = await app.db.select({ n: count() }).from(users)
    const createdOrderRow = await app.db.select({ n: count() }).from(orders)
      .where(baseOrderWhere)
    const paidOrderRow   = await app.db.select({ n: count() }).from(orders)
      .where(and(
        sql`${orders.status}::text IN ('paid', 'in_progress', 'completed', 'refunded')`,
        ...(orderConditions.length ? orderConditions : []),
      ))

    return {
      totalOrders:   Number(totalOrdersRow[0]?.n ?? 0),
      totalRevenue:  Number(revenueRow[0]?.total ?? 0),
      ordersByType: {
        home_visit: Number(homeVisitRow[0]?.n ?? 0),
        delivery:   Number(deliveryRow[0]?.n ?? 0),
      },
      totalDisputes:  Number(disputesRow[0]?.n ?? 0),
      openDisputes:   Number(openDisputesRow[0]?.n ?? 0),
      approvedChefs:  Number(chefsRow[0]?.n ?? 0),
      totalUsers:     Number(usersRow[0]?.n ?? 0),
      ordersByCity: byCityRows.map(r => ({
        city:    r.city,
        count:   Number(r.count),
        revenue: Number(r.revenue ?? 0),
      })),
      ordersByUtm: byUtmRows.map(r => ({
        utmSource: r.utmSource ?? '(прямой)',
        count:     Number(r.count),
        revenue:   Number(r.revenue ?? 0),
      })),
      funnel: {
        registered:   Number(registeredRow[0]?.n ?? 0),
        createdOrder: Number(createdOrderRow[0]?.n ?? 0),
        paidOrder:    Number(paidOrderRow[0]?.n ?? 0),
      },
    }
  })

  /**
   * GET /admin/export/orders.csv
   * Admin/support. Streams all orders as CSV. Auth via ?token= query param.
   */
  app.get<{ Querystring: { token?: string } }>('/admin/export/orders.csv', {
    schema: {
      querystring: {
        type: 'object',
        properties: { token: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    // Accept JWT from query param since this is a direct browser download link
    const token = request.headers.authorization?.replace('Bearer ', '') ||
                  request.query.token
    if (!token) return reply.code(401).send({ error: 'Unauthorized' })

    let payload: { role?: string }
    try {
      payload = app.jwt.verify(token) as { role?: string }
    } catch {
      return reply.code(401).send({ error: 'Invalid token' })
    }
    if (!isAdminOrSupport(payload.role ?? '')) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const customerUser = alias(users, 'customer_user')
    const chefUser     = alias(users, 'chef_user')

    const rows = await app.db
      .select({
        id:           orders.id,
        status:       orders.status,
        type:         orders.type,
        city:         orders.city,
        district:     orders.district,
        scheduledAt:  orders.scheduledAt,
        agreedPrice:  orders.agreedPrice,
        persons:      orders.persons,
        createdAt:    orders.createdAt,
        customerName: customerUser.name,
        chefName:     chefUser.name,
      })
      .from(orders)
      .innerJoin(customerUser, eq(customerUser.id, orders.customerId))
      .innerJoin(chefUser,     eq(chefUser.id,     orders.chefId))
      .orderBy(desc(orders.createdAt))

    const header = 'id,status,type,city,district,scheduledAt,agreedPrice,persons,customerName,chefName,createdAt'
    const csvRows = rows.map(r =>
      [
        r.id, r.status, r.type, r.city,
        r.district ?? '',
        r.scheduledAt.toISOString(),
        r.agreedPrice ?? '',
        r.persons,
        csvEscape(r.customerName),
        csvEscape(r.chefName),
        r.createdAt.toISOString(),
      ].join(',')
    )

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="orders.csv"')
    return reply.send('\uFEFF' + [header, ...csvRows].join('\n'))
  })

  /**
   * GET /admin/export/users.csv
   * Admin/support. Streams all users as CSV. Auth via ?token= query param.
   */
  app.get<{ Querystring: { token?: string } }>('/admin/export/users.csv', {
    schema: {
      querystring: {
        type: 'object',
        properties: { token: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '') ||
                  request.query.token
    if (!token) return reply.code(401).send({ error: 'Unauthorized' })

    let payload: { role?: string }
    try {
      payload = app.jwt.verify(token) as { role?: string }
    } catch {
      return reply.code(401).send({ error: 'Invalid token' })
    }
    if (!isAdminOrSupport(payload.role ?? '')) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const rows = await app.db
      .select({
        id:          users.id,
        telegramId:  users.telegramId,
        name:        users.name,
        role:        users.role,
        status:      users.status,
        city:        users.city,
        utmSource:   users.utmSource,
        utmMedium:   users.utmMedium,
        utmCampaign: users.utmCampaign,
        utmContent:  users.utmContent,
        utmTerm:     users.utmTerm,
        createdAt:   users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))

    const header = 'id,telegramId,name,role,status,city,utmSource,utmMedium,utmCampaign,utmContent,utmTerm,createdAt'
    const csvRows = rows.map(r =>
      [
        r.id, r.telegramId,
        csvEscape(r.name),
        r.role, r.status,
        r.city ?? '',
        r.utmSource   ?? '',
        r.utmMedium   ?? '',
        r.utmCampaign ?? '',
        r.utmContent  ?? '',
        r.utmTerm     ?? '',
        r.createdAt.toISOString(),
      ].join(',')
    )

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="users.csv"')
    return reply.send('\uFEFF' + [header, ...csvRows].join('\n'))
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
