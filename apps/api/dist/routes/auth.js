"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const telegram_auth_js_1 = require("../services/telegram-auth.js");
async function authRoutes(app) {
    /**
     * POST /auth/telegram
     *
     * Body: { initData: string }  — raw Telegram.WebApp.initData string
     * Returns: { token: string, user: { id, role, name } }
     */
    app.post('/auth/telegram', {
        schema: {
            body: {
                type: 'object',
                required: ['initData'],
                properties: {
                    initData: { type: 'string', minLength: 1 },
                    utmSource: { type: 'string', maxLength: 100 },
                    utmMedium: { type: 'string', maxLength: 100 },
                    utmCampaign: { type: 'string', maxLength: 100 },
                    utmContent: { type: 'string', maxLength: 100 },
                    utmTerm: { type: 'string', maxLength: 100 },
                },
            },
        },
    }, async (request, reply) => {
        var _a, _b, _c, _d, _e, _f;
        const { initData, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = request.body;
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) {
            app.log.error('BOT_TOKEN is not set');
            return reply.code(500).send({ error: 'Server misconfiguration' });
        }
        const parsed = (0, telegram_auth_js_1.validateInitData)(initData, botToken);
        if (!parsed) {
            return reply.code(401).send({ error: 'Invalid initData signature' });
        }
        const { user: tgUser } = parsed;
        const telegramId = tgUser.id;
        // Extract start_param from initData (Telegram deep link parameter)
        // and parse UTM tags from it as a server-side fallback.
        // The frontend (AuthContext) should already send UTMs in the body,
        // but if it didn't (e.g. old client), we parse them here.
        let startUtmSource = utmSource;
        let startUtmMedium = utmMedium;
        let startUtmCampaign = utmCampaign;
        let startUtmContent = utmContent;
        let startUtmTerm = utmTerm;
        if (!utmSource) {
            try {
                const rawParams = new URLSearchParams(initData);
                const startParam = rawParams.get('start_param');
                if (startParam) {
                    const decoded = new URLSearchParams(decodeURIComponent(startParam));
                    startUtmSource = (_a = decoded.get('utm_source')) !== null && _a !== void 0 ? _a : undefined;
                    startUtmMedium = (_b = decoded.get('utm_medium')) !== null && _b !== void 0 ? _b : undefined;
                    startUtmCampaign = (_c = decoded.get('utm_campaign')) !== null && _c !== void 0 ? _c : undefined;
                    startUtmContent = (_d = decoded.get('utm_content')) !== null && _d !== void 0 ? _d : undefined;
                    startUtmTerm = (_e = decoded.get('utm_term')) !== null && _e !== void 0 ? _e : undefined;
                }
            }
            catch {
                // start_param is not URL-encoded UTM — ignore silently
            }
        }
        // Upsert: find or create user
        const existing = await app.db
            .select()
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.telegramId, telegramId))
            .limit(1);
        let user = existing[0];
        if (!user) {
            const name = [tgUser.first_name, tgUser.last_name]
                .filter(Boolean)
                .join(' ');
            const [created] = await app.db
                .insert(schema_js_1.users)
                .values({
                telegramId,
                name,
                lang: (_f = tgUser.language_code) !== null && _f !== void 0 ? _f : 'ru',
                // Only set UTM on first creation; never overwrite existing values
                utmSource: startUtmSource !== null && startUtmSource !== void 0 ? startUtmSource : null,
                utmMedium: startUtmMedium !== null && startUtmMedium !== void 0 ? startUtmMedium : null,
                utmCampaign: startUtmCampaign !== null && startUtmCampaign !== void 0 ? startUtmCampaign : null,
                utmContent: startUtmContent !== null && startUtmContent !== void 0 ? startUtmContent : null,
                utmTerm: startUtmTerm !== null && startUtmTerm !== void 0 ? startUtmTerm : null,
            })
                .returning();
            user = created;
        }
        if (user.status === 'banned') {
            return reply.code(403).send({ error: 'Account is banned' });
        }
        const token = app.jwt.sign({ sub: user.id, role: user.role, telegramId: user.telegramId }, { expiresIn: '1d' });
        return {
            token,
            user: { id: user.id, role: user.role, name: user.name },
        };
    });
}
