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
                },
            },
        },
    }, async (request, reply) => {
        const customerId = request.user.sub;
        const { city, district, scheduledAt, format, persons, description, budget } = request.body;
        const [created] = await app.db
            .insert(schema_js_1.requests)
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
            .returning();
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
        return { data: rows };
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
}
