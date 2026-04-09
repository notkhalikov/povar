"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = chefsRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const notify_js_1 = require("../services/notify.js");
const BOT_TOKEN = process.env.BOT_TOKEN;
// Columns returned in list and detail responses
const chefSelectFields = {
    id: schema_js_1.chefProfiles.id,
    userId: schema_js_1.chefProfiles.userId,
    name: schema_js_1.users.name,
    city: schema_js_1.users.city,
    bio: schema_js_1.chefProfiles.bio,
    cuisineTags: schema_js_1.chefProfiles.cuisineTags,
    workFormats: schema_js_1.chefProfiles.workFormats,
    districts: schema_js_1.chefProfiles.districts,
    avgPrice: schema_js_1.chefProfiles.avgPrice,
    ratingCache: schema_js_1.chefProfiles.ratingCache,
    ordersCount: schema_js_1.chefProfiles.ordersCount,
    verificationStatus: schema_js_1.chefProfiles.verificationStatus,
};
async function chefsRoutes(app) {
    /**
     * GET /chefs
     * Public. Returns active, approved chefs with optional filters.
     *
     * Query: city, district, cuisine, format, sort (rating|price), limit, offset
     */
    app.get('/chefs', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    city: { type: 'string' },
                    district: { type: 'string' },
                    cuisine: { type: 'string' },
                    format: { type: 'string', enum: ['home_visit', 'delivery'] },
                    sort: { type: 'string', enum: ['rating', 'price'] },
                    minRating: { type: 'number', minimum: 0, maximum: 5 },
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                },
            },
        },
    }, async (request) => {
        const { city, district, cuisine, format, sort = 'rating', minRating, limit = 20, offset = 0, } = request.query;
        const conditions = [
            (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.isActive, true),
            (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.verificationStatus, 'approved'),
            (0, drizzle_orm_1.eq)(schema_js_1.users.status, 'active'),
        ];
        if (city)
            conditions.push((0, drizzle_orm_1.eq)(schema_js_1.users.city, city));
        if (district)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.chefProfiles.districts} @> ARRAY[${district}]::text[]`);
        if (cuisine)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.chefProfiles.cuisineTags} @> ARRAY[${cuisine}]::text[]`);
        if (format)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.chefProfiles.workFormats} @> ARRAY[${format}]::text[]`);
        if (minRating)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.chefProfiles.ratingCache} >= ${minRating}`);
        const orderBy = sort === 'price'
            ? (0, drizzle_orm_1.asc)(schema_js_1.chefProfiles.avgPrice)
            : (0, drizzle_orm_1.desc)(schema_js_1.chefProfiles.ratingCache);
        const rows = await app.db
            .select(chefSelectFields)
            .from(schema_js_1.chefProfiles)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, schema_js_1.users.id))
            .where((0, drizzle_orm_1.and)(...conditions))
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);
        return { data: rows, limit, offset };
    });
    /**
     * GET /chefs/me
     * Authenticated. Returns the caller's own chef profile (404 if not created yet).
     */
    app.get('/chefs/me', {
        onRequest: [app.authenticate],
    }, async (request, reply) => {
        const userId = request.user.sub;
        const [row] = await app.db
            .select({
            ...chefSelectFields,
            isActive: schema_js_1.chefProfiles.isActive,
            portfolioMediaIds: schema_js_1.chefProfiles.portfolioMediaIds,
        })
            .from(schema_js_1.chefProfiles)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, schema_js_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Chef profile not found' });
        return row;
    });
    /**
     * GET /chefs/:id
     * Public. Returns full chef profile including portfolio.
     */
    app.get('/chefs/:id', {
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
        const { id } = request.params;
        const [row] = await app.db
            .select({ ...chefSelectFields, portfolioMediaIds: schema_js_1.chefProfiles.portfolioMediaIds })
            .from(schema_js_1.chefProfiles)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, schema_js_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.id, id))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Chef not found' });
        return row;
    });
    /**
     * PATCH /chefs/me
     * Authenticated. Creates or updates the caller's chef profile.
     * Automatically sets user.role = 'chef' on first profile creation.
     */
    app.patch('/chefs/me', {
        onRequest: [app.authenticate],
        schema: {
            body: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    bio: { type: 'string', maxLength: 1000 },
                    cuisineTags: { type: 'array', items: { type: 'string' } },
                    workFormats: {
                        type: 'array',
                        items: { type: 'string', enum: ['home_visit', 'delivery'] },
                    },
                    districts: { type: 'array', items: { type: 'string' } },
                    avgPrice: { type: 'number', minimum: 0 },
                    isActive: { type: 'boolean' },
                    portfolioMediaIds: { type: 'array', items: { type: 'string' } },
                },
            },
        },
    }, async (request) => {
        const userId = request.user.sub;
        const { avgPrice, ...rest } = request.body;
        // Drizzle maps numeric columns to string — convert before insert/update
        const drizzleBody = {
            ...rest,
            ...(avgPrice !== undefined ? { avgPrice: String(avgPrice) } : {}),
        };
        const existing = await app.db
            .select()
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .limit(1);
        if (!existing[0]) {
            // First time: create profile + promote user role to chef
            await app.db
                .update(schema_js_1.users)
                .set({ role: 'chef' })
                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userId));
            const [created] = await app.db
                .insert(schema_js_1.chefProfiles)
                .values({ userId, verificationStatus: 'approved', ...drizzleBody })
                .returning();
            return created;
        }
        const [updated] = await app.db
            .update(schema_js_1.chefProfiles)
            .set(drizzleBody)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .returning();
        return updated;
    });
    /**
     * POST /chefs/me/portfolio
     * Authenticated. Appends mediaIds to portfolioMediaIds (max 10).
     */
    app.post('/chefs/me/portfolio', {
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
        var _a;
        const userId = request.user.sub;
        const { mediaIds } = request.body;
        const [row] = await app.db
            .select({ portfolioMediaIds: schema_js_1.chefProfiles.portfolioMediaIds })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Chef profile not found' });
        const existing = (_a = row.portfolioMediaIds) !== null && _a !== void 0 ? _a : [];
        const merged = [...existing, ...mediaIds];
        if (merged.length > 10) {
            return reply.code(400).send({ error: 'Portfolio limit is 10 photos' });
        }
        const [updated] = await app.db
            .update(schema_js_1.chefProfiles)
            .set({ portfolioMediaIds: merged })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .returning({ portfolioMediaIds: schema_js_1.chefProfiles.portfolioMediaIds });
        return updated;
    });
    /**
     * DELETE /chefs/me/portfolio/:mediaId
     * Authenticated. Removes a specific mediaId from portfolioMediaIds.
     */
    app.delete('/chefs/me/portfolio/:mediaId', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['mediaId'],
                properties: { mediaId: { type: 'string' } },
            },
        },
    }, async (request, reply) => {
        var _a;
        const userId = request.user.sub;
        const { mediaId } = request.params;
        const [row] = await app.db
            .select({ portfolioMediaIds: schema_js_1.chefProfiles.portfolioMediaIds })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Chef profile not found' });
        const filtered = ((_a = row.portfolioMediaIds) !== null && _a !== void 0 ? _a : []).filter(id => id !== mediaId);
        const [updated] = await app.db
            .update(schema_js_1.chefProfiles)
            .set({ portfolioMediaIds: filtered })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .returning({ portfolioMediaIds: schema_js_1.chefProfiles.portfolioMediaIds });
        return updated;
    });
    /**
     * POST /chefs/portfolio/upload
     * Authenticated. Receives base64-encoded image, sends it to Telegram via
     * sendPhoto, stores the returned file_id, and returns it.
     */
    app.post('/chefs/portfolio/upload', {
        onRequest: [app.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['data', 'mimeType'],
                properties: {
                    data: { type: 'string' },
                    mimeType: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        var _a;
        const userId = request.user.sub;
        const { data, mimeType } = request.body;
        // Verify chef profile exists
        const [row] = await app.db
            .select({ id: schema_js_1.chefProfiles.id })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Chef profile not found' });
        // Get user's telegram_id to send the photo to themselves (as a workaround
        // to obtain a file_id — we send to the user and capture the file_id)
        const [userRow] = await app.db
            .select({ telegramId: schema_js_1.users.telegramId })
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userId))
            .limit(1);
        if (!userRow)
            return reply.code(404).send({ error: 'User not found' });
        // Convert base64 to Buffer and send to Telegram
        const buffer = Buffer.from(data, 'base64');
        const formData = new FormData();
        formData.append('chat_id', String(userRow.telegramId));
        formData.append('photo', new Blob([buffer], { type: mimeType }), 'photo.jpg');
        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData,
        });
        const tgJson = await tgRes.json();
        if (!tgJson.ok || !tgJson.result) {
            return reply.code(502).send({ error: (_a = tgJson.description) !== null && _a !== void 0 ? _a : 'Telegram error' });
        }
        // Use the largest size file_id (last in the array)
        const photos = tgJson.result.photo;
        const fileId = photos[photos.length - 1].file_id;
        return { fileId };
    });
    /**
     * POST /chefs/me/verify
     * Authenticated. Chef-only. Submits verification documents.
     * Sets verificationStatus='pending' and notifies admin via Telegram.
     */
    app.post('/chefs/me/verify', {
        onRequest: [app.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['documentFileId', 'selfieFileId'],
                additionalProperties: false,
                properties: {
                    documentFileId: { type: 'string', minLength: 1 },
                    selfieFileId: { type: 'string', minLength: 1 },
                },
            },
        },
    }, async (request, reply) => {
        const { sub: userId, role } = request.user;
        if (role !== 'chef') {
            return reply.code(403).send({ error: 'Only chefs can submit verification' });
        }
        const { documentFileId, selfieFileId } = request.body;
        const [row] = await app.db
            .select({ id: schema_js_1.chefProfiles.id, name: schema_js_1.users.name, verificationStatus: schema_js_1.chefProfiles.verificationStatus })
            .from(schema_js_1.chefProfiles)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, schema_js_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Chef profile not found' });
        if (row.verificationStatus === 'pending') {
            return reply.code(422).send({ error: 'Verification already pending' });
        }
        if (row.verificationStatus === 'approved') {
            return reply.code(422).send({ error: 'Already verified' });
        }
        const [updated] = await app.db
            .update(schema_js_1.chefProfiles)
            .set({
            verificationStatus: 'pending',
            verificationDocumentId: documentFileId,
            verificationSelfieId: selfieFileId,
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .returning({ verificationStatus: schema_js_1.chefProfiles.verificationStatus });
        // Notify admin
        const adminTelegramId = Number(process.env.ADMIN_TELEGRAM_ID);
        if (adminTelegramId) {
            (0, notify_js_1.notifyVerificationSubmitted)(row.name, row.id, adminTelegramId).catch(err => console.error('notify admin verification failed', err));
        }
        return updated;
    });
    /**
     * GET /chefs/:id/photo/:fileId
     * Public. Proxies a Telegram file to the client without exposing BOT_TOKEN.
     */
    app.get('/chefs/:id/photo/:fileId', {
        schema: {
            params: {
                type: 'object',
                required: ['id', 'fileId'],
                properties: {
                    id: { type: 'integer' },
                    fileId: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        var _a, _b;
        const { fileId } = request.params;
        // Step 1: resolve file_path from Telegram
        const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
        const infoJson = await infoRes.json();
        if (!infoJson.ok || !infoJson.result) {
            return reply.code(502).send({ error: (_a = infoJson.description) !== null && _a !== void 0 ? _a : 'Telegram error' });
        }
        // Step 2: stream the file back
        const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${infoJson.result.file_path}`);
        if (!fileRes.ok || !fileRes.body) {
            return reply.code(502).send({ error: 'Failed to fetch file from Telegram' });
        }
        const contentType = (_b = fileRes.headers.get('content-type')) !== null && _b !== void 0 ? _b : 'application/octet-stream';
        reply.header('Content-Type', contentType);
        reply.header('Cache-Control', 'public, max-age=86400');
        return reply.send(fileRes.body);
    });
}
