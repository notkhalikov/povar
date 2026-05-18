"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requestsRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const notify_js_1 = require("../services/notify.js");
const MAX_RESPONSES_PER_REQUEST = 5;
async function requestsRoutes(app) {
    // ─── POST /requests ───────────────────────────────────────────────────────────
    // Authenticated. Customer creates an open request for chef matching.
    app.post('/requests', {
        onRequest: [app.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['city', 'scheduledAt', 'format', 'persons'],
                additionalProperties: false,
                properties: {
                    city: { type: 'string', minLength: 1, maxLength: 100 },
                    district: { type: 'string', maxLength: 100 },
                    scheduledAt: { type: 'string' },
                    format: { type: 'string', enum: ['home_visit', 'delivery'] },
                    persons: { type: 'integer', minimum: 1, maximum: 50 },
                    description: { type: 'string', maxLength: 2000 },
                    budget: { type: 'number', minimum: 0 },
                    chefId: { type: 'integer' },
                },
            },
        },
    }, async (request, reply) => {
        var _a, _b;
        const customerId = request.user.sub;
        const { city, district, scheduledAt, format, persons, description, budget, chefId } = request.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        const FRONTEND_URL = process.env.FRONTEND_URL;
        const [created] = await app.db
            .insert(schema_js_1.requests)
            .values({
            customerId,
            chefId,
            city,
            district,
            scheduledAt: new Date(scheduledAt),
            format,
            persons,
            description,
            budget: budget !== undefined ? String(budget) : undefined,
            status: 'open',
        })
            .returning();
        // Notify chef if chefId provided
        if (chefId) {
            try {
                const chef = await app.db.query.users.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, chefId),
                    columns: { telegramId: true, name: true },
                });
                if (chef === null || chef === void 0 ? void 0 : chef.telegramId) {
                    const customer = await app.db.query.users.findFirst({
                        where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, customerId),
                        columns: { name: true },
                    });
                    const text = [
                        `🆕 *Новый запрос!*`,
                        ``,
                        `👤 От: ${(_a = customer === null || customer === void 0 ? void 0 : customer.name) !== null && _a !== void 0 ? _a : 'Клиент'}`,
                        `📝 ${description === null || description === void 0 ? void 0 : description.slice(0, 150)}${((_b = description === null || description === void 0 ? void 0 : description.length) !== null && _b !== void 0 ? _b : 0) > 150 ? '...' : ''}`,
                        `👥 Гостей: ${persons}`,
                        budget ? `💰 Бюджет: ${budget} GEL` : '',
                        scheduledAt ? `📅 Дата: ${new Date(scheduledAt).toLocaleDateString('ru-RU')}` : '',
                    ].filter(Boolean).join('\n');
                    const keyboard = {
                        inline_keyboard: [[
                                {
                                    text: '👀 Посмотреть запрос',
                                    web_app: { url: `${FRONTEND_URL}/requests/${created.id}` },
                                },
                            ]],
                    };
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chef.telegramId,
                            text,
                            parse_mode: 'Markdown',
                            reply_markup: keyboard,
                        }),
                    }).catch(err => app.log.error({ err }, 'Failed to notify chef'));
                }
            }
            catch (err) {
                app.log.error({ err, chefId }, 'Failed to send chef notification');
            }
        }
        return reply.code(201).send(created);
    });
    // ─── GET /requests ────────────────────────────────────────────────────────────
    // Authenticated.
    // Customer → their own requests with response counts.
    // Chef     → open requests matching their city and work formats.
    app.get('/requests', {
        onRequest: [app.authenticate],
    }, async (request) => {
        const userId = request.user.sub;
        const role = request.user.role;
        if (role === 'chef') {
            // Fetch chef's city and formats for geo/format matching
            const [profile] = await app.db
                .select({
                city: schema_js_1.users.city,
                workFormats: schema_js_1.chefProfiles.workFormats,
                isActive: schema_js_1.chefProfiles.isActive,
            })
                .from(schema_js_1.chefProfiles)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.chefProfiles.userId))
                .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
                .limit(1);
            if (!profile || !profile.isActive)
                return { data: [] };
            const rows = await app.db
                .select({
                id: schema_js_1.requests.id,
                city: schema_js_1.requests.city,
                district: schema_js_1.requests.district,
                scheduledAt: schema_js_1.requests.scheduledAt,
                format: schema_js_1.requests.format,
                persons: schema_js_1.requests.persons,
                description: schema_js_1.requests.description,
                budget: schema_js_1.requests.budget,
                status: schema_js_1.requests.status,
                createdAt: schema_js_1.requests.createdAt,
                responseCount: (0, drizzle_orm_1.sql) `(
            SELECT count(*)::int FROM chef_responses r WHERE r.request_id = ${schema_js_1.requests.id}
          )`,
                hasResponded: (0, drizzle_orm_1.sql) `EXISTS(
            SELECT 1 FROM chef_responses r
            WHERE r.request_id = ${schema_js_1.requests.id} AND r.chef_id = ${userId}
          )`,
            })
                .from(schema_js_1.requests)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.requests.status, 'open'), profile.city ? (0, drizzle_orm_1.eq)(schema_js_1.requests.city, profile.city) : (0, drizzle_orm_1.sql) `1=1`, profile.workFormats.length > 0
                ? (0, drizzle_orm_1.sql) `${schema_js_1.requests.format}::text = ANY(${profile.workFormats})`
                : (0, drizzle_orm_1.sql) `1=1`))
                .orderBy((0, drizzle_orm_1.desc)(schema_js_1.requests.createdAt));
            return { data: rows };
        }
        // Customer — own requests
        const rows = await app.db
            .select({
            id: schema_js_1.requests.id,
            chefId: schema_js_1.requests.chefId,
            city: schema_js_1.requests.city,
            district: schema_js_1.requests.district,
            scheduledAt: schema_js_1.requests.scheduledAt,
            format: schema_js_1.requests.format,
            persons: schema_js_1.requests.persons,
            description: schema_js_1.requests.description,
            budget: schema_js_1.requests.budget,
            status: schema_js_1.requests.status,
            createdAt: schema_js_1.requests.createdAt,
            responseCount: (0, drizzle_orm_1.sql) `(
          SELECT count(*)::int FROM chef_responses r WHERE r.request_id = ${schema_js_1.requests.id}
        )`,
        })
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.customerId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.requests.createdAt));
        // Fetch chef info for direct requests
        const chefIds = [...new Set(rows.filter(r => r.chefId).map(r => r.chefId))];
        const chefMap = new Map();
        if (chefIds.length > 0) {
            const chefs = await app.db
                .select({ id: schema_js_1.users.id, name: schema_js_1.users.name, avatarUrl: schema_js_1.users.avatarUrl })
                .from(schema_js_1.users)
                .where((0, drizzle_orm_1.inArray)(schema_js_1.users.id, chefIds));
            chefs.forEach(c => chefMap.set(c.id, c));
        }
        const data = rows.map(r => ({
            ...r,
            chef: r.chefId ? chefMap.get(r.chefId) : null,
        }));
        return { data };
    });
    // ─── GET /requests/pending-count ────────────────────────────────────────────────
    // Authenticated. Returns pending count:
    // - Chef: direct requests to them (chefId=userId, status=open)
    // - Customer: pending open requests (customerId=userId, status=open)
    app.get('/requests/pending-count', {
        onRequest: [app.authenticate],
    }, async (request) => {
        var _a;
        const userId = request.user.sub;
        const role = request.user.role;
        let condition;
        if (role === 'chef') {
            // Chef: count direct requests to them that are open
            condition = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.requests.chefId, userId), (0, drizzle_orm_1.eq)(schema_js_1.requests.status, 'open'));
        }
        else {
            // Customer: count their open requests
            condition = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.requests.customerId, userId), (0, drizzle_orm_1.eq)(schema_js_1.requests.status, 'open'));
        }
        const [result] = await app.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
            .from(schema_js_1.requests)
            .where(condition);
        return { count: (_a = result === null || result === void 0 ? void 0 : result.count) !== null && _a !== void 0 ? _a : 0 };
    });
    // ─── GET /requests/:id ────────────────────────────────────────────────────────
    // Authenticated. Returns request details + all responses with chef name & rating.
    app.get('/requests/:id', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const role = request.user.role;
        const { id } = request.params;
        const [req] = await app.db
            .select()
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id))
            .limit(1);
        if (!req)
            return reply.code(404).send({ error: 'Request not found' });
        // Access: customer who owns it, any chef, or admin/support
        if (role === 'customer' && req.customerId !== userId) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const responses = await app.db
            .select({
            id: schema_js_1.chefResponses.id,
            chefId: schema_js_1.chefResponses.chefId,
            chefProfileId: schema_js_1.chefProfiles.id,
            proposedPrice: schema_js_1.chefResponses.proposedPrice,
            comment: schema_js_1.chefResponses.comment,
            status: schema_js_1.chefResponses.status,
            createdAt: schema_js_1.chefResponses.createdAt,
            chefName: schema_js_1.users.name,
            ratingCache: schema_js_1.chefProfiles.ratingCache,
        })
            .from(schema_js_1.chefResponses)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.chefResponses.chefId))
            .innerJoin(schema_js_1.chefProfiles, (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, schema_js_1.chefResponses.chefId))
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefResponses.requestId, id))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.chefResponses.createdAt));
        return { ...req, responses };
    });
    // ─── POST /requests/:id/respond ───────────────────────────────────────────────
    // Chef only. Creates a response. Max 5 responses per request, no duplicates.
    app.post('/requests/:id/respond', {
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
                    comment: { type: 'string', maxLength: 1000 },
                },
            },
        },
    }, async (request, reply) => {
        var _a, _b, _c, _d, _e, _f;
        const chefId = request.user.sub;
        const role = request.user.role;
        const { id } = request.params;
        const { proposedPrice, comment } = request.body;
        if (role !== 'chef') {
            return reply.code(403).send({ error: 'Only chefs can respond to requests' });
        }
        // Block inactive chefs from responding
        const [chefStatus] = await app.db
            .select({ isActive: schema_js_1.chefProfiles.isActive })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, chefId))
            .limit(1);
        if (!(chefStatus === null || chefStatus === void 0 ? void 0 : chefStatus.isActive)) {
            return reply.code(422).send({ error: 'Your profile is currently inactive' });
        }
        const [req] = await app.db
            .select()
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id))
            .limit(1);
        if (!req)
            return reply.code(404).send({ error: 'Request not found' });
        if (req.status !== 'open')
            return reply.code(422).send({ error: 'Request is closed' });
        // No duplicate response from same chef
        const [existing] = await app.db
            .select({ id: schema_js_1.chefResponses.id })
            .from(schema_js_1.chefResponses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.chefResponses.requestId, id), (0, drizzle_orm_1.eq)(schema_js_1.chefResponses.chefId, chefId)))
            .limit(1);
        if (existing)
            return reply.code(409).send({ error: 'Already responded to this request' });
        // Max 5 responses cap
        const [{ count }] = await app.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
            .from(schema_js_1.chefResponses)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefResponses.requestId, id));
        if (count >= MAX_RESPONSES_PER_REQUEST) {
            return reply.code(422).send({ error: `Maximum ${MAX_RESPONSES_PER_REQUEST} responses reached` });
        }
        const [response] = await app.db
            .insert(schema_js_1.chefResponses)
            .values({
            requestId: id,
            chefId,
            proposedPrice: proposedPrice !== undefined ? String(proposedPrice) : undefined,
            comment,
            status: 'new',
        })
            .returning();
        // Notify customer about new response (fire-and-forget)
        const [customerUser, chefUser, chefProfile] = await Promise.all([
            app.db.select({ telegramId: schema_js_1.users.telegramId }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, req.customerId)).limit(1),
            app.db.select({ name: schema_js_1.users.name }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, chefId)).limit(1),
            app.db.select({ id: schema_js_1.chefProfiles.id, ratingCache: schema_js_1.chefProfiles.ratingCache, ordersCount: schema_js_1.chefProfiles.ordersCount })
                .from(schema_js_1.chefProfiles).where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, chefId)).limit(1),
        ]);
        if (customerUser[0] && chefUser[0]) {
            (0, notify_js_1.notifyNewResponse)(req, {
                ...response,
                comment: (_a = response.comment) !== null && _a !== void 0 ? _a : null,
                chefRating: (_c = (_b = chefProfile[0]) === null || _b === void 0 ? void 0 : _b.ratingCache) !== null && _c !== void 0 ? _c : null,
                chefOrdersCount: (_e = (_d = chefProfile[0]) === null || _d === void 0 ? void 0 : _d.ordersCount) !== null && _e !== void 0 ? _e : 0,
                chefProfileId: (_f = chefProfile[0]) === null || _f === void 0 ? void 0 : _f.id,
            }, customerUser[0].telegramId, chefUser[0].name).catch(err => app.log.warn({ err }, 'notify new response failed'));
        }
        return reply.code(201).send(response);
    });
    // ─── POST /requests/:id/accept-response/:responseId ──────────────────────────
    // Customer only. Accepts one chef response, automatically creates an order,
    // marks all responses as rejected (except accepted), closes request.
    app.post('/requests/:id/accept-response/:responseId', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id', 'responseId'],
                properties: {
                    id: { type: 'integer' },
                    responseId: { type: 'integer' },
                },
            },
        },
    }, async (request, reply) => {
        var _a, _b, _c;
        const customerId = request.user.sub;
        const { id, responseId } = request.params;
        const [req] = await app.db
            .select()
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id), (0, drizzle_orm_1.eq)(schema_js_1.requests.customerId, customerId)))
            .limit(1);
        if (!req)
            return reply.code(404).send({ error: 'Request not found' });
        if (req.status !== 'open')
            return reply.code(422).send({ error: 'Request is already closed' });
        const [response] = await app.db
            .select()
            .from(schema_js_1.chefResponses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.chefResponses.id, responseId), (0, drizzle_orm_1.eq)(schema_js_1.chefResponses.requestId, id)))
            .limit(1);
        if (!response)
            return reply.code(404).send({ error: 'Response not found' });
        // Create order from request + response data
        const [order] = await app.db
            .insert(schema_js_1.orders)
            .values({
            customerId,
            chefId: response.chefId,
            type: req.format,
            city: req.city,
            district: (_a = req.district) !== null && _a !== void 0 ? _a : undefined,
            scheduledAt: req.scheduledAt,
            persons: req.persons,
            description: (_b = req.description) !== null && _b !== void 0 ? _b : undefined,
            agreedPrice: (_c = response.proposedPrice) !== null && _c !== void 0 ? _c : undefined,
            status: 'awaiting_payment',
        })
            .returning();
        // Mark accepted response, reject others
        await app.db
            .update(schema_js_1.chefResponses)
            .set({ status: 'accepted' })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefResponses.id, responseId));
        await app.db
            .update(schema_js_1.chefResponses)
            .set({ status: 'rejected' })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.chefResponses.requestId, id), (0, drizzle_orm_1.sql) `${schema_js_1.chefResponses.id} != ${responseId}`));
        // Close request
        await app.db
            .update(schema_js_1.requests)
            .set({ status: 'closed' })
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id));
        return reply.code(201).send({ orderId: order.id });
    });
    // ─── PATCH /requests/:id/close ────────────────────────────────────────────────
    // Customer only. Manually closes a request without accepting any response.
    app.patch('/requests/:id/close', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
        },
    }, async (request, reply) => {
        const customerId = request.user.sub;
        const { id } = request.params;
        const [req] = await app.db
            .select()
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id), (0, drizzle_orm_1.eq)(schema_js_1.requests.customerId, customerId)))
            .limit(1);
        if (!req)
            return reply.code(404).send({ error: 'Request not found' });
        if (req.status === 'closed')
            return reply.code(422).send({ error: 'Already closed' });
        const [updated] = await app.db
            .update(schema_js_1.requests)
            .set({ status: 'closed' })
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id))
            .returning();
        return updated;
    });
    // ─── GET /requests/:id/messages ──────────────────────────────────────────────
    // Last 50 messages for the customer↔chef pair on this request, ASC by createdAt.
    // ?chefId=N selects the pair. Auth: request owner, OR the chef whose pair this is.
    app.get('/requests/:id/messages', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
            querystring: {
                type: 'object',
                required: ['chefId'],
                properties: { chefId: { type: 'integer' } },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const { id } = request.params;
        const { chefId } = request.query;
        const [req] = await app.db
            .select({ customerId: schema_js_1.requests.customerId })
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id))
            .limit(1);
        if (!req)
            return reply.code(404).send({ error: 'Request not found' });
        if (req.customerId !== userId && chefId !== userId) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const rows = await app.db
            .select({
            id: schema_js_1.messages.id,
            senderId: schema_js_1.messages.senderId,
            senderName: schema_js_1.users.name,
            body: schema_js_1.messages.body,
            createdAt: schema_js_1.messages.createdAt,
            readAt: schema_js_1.messages.readAt,
        })
            .from(schema_js_1.messages)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.messages.senderId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.messages.requestId, id), (0, drizzle_orm_1.eq)(schema_js_1.messages.chefId, chefId)))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.messages.createdAt))
            .limit(50);
        return rows.reverse();
    });
    // ─── POST /requests/:id/messages/read ────────────────────────────────────────
    // Marks unread inbound messages in the customer↔chef pair as read.
    app.post('/requests/:id/messages/read', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
            querystring: {
                type: 'object',
                required: ['chefId'],
                properties: { chefId: { type: 'integer' } },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const { id } = request.params;
        const { chefId } = request.query;
        const [req] = await app.db
            .select({ customerId: schema_js_1.requests.customerId })
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id))
            .limit(1);
        if (!req)
            return reply.code(404).send({ error: 'Request not found' });
        if (req.customerId !== userId && chefId !== userId) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const updated = await app.db
            .update(schema_js_1.messages)
            .set({ readAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.messages.requestId, id), (0, drizzle_orm_1.eq)(schema_js_1.messages.chefId, chefId), (0, drizzle_orm_1.ne)(schema_js_1.messages.senderId, userId), (0, drizzle_orm_1.isNull)(schema_js_1.messages.readAt)))
            .returning({ id: schema_js_1.messages.id });
        return { updated: updated.length };
    });
    // ─── PATCH /requests/:id/status ──────────────────────────────────────────────
    // Chef-only. Accept or decline a direct request.
    app.patch('/requests/:id/status', {
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
                properties: {
                    status: { type: 'string', enum: ['accepted', 'declined'] },
                },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const { id } = request.params;
        const { status: responseStatus } = request.body;
        const BOT_TOKEN = process.env.BOT_TOKEN;
        const FRONTEND_URL = process.env.FRONTEND_URL;
        const [req] = await app.db
            .select()
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id))
            .limit(1);
        if (!req)
            return reply.code(404).send({ error: 'Request not found' });
        if (req.chefId !== userId)
            return reply.code(403).send({ error: 'Forbidden' });
        // If accepted, create an order; if declined, just close the request
        if (responseStatus === 'accepted') {
            await app.db.transaction(async (tx) => {
                var _a, _b;
                // Create order from request
                await tx.insert(schema_js_1.orders).values({
                    customerId: req.customerId,
                    chefId: userId,
                    type: req.format,
                    city: req.city,
                    district: (_a = req.district) !== null && _a !== void 0 ? _a : undefined,
                    scheduledAt: req.scheduledAt,
                    persons: req.persons,
                    description: (_b = req.description) !== null && _b !== void 0 ? _b : undefined,
                    agreedPrice: undefined,
                    status: 'awaiting_payment',
                });
                // Close the request
                await tx
                    .update(schema_js_1.requests)
                    .set({ status: 'closed' })
                    .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id));
            });
        }
        else {
            // Just close the request without creating an order
            await app.db
                .update(schema_js_1.requests)
                .set({ status: 'closed' })
                .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, id));
        }
        // Notify customer via Telegram
        try {
            const customer = await app.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, req.customerId),
                columns: { telegramId: true },
            });
            if (customer === null || customer === void 0 ? void 0 : customer.telegramId) {
                const emoji = responseStatus === 'accepted' ? '✅' : '❌';
                const text = responseStatus === 'accepted'
                    ? `${emoji} Ваш запрос принят! Повар готов работать с вами.`
                    : `${emoji} К сожалению, повар не может выполнить этот запрос.`;
                const keyboard = responseStatus === 'accepted'
                    ? {
                        inline_keyboard: [
                            [
                                {
                                    text: '💬 Открыть чат',
                                    web_app: { url: `${FRONTEND_URL}/requests/${id}` },
                                },
                            ],
                        ],
                    }
                    : undefined;
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: customer.telegramId,
                        text,
                        reply_markup: keyboard,
                    }),
                }).catch(err => app.log.error({ err }, 'Failed to notify customer'));
            }
        }
        catch (err) {
            app.log.error({ err, requestId: id }, 'Failed to send customer notification');
        }
        return { ok: true };
    });
}
