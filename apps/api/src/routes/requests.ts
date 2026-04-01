import type { FastifyInstance } from 'fastify'
import { eq, and, or, sql, desc } from 'drizzle-orm'
import { requests, chefResponses, chefProfiles, orders, users } from '../db/schema.js'
import { notifyNewResponse } from '../services/notify.js'

const MAX_RESPONSES_PER_REQUEST = 5

interface CreateRequestBody {
  city: string
  district?: string
  scheduledAt: string
  format: 'home_visit' | 'delivery'
  persons: number
  description?: string
  budget?: number
}

interface RespondBody {
  proposedPrice?: number
  comment?: string
}

interface AcceptResponseParams {
  id: number
  responseId: number
}

export default async function requestsRoutes(app: FastifyInstance) {

  // ─── POST /requests ───────────────────────────────────────────────────────────
  // Authenticated. Customer creates an open request for chef matching.

  app.post<{ Body: CreateRequestBody }>('/requests', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['city', 'scheduledAt', 'format', 'persons'],
        additionalProperties: false,
        properties: {
          city:        { type: 'string', minLength: 1, maxLength: 100 },
          district:    { type: 'string', maxLength: 100 },
          scheduledAt: { type: 'string' },
          format:      { type: 'string', enum: ['home_visit', 'delivery'] },
          persons:     { type: 'integer', minimum: 1, maximum: 50 },
          description: { type: 'string', maxLength: 2000 },
          budget:      { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const customerId = request.user.sub
    const { city, district, scheduledAt, format, persons, description, budget } = request.body

    const [created] = await app.db
      .insert(requests)
      .values({
        customerId,
        city,
        district,
        scheduledAt: new Date(scheduledAt),
        format,
        persons,
        description,
        budget: budget !== undefined ? String(budget) : undefined,
        status: 'open',
      })
      .returning()

    return reply.code(201).send(created)
  })

  // ─── GET /requests ────────────────────────────────────────────────────────────
  // Authenticated.
  // Customer → their own requests with response counts.
  // Chef     → open requests matching their city and work formats.

  app.get('/requests', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const userId = request.user.sub
    const role = request.user.role

    if (role === 'chef') {
      // Fetch chef's city and formats for geo/format matching
      const [profile] = await app.db
        .select({
          city:        users.city,
          workFormats: chefProfiles.workFormats,
          isActive:    chefProfiles.isActive,
        })
        .from(chefProfiles)
        .innerJoin(users, eq(users.id, chefProfiles.userId))
        .where(eq(chefProfiles.userId, userId))
        .limit(1)

      if (!profile || !profile.isActive) return { data: [] }

      const rows = await app.db
        .select({
          id:          requests.id,
          city:        requests.city,
          district:    requests.district,
          scheduledAt: requests.scheduledAt,
          format:      requests.format,
          persons:     requests.persons,
          description: requests.description,
          budget:      requests.budget,
          status:      requests.status,
          createdAt:   requests.createdAt,
          responseCount: sql<number>`(
            SELECT count(*)::int FROM chef_responses r WHERE r.request_id = ${requests.id}
          )`,
          hasResponded: sql<boolean>`EXISTS(
            SELECT 1 FROM chef_responses r
            WHERE r.request_id = ${requests.id} AND r.chef_id = ${userId}
          )`,
        })
        .from(requests)
        .where(
          and(
            eq(requests.status, 'open'),
            profile.city ? eq(requests.city, profile.city) : sql`1=1`,
            profile.workFormats.length > 0
              ? sql`${requests.format}::text = ANY(${profile.workFormats})`
              : sql`1=1`,
          ),
        )
        .orderBy(desc(requests.createdAt))

      return { data: rows }
    }

    // Customer — own requests
    const rows = await app.db
      .select({
        id:          requests.id,
        city:        requests.city,
        district:    requests.district,
        scheduledAt: requests.scheduledAt,
        format:      requests.format,
        persons:     requests.persons,
        description: requests.description,
        budget:      requests.budget,
        status:      requests.status,
        createdAt:   requests.createdAt,
        responseCount: sql<number>`(
          SELECT count(*)::int FROM chef_responses r WHERE r.request_id = ${requests.id}
        )`,
      })
      .from(requests)
      .where(eq(requests.customerId, userId))
      .orderBy(desc(requests.createdAt))

    return { data: rows }
  })

  // ─── GET /requests/:id ────────────────────────────────────────────────────────
  // Authenticated. Returns request details + all responses with chef name & rating.

  app.get<{ Params: { id: number } }>('/requests/:id', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const role = request.user.role
    const { id } = request.params

    const [req] = await app.db
      .select()
      .from(requests)
      .where(eq(requests.id, id))
      .limit(1)

    if (!req) return reply.code(404).send({ error: 'Request not found' })

    // Access: customer who owns it, any chef, or admin/support
    if (role === 'customer' && req.customerId !== userId) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const responses = await app.db
      .select({
        id:              chefResponses.id,
        chefId:          chefResponses.chefId,
        chefProfileId:   chefProfiles.id,
        proposedPrice:   chefResponses.proposedPrice,
        comment:         chefResponses.comment,
        status:          chefResponses.status,
        createdAt:       chefResponses.createdAt,
        chefName:        users.name,
        ratingCache:     chefProfiles.ratingCache,
      })
      .from(chefResponses)
      .innerJoin(users, eq(users.id, chefResponses.chefId))
      .innerJoin(chefProfiles, eq(chefProfiles.userId, chefResponses.chefId))
      .where(eq(chefResponses.requestId, id))
      .orderBy(desc(chefResponses.createdAt))

    return { ...req, responses }
  })

  // ─── POST /requests/:id/respond ───────────────────────────────────────────────
  // Chef only. Creates a response. Max 5 responses per request, no duplicates.

  app.post<{ Params: { id: number }; Body: RespondBody }>('/requests/:id/respond', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          proposedPrice: { type: 'number', minimum: 0 },
          comment:       { type: 'string', maxLength: 1000 },
        },
      },
    },
  }, async (request, reply) => {
    const chefId = request.user.sub
    const role = request.user.role
    const { id } = request.params
    const { proposedPrice, comment } = request.body

    if (role !== 'chef') {
      return reply.code(403).send({ error: 'Only chefs can respond to requests' })
    }

    // Block inactive chefs from responding
    const [chefProfile] = await app.db
      .select({ isActive: chefProfiles.isActive })
      .from(chefProfiles)
      .where(eq(chefProfiles.userId, chefId))
      .limit(1)

    if (!chefProfile?.isActive) {
      return reply.code(422).send({ error: 'Your profile is currently inactive' })
    }

    const [req] = await app.db
      .select()
      .from(requests)
      .where(eq(requests.id, id))
      .limit(1)

    if (!req) return reply.code(404).send({ error: 'Request not found' })
    if (req.status !== 'open') return reply.code(422).send({ error: 'Request is closed' })

    // No duplicate response from same chef
    const [existing] = await app.db
      .select({ id: chefResponses.id })
      .from(chefResponses)
      .where(and(eq(chefResponses.requestId, id), eq(chefResponses.chefId, chefId)))
      .limit(1)

    if (existing) return reply.code(409).send({ error: 'Already responded to this request' })

    // Max 5 responses cap
    const [{ count }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefResponses)
      .where(eq(chefResponses.requestId, id))

    if (count >= MAX_RESPONSES_PER_REQUEST) {
      return reply.code(422).send({ error: `Maximum ${MAX_RESPONSES_PER_REQUEST} responses reached` })
    }

    const [response] = await app.db
      .insert(chefResponses)
      .values({
        requestId:     id,
        chefId,
        proposedPrice: proposedPrice !== undefined ? String(proposedPrice) : undefined,
        comment,
        status:        'new',
      })
      .returning()

    // Notify customer about new response (fire-and-forget)
    const [customerUser, chefUser] = await Promise.all([
      app.db.select({ telegramId: users.telegramId }).from(users).where(eq(users.id, req.customerId)).limit(1),
      app.db.select({ name: users.name }).from(users).where(eq(users.id, chefId)).limit(1),
    ])

    if (customerUser[0] && chefUser[0]) {
      notifyNewResponse(req, response, customerUser[0].telegramId, chefUser[0].name)
        .catch(err => app.log.warn({ err }, 'notify new response failed'))
    }

    return reply.code(201).send(response)
  })

  // ─── POST /requests/:id/accept-response/:responseId ──────────────────────────
  // Customer only. Accepts one chef response, automatically creates an order,
  // marks all responses as rejected (except accepted), closes request.

  app.post<{ Params: AcceptResponseParams }>('/requests/:id/accept-response/:responseId', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id', 'responseId'],
        properties: {
          id:         { type: 'integer' },
          responseId: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const customerId = request.user.sub
    const { id, responseId } = request.params

    const [req] = await app.db
      .select()
      .from(requests)
      .where(and(eq(requests.id, id), eq(requests.customerId, customerId)))
      .limit(1)

    if (!req) return reply.code(404).send({ error: 'Request not found' })
    if (req.status !== 'open') return reply.code(422).send({ error: 'Request is already closed' })

    const [response] = await app.db
      .select()
      .from(chefResponses)
      .where(and(eq(chefResponses.id, responseId), eq(chefResponses.requestId, id)))
      .limit(1)

    if (!response) return reply.code(404).send({ error: 'Response not found' })

    // Create order from request + response data
    const [order] = await app.db
      .insert(orders)
      .values({
        customerId,
        chefId:      response.chefId,
        type:        req.format,
        city:        req.city,
        district:    req.district ?? undefined,
        scheduledAt: req.scheduledAt,
        persons:     req.persons,
        description: req.description ?? undefined,
        agreedPrice: response.proposedPrice ?? undefined,
        status:      'awaiting_payment',
      })
      .returning()

    // Mark accepted response, reject others
    await app.db
      .update(chefResponses)
      .set({ status: 'accepted' })
      .where(eq(chefResponses.id, responseId))

    await app.db
      .update(chefResponses)
      .set({ status: 'rejected' })
      .where(
        and(
          eq(chefResponses.requestId, id),
          sql`${chefResponses.id} != ${responseId}`,
        ),
      )

    // Close request
    await app.db
      .update(requests)
      .set({ status: 'closed' })
      .where(eq(requests.id, id))

    return reply.code(201).send({ orderId: order.id })
  })

  // ─── PATCH /requests/:id/close ────────────────────────────────────────────────
  // Customer only. Manually closes a request without accepting any response.

  app.patch<{ Params: { id: number } }>('/requests/:id/close', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const customerId = request.user.sub
    const { id } = request.params

    const [req] = await app.db
      .select()
      .from(requests)
      .where(and(eq(requests.id, id), eq(requests.customerId, customerId)))
      .limit(1)

    if (!req) return reply.code(404).send({ error: 'Request not found' })
    if (req.status === 'closed') return reply.code(422).send({ error: 'Already closed' })

    const [updated] = await app.db
      .update(requests)
      .set({ status: 'closed' })
      .where(eq(requests.id, id))
      .returning()

    return updated
  })
}
