"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = __importDefault(require("crypto"));
const schema_js_1 = require("../db/schema.js");
const telegram_auth_js_1 = require("../services/telegram-auth.js");
function verifyTelegramInitData(initData, botToken) {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash)
        return false;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    const secretKey = crypto_1.default.createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
    const expectedHash = crypto_1.default.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
    return expectedHash === hash;
}
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
            user: {
                id: user.id,
                role: user.role,
                name: user.name,
                telegramId: user.telegramId,
                isChef: user.role === 'chef',
                avatarUrl: user.avatarUrl,
                onboardingDone: user.onboardingDone,
            },
        };
    });
    /**
     * POST /auth/telegram-widget
     *
     * Body: Telegram Login Widget payload
     *   { id, first_name, last_name?, username?, photo_url?, auth_date, hash }
     * Returns: { token, user: { id, role, name } }
     */
    app.post('/auth/telegram-widget', {
        schema: {
            body: {
                type: 'object',
                required: ['id', 'first_name', 'auth_date', 'hash'],
                properties: {
                    id: { type: 'integer' },
                    first_name: { type: 'string', minLength: 1, maxLength: 255 },
                    last_name: { type: 'string', maxLength: 255 },
                    username: { type: 'string', maxLength: 255 },
                    photo_url: { type: 'string', maxLength: 1024 },
                    auth_date: { type: 'integer' },
                    hash: { type: 'string', minLength: 1 },
                },
            },
        },
    }, async (request, reply) => {
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) {
            app.log.error('BOT_TOKEN is not set');
            return reply.code(500).send({ error: 'Server misconfiguration' });
        }
        const parsed = (0, telegram_auth_js_1.validateWidgetData)(request.body, botToken);
        if (!parsed) {
            return reply.code(401).send({ error: 'Invalid widget signature or expired' });
        }
        const { user: tgUser } = parsed;
        const telegramId = tgUser.id;
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
                lang: 'ru',
            })
                .returning();
            user = created;
        }
        if (user.status === 'banned') {
            return reply.code(403).send({ error: 'Account is banned' });
        }
        if (tgUser.photo_url) {
            await app.db.update(schema_js_1.users)
                .set({ avatarUrl: tgUser.photo_url })
                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.id));
            user = { ...user, avatarUrl: tgUser.photo_url };
        }
        const token = app.jwt.sign({ sub: user.id, role: user.role, telegramId: user.telegramId }, { expiresIn: '1d' });
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
        };
    });
    /**
     * POST /auth/telegram-miniapp
     *
     * Body: { initData: string }  — Telegram.WebApp.initData for Mini App auth
     * Returns: { token: string, user: { id, role, name, avatarUrl } }
     */
    app.post('/auth/telegram-miniapp', {
        schema: {
            body: {
                type: 'object',
                required: ['initData'],
                properties: {
                    initData: { type: 'string', minLength: 1 },
                },
            },
        },
    }, async (request, reply) => {
        var _a;
        try {
            const { initData } = request.body;
            app.log.info({ initDataLength: initData === null || initData === void 0 ? void 0 : initData.length }, 'telegram-miniapp auth attempt');
            if (!initData) {
                return reply.status(400).send({ error: 'Missing initData' });
            }
            const botToken = process.env.BOT_TOKEN;
            app.log.info({ hasBotToken: !!botToken }, 'bot token check');
            if (!botToken) {
                app.log.error('BOT_TOKEN is not set');
                return reply.code(500).send({ error: 'Server misconfiguration' });
            }
            const isValid = verifyTelegramInitData(initData, botToken);
            app.log.info({ hashValid: isValid }, 'hash verification result');
            if (!isValid) {
                return reply.code(401).send({ error: 'Invalid initData hash' });
            }
            const params = new URLSearchParams(initData);
            const userJson = params.get('user');
            app.log.info({ hasUserJson: !!userJson }, 'user json check');
            if (!userJson) {
                return reply.code(400).send({ error: 'No user data in initData' });
            }
            let tgUser;
            try {
                tgUser = JSON.parse(userJson);
                app.log.info({ tgUserId: tgUser.id, tgUserName: tgUser.first_name }, 'tg user parsed');
            }
            catch (e) {
                app.log.error(e, 'failed to parse user json');
                return reply.code(400).send({ error: 'Invalid user JSON' });
            }
            const telegramId = tgUser.id;
            const existing = await app.db
                .select()
                .from(schema_js_1.users)
                .where((0, drizzle_orm_1.eq)(schema_js_1.users.telegramId, telegramId))
                .limit(1);
            app.log.info({ userExists: !!existing[0], telegramId }, 'user lookup result');
            let user = existing[0];
            if (!user) {
                const name = [tgUser.first_name, tgUser.last_name]
                    .filter(Boolean)
                    .join(' ');
                app.log.info({ telegramId, name }, 'creating new user');
                const [created] = await app.db
                    .insert(schema_js_1.users)
                    .values({
                    telegramId,
                    name,
                    lang: (_a = tgUser.language_code) !== null && _a !== void 0 ? _a : 'ru',
                })
                    .returning();
                user = created;
                app.log.info({ userId: user.id }, 'user created');
            }
            if (user.status === 'banned') {
                app.log.warn({ userId: user.id }, 'banned user login attempt');
                return reply.code(403).send({ error: 'Account is banned' });
            }
            if (tgUser.photo_url) {
                app.log.info({ userId: user.id }, 'updating avatar');
                await app.db.update(schema_js_1.users)
                    .set({ avatarUrl: tgUser.photo_url })
                    .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, user.id));
                user = { ...user, avatarUrl: tgUser.photo_url };
            }
            const token = app.jwt.sign({ sub: user.id, role: user.role, telegramId: user.telegramId }, { expiresIn: '1d' });
            app.log.info({ userId: user.id, isChef: user.role === 'chef' }, 'auth success');
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
            };
        }
        catch (e) {
            app.log.error(e, 'telegram-miniapp auth error');
            return reply.status(500).send({ error: 'Auth failed' });
        }
    });
}
