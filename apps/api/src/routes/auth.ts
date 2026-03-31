import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'
import { validateInitData } from '../services/telegram-auth.js'

interface AuthBody {
  initData: string
  utmSource?:   string
  utmMedium?:   string
  utmCampaign?: string
  utmContent?:  string
  utmTerm?:     string
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
            utmSource:   utmSource   ?? null,
            utmMedium:   utmMedium   ?? null,
            utmCampaign: utmCampaign ?? null,
            utmContent:  utmContent  ?? null,
            utmTerm:     utmTerm     ?? null,
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
        user: { id: user.id, role: user.role, name: user.name },
      }
    },
  )
}
