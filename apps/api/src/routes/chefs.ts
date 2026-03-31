import type { FastifyInstance } from 'fastify'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { chefProfiles, users } from '../db/schema.js'
import type { WorkFormat } from '../types/index.js'

const BOT_TOKEN = process.env.BOT_TOKEN!

interface ChefsQuery {
  city?: string
  district?: string
  cuisine?: string
  format?: WorkFormat
  sort?: 'rating' | 'price'
  limit?: number
  offset?: number
}

interface ChefParams {
  id: number
}

interface PhotoParams {
  id: number
  fileId: string
}

interface PortfolioBody {
  mediaIds: string[]
}

interface UploadBody {
  data: string     // base64-encoded image
  mimeType: string
}

interface PatchChefBody {
  bio?: string
  cuisineTags?: string[]
  workFormats?: WorkFormat[]
  districts?: string[]
  avgPrice?: number
  isActive?: boolean
  portfolioMediaIds?: string[]
}

// Columns returned in list and detail responses
const chefSelectFields = {
  id: chefProfiles.id,
  userId: chefProfiles.userId,
  name: users.name,
  city: users.city,
  bio: chefProfiles.bio,
  cuisineTags: chefProfiles.cuisineTags,
  workFormats: chefProfiles.workFormats,
  districts: chefProfiles.districts,
  avgPrice: chefProfiles.avgPrice,
  ratingCache: chefProfiles.ratingCache,
  ordersCount: chefProfiles.ordersCount,
  verificationStatus: chefProfiles.verificationStatus,
}

export default async function chefsRoutes(app: FastifyInstance) {
  /**
   * GET /chefs
   * Public. Returns active, approved chefs with optional filters.
   *
   * Query: city, district, cuisine, format, sort (rating|price), limit, offset
   */
  app.get<{ Querystring: ChefsQuery }>('/chefs', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          city:     { type: 'string' },
          district: { type: 'string' },
          cuisine:  { type: 'string' },
          format:   { type: 'string', enum: ['home_visit', 'delivery'] },
          sort:     { type: 'string', enum: ['rating', 'price'] },
          limit:    { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset:   { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const {
      city,
      district,
      cuisine,
      format,
      sort = 'rating',
      limit = 20,
      offset = 0,
    } = request.query

    const conditions = [
      eq(chefProfiles.isActive, true),
      eq(chefProfiles.verificationStatus, 'approved'),
    ]

    if (city)     conditions.push(eq(users.city, city))
    if (district) conditions.push(sql`${chefProfiles.districts} @> ARRAY[${district}]::text[]`)
    if (cuisine)  conditions.push(sql`${chefProfiles.cuisineTags} @> ARRAY[${cuisine}]::text[]`)
    if (format)   conditions.push(sql`${chefProfiles.workFormats} @> ARRAY[${format}]::text[]`)

    const orderBy = sort === 'price'
      ? asc(chefProfiles.avgPrice)
      : desc(chefProfiles.ratingCache)

    const rows = await app.db
      .select(chefSelectFields)
      .from(chefProfiles)
      .innerJoin(users, eq(chefProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    return { data: rows, limit, offset }
  })

  /**
   * GET /chefs/me
   * Authenticated. Returns the caller's own chef profile (404 if not created yet).
   */
  app.get('/chefs/me', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.sub

    const [row] = await app.db
      .select({
        ...chefSelectFields,
        isActive: chefProfiles.isActive,
        portfolioMediaIds: chefProfiles.portfolioMediaIds,
      })
      .from(chefProfiles)
      .innerJoin(users, eq(chefProfiles.userId, users.id))
      .where(eq(chefProfiles.userId, userId))
      .limit(1)

    if (!row) return reply.code(404).send({ error: 'Chef profile not found' })

    return row
  })

  /**
   * GET /chefs/:id
   * Public. Returns full chef profile including portfolio.
   */
  app.get<{ Params: ChefParams }>('/chefs/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params

    const [row] = await app.db
      .select({ ...chefSelectFields, portfolioMediaIds: chefProfiles.portfolioMediaIds })
      .from(chefProfiles)
      .innerJoin(users, eq(chefProfiles.userId, users.id))
      .where(eq(chefProfiles.id, id))
      .limit(1)

    if (!row) return reply.code(404).send({ error: 'Chef not found' })

    return row
  })

  /**
   * PATCH /chefs/me
   * Authenticated. Creates or updates the caller's chef profile.
   * Automatically sets user.role = 'chef' on first profile creation.
   */
  app.patch<{ Body: PatchChefBody }>('/chefs/me', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          bio:               { type: 'string', maxLength: 1000 },
          cuisineTags:       { type: 'array', items: { type: 'string' } },
          workFormats:       {
            type: 'array',
            items: { type: 'string', enum: ['home_visit', 'delivery'] },
          },
          districts:         { type: 'array', items: { type: 'string' } },
          avgPrice:          { type: 'number', minimum: 0 },
          isActive:          { type: 'boolean' },
          portfolioMediaIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request) => {
    const userId = request.user.sub
    const { avgPrice, ...rest } = request.body

    // Drizzle maps numeric columns to string — convert before insert/update
    const drizzleBody = {
      ...rest,
      ...(avgPrice !== undefined ? { avgPrice: String(avgPrice) } : {}),
    }

    const existing = await app.db
      .select()
      .from(chefProfiles)
      .where(eq(chefProfiles.userId, userId))
      .limit(1)

    if (!existing[0]) {
      // First time: create profile + promote user role to chef
      await app.db
        .update(users)
        .set({ role: 'chef' })
        .where(eq(users.id, userId))

      const [created] = await app.db
        .insert(chefProfiles)
        .values({ userId, verificationStatus: 'approved', ...drizzleBody })
        .returning()

      return created
    }

    const [updated] = await app.db
      .update(chefProfiles)
      .set(drizzleBody)
      .where(eq(chefProfiles.userId, userId))
      .returning()

    return updated
  })

  /**
   * POST /chefs/me/portfolio
   * Authenticated. Appends mediaIds to portfolioMediaIds (max 10).
   */
  app.post<{ Body: PortfolioBody }>('/chefs/me/portfolio', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['mediaIds'],
        properties: {
          mediaIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { mediaIds } = request.body

    const [row] = await app.db
      .select({ portfolioMediaIds: chefProfiles.portfolioMediaIds })
      .from(chefProfiles)
      .where(eq(chefProfiles.userId, userId))
      .limit(1)

    if (!row) return reply.code(404).send({ error: 'Chef profile not found' })

    const existing = row.portfolioMediaIds ?? []
    const merged = [...existing, ...mediaIds]
    if (merged.length > 10) {
      return reply.code(400).send({ error: 'Portfolio limit is 10 photos' })
    }

    const [updated] = await app.db
      .update(chefProfiles)
      .set({ portfolioMediaIds: merged })
      .where(eq(chefProfiles.userId, userId))
      .returning({ portfolioMediaIds: chefProfiles.portfolioMediaIds })

    return updated
  })

  /**
   * DELETE /chefs/me/portfolio/:mediaId
   * Authenticated. Removes a specific mediaId from portfolioMediaIds.
   */
  app.delete<{ Params: { mediaId: string } }>('/chefs/me/portfolio/:mediaId', {
    onRequest: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['mediaId'],
        properties: { mediaId: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { mediaId } = request.params

    const [row] = await app.db
      .select({ portfolioMediaIds: chefProfiles.portfolioMediaIds })
      .from(chefProfiles)
      .where(eq(chefProfiles.userId, userId))
      .limit(1)

    if (!row) return reply.code(404).send({ error: 'Chef profile not found' })

    const filtered = (row.portfolioMediaIds ?? []).filter(id => id !== mediaId)

    const [updated] = await app.db
      .update(chefProfiles)
      .set({ portfolioMediaIds: filtered })
      .where(eq(chefProfiles.userId, userId))
      .returning({ portfolioMediaIds: chefProfiles.portfolioMediaIds })

    return updated
  })

  /**
   * POST /chefs/portfolio/upload
   * Authenticated. Receives base64-encoded image, sends it to Telegram via
   * sendPhoto, stores the returned file_id, and returns it.
   */
  app.post<{ Body: UploadBody }>('/chefs/portfolio/upload', {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['data', 'mimeType'],
        properties: {
          data:     { type: 'string' },
          mimeType: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.sub
    const { data, mimeType } = request.body

    // Verify chef profile exists
    const [row] = await app.db
      .select({ id: chefProfiles.id })
      .from(chefProfiles)
      .where(eq(chefProfiles.userId, userId))
      .limit(1)

    if (!row) return reply.code(404).send({ error: 'Chef profile not found' })

    // Get user's telegram_id to send the photo to themselves (as a workaround
    // to obtain a file_id — we send to the user and capture the file_id)
    const [userRow] = await app.db
      .select({ telegramId: users.telegramId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!userRow) return reply.code(404).send({ error: 'User not found' })

    // Convert base64 to Buffer and send to Telegram
    const buffer = Buffer.from(data, 'base64')
    const formData = new FormData()
    formData.append('chat_id', String(userRow.telegramId))
    formData.append('photo', new Blob([buffer], { type: mimeType }), 'photo.jpg')

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData,
    })
    const tgJson = await tgRes.json() as {
      ok: boolean
      result?: { photo: Array<{ file_id: string; width: number; height: number }> }
      description?: string
    }

    if (!tgJson.ok || !tgJson.result) {
      return reply.code(502).send({ error: tgJson.description ?? 'Telegram error' })
    }

    // Use the largest size file_id (last in the array)
    const photos = tgJson.result.photo
    const fileId = photos[photos.length - 1].file_id

    return { fileId }
  })

  /**
   * GET /chefs/:id/photo/:fileId
   * Public. Proxies a Telegram file to the client without exposing BOT_TOKEN.
   */
  app.get<{ Params: PhotoParams }>('/chefs/:id/photo/:fileId', {
    schema: {
      params: {
        type: 'object',
        required: ['id', 'fileId'],
        properties: {
          id:     { type: 'integer' },
          fileId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { fileId } = request.params

    // Step 1: resolve file_path from Telegram
    const infoRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    )
    const infoJson = await infoRes.json() as {
      ok: boolean
      result?: { file_path: string }
      description?: string
    }

    if (!infoJson.ok || !infoJson.result) {
      return reply.code(502).send({ error: infoJson.description ?? 'Telegram error' })
    }

    // Step 2: stream the file back
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${infoJson.result.file_path}`,
    )

    if (!fileRes.ok || !fileRes.body) {
      return reply.code(502).send({ error: 'Failed to fetch file from Telegram' })
    }

    const contentType = fileRes.headers.get('content-type') ?? 'application/octet-stream'
    reply.header('Content-Type', contentType)
    reply.header('Cache-Control', 'public, max-age=86400')

    return reply.send(fileRes.body)
  })
}
