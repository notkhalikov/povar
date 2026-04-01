import type { FastifyInstance } from 'fastify'
import { eq, and, sql, desc } from 'drizzle-orm'
import { reviews, orders, chefProfiles, users } from '../db/schema.js'

interface CreateReviewBody {
  orderId: number
  rating: number
  tagsQuality?: string[]
  text?: string
  photoIds?: string[]
}

interface ChefReviewsParams {
  id: number
}

interface ChefReviewsQuery {
  limit?: number
  offset?: number
}

interface ReplyBody {
  reply: string
}

export default async function reviewsRoutes(app: FastifyInstance) {

  // ─── POST /reviews ────────────────────────────────────────────────────────────
  // Authenticated (customer). Creates a review for a completed order.
  // One review per order. Updates chef's ratingCache.

  app.post<{ Body: CreateReviewBody }>('/reviews', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['orderId', 'rating'],
        additionalProperties: false,
        properties: {
          orderId:     { type: 'integer' },
          rating:      { type: 'integer', minimum: 1, maximum: 5 },
          tagsQuality: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          text:        { type: 'string', maxLength: 2000 },
          photoIds:    { type: 'array', items: { type: 'string' }, maxItems: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { orderId, rating, tagsQuality = [], text, photoIds = [] } = request.body

    // Order must exist, be completed, and the caller must be the customer
    const [order] = await app.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, userId)))
      .limit(1)

    if (!order) return reply.code(404).send({ error: 'Order not found' })
    if (order.status !== 'completed') {
      return reply.code(422).send({ error: 'Can only review a completed order' })
    }

    // Check no existing review for this order
    const [existing] = await app.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.orderId, orderId))
      .limit(1)

    if (existing) {
      return reply.code(409).send({ error: 'Review for this order already exists' })
    }

    const [created] = await app.db
      .insert(reviews)
      .values({
        orderId,
        authorId: userId,
        chefId: order.chefId,
        rating,
        tagsQuality,
        text,
        photoIds,
      })
      .returning()

    // Recalculate chef's ratingCache as true average
    const [stats] = await app.db
      .select({ avg: sql<string>`avg(${reviews.rating})` })
      .from(reviews)
      .where(eq(reviews.chefId, order.chefId))

    const newRating = Number(stats?.avg ?? 0).toFixed(2)

    await app.db
      .update(chefProfiles)
      .set({ ratingCache: newRating })
      .where(eq(chefProfiles.userId, order.chefId))

    return reply.code(201).send(created)
  })

  // ─── GET /chefs/:id/reviews ───────────────────────────────────────────────────
  // Public. Returns paginated reviews for a chef profile.

  app.get<{ Params: ChefReviewsParams; Querystring: ChefReviewsQuery }>('/chefs/:id/reviews', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
      querystring: {
        type: 'object',
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const { limit = 10, offset = 0 } = request.query

    // Resolve chefProfile.id → users.id
    const [profile] = await app.db
      .select({ userId: chefProfiles.userId })
      .from(chefProfiles)
      .where(eq(chefProfiles.id, id))
      .limit(1)

    if (!profile) return reply.code(404).send({ error: 'Chef not found' })

    const rows = await app.db
      .select({
        id:          reviews.id,
        orderId:     reviews.orderId,
        rating:      reviews.rating,
        tagsQuality: reviews.tagsQuality,
        text:        reviews.text,
        photoIds:    reviews.photoIds,
        chefReply:   reviews.chefReply,
        createdAt:   reviews.createdAt,
        authorName:  users.name,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.authorId))
      .where(and(eq(reviews.chefId, profile.userId), eq(reviews.isHidden, false)))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset)

    const [{ total }] = await app.db
      .select({ total: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.chefId, profile.userId), eq(reviews.isHidden, false)))

    return { data: rows, total, limit, offset }
  })

  // ─── PATCH /reviews/:id/reply ─────────────────────────────────────────────────
  // Chef only. Add or update a reply to a review left on their profile.

  app.patch<{ Params: { id: number }; Body: ReplyBody }>('/reviews/:id/reply', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        required: ['reply'],
        additionalProperties: false,
        properties: {
          reply: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const role = request.user.role
    const { id } = request.params
    const { reply: replyText } = request.body

    if (role !== 'chef') {
      return reply.code(403).send({ error: 'Only chefs can reply to reviews' })
    }

    // Verify this review belongs to the requesting chef
    const [profile] = await app.db
      .select({ userId: chefProfiles.userId })
      .from(chefProfiles)
      .where(eq(chefProfiles.userId, userId))
      .limit(1)

    if (!profile) return reply.code(404).send({ error: 'Chef profile not found' })

    const [review] = await app.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.id, id), eq(reviews.chefId, userId)))
      .limit(1)

    if (!review) return reply.code(404).send({ error: 'Review not found' })

    const [updated] = await app.db
      .update(reviews)
      .set({ chefReply: replyText })
      .where(eq(reviews.id, id))
      .returning()

    return updated
  })

  // ─── POST /reviews/:id/report ─────────────────────────────────────────────────
  // Authenticated. Flag a review for admin moderation. Increments reportCount.

  app.post<{ Params: { id: number } }>('/reviews/:id/report', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params

    const [review] = await app.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1)

    if (!review) return reply.code(404).send({ error: 'Review not found' })

    await app.db
      .update(reviews)
      .set({ reportCount: sql`${reviews.reportCount} + 1` })
      .where(eq(reviews.id, id))

    return reply.code(204).send()
  })
}
