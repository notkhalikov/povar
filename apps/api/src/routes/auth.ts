import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { users } from '../db/schema.js'
import { validateInitData, validateWidgetData } from '../services/telegram-auth.js'

interface AuthBody {
  initData: string
  utmSource?:   string
  utmMedium?:   string
  utmCampaign?: string
  utmContent?:  string
  utmTerm?:     string
}

interface WidgetAuthBody {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface MiniAppAuthBody {
  initData: string
}

function verifyTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return false

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()
  const expectedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  return expectedHash === hash
}

export default async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/telegram
   *
   * Body: { initData: string }  — raw Telegram.WebApp.initData string
   * Returns: { token: string, user: { id, role, name } }
   */
  app.post<{ Body: AuthBody }>(
    '/auth/telegram',
    {
      schema: {
        body: {
          type: 'object',
          required: ['initData'],
          properties: {
            initData:    { type: 'string', minLength: 1 },
            utmSource:   { type: 'string', maxLength: 100 },
            utmMedium:   { type: 'string', maxLength: 100 },
            utmCampaign: { type: 'string', maxLength: 100 },
            utmContent:  { type: 'string', maxLength: 100 },
            utmTerm:     { type: 'string', maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const { initData, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = request.body

      const botToken = process.env.BOT_TOKEN
      if (!botToken) {
        app.log.error('BOT_TOKEN is not set')
        return reply.code(500).send({ error: 'Server misconfiguration' })
      }

      const parsed = validateInitData(initData, botToken)
      if (!parsed) {
        return reply.code(401).send({ error: 'Invalid initData signature' })
      }

      const { user: tgUser } = parsed
      const telegramId = tgUser.id

      // Extract start_param from initData (Telegram deep link parameter)
      // and parse UTM tags from it as a server-side fallback.
      // The frontend (AuthContext) should already send UTMs in the body,
      // but if it didn't (e.g. old client), we parse them here.
      let startUtmSource   = utmSource
      let startUtmMedium   = utmMedium
      let startUtmCampaign = utmCampaign
      let startUtmContent  = utmContent
      let startUtmTerm     = utmTerm

      if (!utmSource) {
        try {
          const rawParams = new URLSearchParams(initData)
          const startParam = rawParams.get('start_param')
          if (startParam) {
            const decoded = new URLSearchParams(decodeURIComponent(startParam))
            startUtmSource   = decoded.get('utm_source')   ?? undefined
            startUtmMedium   = decoded.get('utm_medium')   ?? undefined
            startUtmCampaign = decoded.get('utm_campaign') ?? undefined
            startUtmContent  = decoded.get('utm_content')  ?? undefined
            startUtmTerm     = decoded.get('utm_term')     ?? undefined
          }
        } catch {
          // start_param is not URL-encoded UTM — ignore silently
        }
      }

      // Upsert: find or create user
      const existing = await app.db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId))
        .limit(1)

      let user = existing[0]

      if (!user) {
        const name = [tgUser.first_name, tgUser.last_name]
          .filter(Boolean)
          .join(' ')

        const [created] = await app.db
          .insert(users)
          .values({
            telegramId,
            name,
            lang: tgUser.language_code ?? 'ru',
            // Only set UTM on first creation; never overwrite existing values
            utmSource:   startUtmSource   ?? null,
            utmMedium:   startUtmMedium   ?? null,
            utmCampaign: startUtmCampaign ?? null,
            utmContent:  startUtmContent  ?? null,
            utmTerm:     startUtmTerm     ?? null,
          })
          .returning()

        user = created
      }

      if (user.status === 'banned') {
        return reply.code(403).send({ error: 'Account is banned' })
      }

      const token = app.jwt.sign(
        { sub: user.id, role: user.role, telegramId: user.telegramId },
        { expiresIn: '1d' },
      )

      return {
        token,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          telegramId: user.telegramId,
          isChef: user.role === 'chef',
          avatarUrl: user.avatarUrl,
          onboardingDone: user.onboardingDone,
        },
      }
    },
  )

  /**
   * POST /auth/telegram-widget
   *
   * Body: Telegram Login Widget payload
   *   { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
   * Returns: { token, user: { id, role, name } }
   */
  app.post<{ Body: WidgetAuthBody }>(
    '/auth/telegram-widget',
    {
      schema: {
        body: {
          type: 'object',
          required: ['id', 'first_name', 'auth_date', 'hash'],
          properties: {
            id:         { type: 'integer' },
            first_name: { type: 'string', minLength: 1, maxLength: 255 },
            last_name:  { type: 'string', maxLength: 255 },
            username:   { type: 'string', maxLength: 255 },
            photo_url:  { type: 'string', maxLength: 1024 },
            auth_date:  { type: 'integer' },
            hash:       { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const botToken = process.env.BOT_TOKEN
      if (!botToken) {
        app.log.error('BOT_TOKEN is not set')
        return reply.code(500).send({ error: 'Server misconfiguration' })
      }

      const parsed = validateWidgetData(request.body, botToken)
      if (!parsed) {
        return reply.code(401).send({ error: 'Invalid widget signature or expired' })
      }

      const { user: tgUser } = parsed
      const telegramId = tgUser.id

      const existing = await app.db
        .select()
        .from(users)
        .where(eq(users.telegramId, telegramId))
        .limit(1)

      let user = existing[0]

      if (!user) {
        const name = [tgUser.first_name, tgUser.last_name]
          .filter(Boolean)
          .join(' ')

        const [created] = await app.db
          .insert(users)
          .values({
            telegramId,
            name,
            lang: 'ru',
          })
          .returning()

        user = created
      }

      if (user.status === 'banned') {
        return reply.code(403).send({ error: 'Account is banned' })
      }

      if (tgUser.photo_url) {
        await app.db.update(users)
          .set({ avatarUrl: tgUser.photo_url })
          .where(eq(users.id, user.id))

        user = { ...user, avatarUrl: tgUser.photo_url }
      }

      const token = app.jwt.sign(
        { sub: user.id, role: user.role, telegramId: user.telegramId },
        { expiresIn: '1d' },
      )

      return {
        token,
        user: {
          id: user.id,
          role: user.role,
          name: user.name,
          telegramId: user.telegramId,
          isChef: user.role === 'chef',
          avatarUrl: user.avatarUrl,
          onboardingDone: user.onboardingDone,
        },
      }
    },
  )

  /**
   * POST /auth/telegram-miniapp
   *
   * Body: { initData: string }  — Telegram.WebApp.initData for Mini App auth
   * Returns: { token: string, user: { id, role, name, avatarUrl } }
   */
  app.post<{ Body: MiniAppAuthBody }>(
    '/auth/telegram-miniapp',
    {
      schema: {
        body: {
          type: 'object',
          required: ['initData'],
          properties: {
            initData: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { initData } = request.body as { initData: string }

        app.log.info({ initDataLength: initData?.length }, 'telegram-miniapp auth attempt')

        if (!initData) {
          return reply.status(400).send({ error: 'Missing initData' })
        }

        const botToken = process.env.BOT_TOKEN
        app.log.info({ hasBotToken: !!botToken }, 'bot token check')

        if (!botToken) {
          app.log.error('BOT_TOKEN is not set')
          return reply.code(500).send({ error: 'Server misconfiguration' })
        }

        const isValid = verifyTelegramInitData(initData, botToken)
        app.log.info({ hashValid: isValid }, 'hash verification result')

        if (!isValid) {
          return reply.code(401).send({ error: 'Invalid initData hash' })
        }

        const params = new URLSearchParams(initData)
        const userJson = params.get('user')
        app.log.info({ hasUserJson: !!userJson }, 'user json check')

        if (!userJson) {
          return reply.code(400).send({ error: 'No user data in initData' })
        }

        let tgUser
        try {
          tgUser = JSON.parse(userJson)
          app.log.info({ tgUserId: tgUser.id, tgUserName: tgUser.first_name }, 'tg user parsed')
        } catch (e) {
          app.log.error(e, 'failed to parse user json')
          return reply.code(400).send({ error: 'Invalid user JSON' })
        }

        const telegramId = tgUser.id

        const existing = await app.db
          .select()
          .from(users)
          .where(eq(users.telegramId, telegramId))
          .limit(1)

        app.log.info({ userExists: !!existing[0], telegramId }, 'user lookup result')

        let user = existing[0]

        if (!user) {
          const name = [tgUser.first_name, tgUser.last_name]
            .filter(Boolean)
            .join(' ')

          app.log.info({ telegramId, name }, 'creating new user (no role set, admins will assign)')

          const [created] = await app.db
            .insert(users)
            .values({
              telegramId,
              name,
              lang: tgUser.language_code ?? 'ru',
            })
            .returning()

          user = created
          app.log.info({ userId: user.id }, 'user created without role')
        }

        if (user.status === 'banned') {
          app.log.warn({ userId: user.id }, 'banned user login attempt')
          return reply.code(403).send({ error: 'Account is banned' })
        }

        if (tgUser.photo_url) {
          app.log.info({ userId: user.id }, 'updating avatar')
          await app.db.update(users)
            .set({ avatarUrl: tgUser.photo_url })
            .where(eq(users.id, user.id))

          user = { ...user, avatarUrl: tgUser.photo_url }
        }

        const token = app.jwt.sign(
          { sub: user.id, role: user.role, telegramId: user.telegramId },
          { expiresIn: '1d' },
        )

        app.log.info({ userId: user.id, isChef: user.role === 'chef' }, 'auth success')

        return {
          token,
          user: {
            id: user.id,
            role: user.role,
            name: user.name,
            telegramId: user.telegramId,
            isChef: user.role === 'chef',
            avatarUrl: user.avatarUrl,
            onboardingDone: user.onboardingDone,
          },
        }
      } catch (e) {
        app.log.error(e, 'telegram-miniapp auth error')
        return reply.status(500).send({ error: 'Auth failed' })
      }
    },
  )
}
