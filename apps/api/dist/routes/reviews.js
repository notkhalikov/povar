"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = reviewsRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
async function reviewsRoutes(app) {
    // ─── POST /reviews ────────────────────────────────────────────────────────────
    // Authenticated (customer). Creates a review for a completed order.
    // One review per order. Updates chef's ratingCache.
    app.post('/reviews', {
        onRequest: [app.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['orderId', 'rating'],
                additionalProperties: false,
                properties: {
                    orderId: { type: 'integer' },
                    rating: { type: 'integer', minimum: 1, maximum: 5 },
                    tagsQuality: { type: 'array', items: { type: 'string' }, maxItems: 10 },
                    text: { type: 'string', maxLength: 2000 },
                    photoIds: { type: 'array', items: { type: 'string' }, maxItems: 10 },
                },
            },
        },
    }, async (request, reply) => {
        var _a;
        const userId = request.user.sub;
        const { orderId, rating, tagsQuality = [], text, photoIds = [] } = request.body;
        // Order must exist, be completed, and the caller must be the customer
        const [order] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, orderId), (0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId)))
            .limit(1);
        if (!order)
            return reply.code(404).send({ error: 'Order not found' });
        if (order.status !== 'completed') {
            return reply.code(422).send({ error: 'Can only review a completed order' });
        }
        // Check no existing review for this order
        const [existing] = await app.db
            .select({ id: schema_js_1.reviews.id })
            .from(schema_js_1.reviews)
            .where((0, drizzle_orm_1.eq)(schema_js_1.reviews.orderId, orderId))
            .limit(1);
        if (existing) {
            return reply.code(409).send({ error: 'Review for this order already exists' });
        }
        const [created] = await app.db
            .insert(schema_js_1.reviews)
            .values({
            orderId,
            authorId: userId,
            chefId: order.chefId,
            rating,
            tagsQuality,
            text,
            photoIds,
        })
            .returning();
        // Recalculate chef's ratingCache as true average
        const [stats] = await app.db
            .select({ avg: (0, drizzle_orm_1.sql) `avg(${schema_js_1.reviews.rating})` })
            .from(schema_js_1.reviews)
            .where((0, drizzle_orm_1.eq)(schema_js_1.reviews.chefId, order.chefId));
        const newRating = Number((_a = stats === null || stats === void 0 ? void 0 : stats.avg) !== null && _a !== void 0 ? _a : 0).toFixed(2);
        await app.db
            .update(schema_js_1.chefProfiles)
            .set({ ratingCache: newRating })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, order.chefId));
        return reply.code(201).send(created);
    });
    // ─── GET /chefs/:id/reviews ───────────────────────────────────────────────────
    // Public. Returns paginated reviews for a chef profile.
    app.get('/chefs/:id/reviews', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                },
            },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const { limit = 10, offset = 0 } = request.query;
        // Resolve chefProfile.id → users.id
        const [profile] = await app.db
            .select({ userId: schema_js_1.chefProfiles.userId })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.id, id))
            .limit(1);
        if (!profile)
            return reply.code(404).send({ error: 'Chef not found' });
        const rows = await app.db
            .select({
            id: schema_js_1.reviews.id,
            orderId: schema_js_1.reviews.orderId,
            rating: schema_js_1.reviews.rating,
            tagsQuality: schema_js_1.reviews.tagsQuality,
            text: schema_js_1.reviews.text,
            photoIds: schema_js_1.reviews.photoIds,
            chefReply: schema_js_1.reviews.chefReply,
            createdAt: schema_js_1.reviews.createdAt,
            authorName: schema_js_1.users.name,
        })
            .from(schema_js_1.reviews)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.reviews.authorId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.reviews.chefId, profile.userId), (0, drizzle_orm_1.eq)(schema_js_1.reviews.isHidden, false)))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.reviews.createdAt))
            .limit(limit)
            .offset(offset);
        const [{ total }] = await app.db
            .select({ total: (0, drizzle_orm_1.sql) `count(*)::int` })
            .from(schema_js_1.reviews)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.reviews.chefId, profile.userId), (0, drizzle_orm_1.eq)(schema_js_1.reviews.isHidden, false)));
        return { data: rows, total, limit, offset };
    });
    // ─── PATCH /reviews/:id/reply ─────────────────────────────────────────────────
    // Chef only. Add or update a reply to a review left on their profile.
    app.patch('/reviews/:id/reply', {
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
        const userId = request.user.sub;
        const role = request.user.role;
        const { id } = request.params;
        const { reply: replyText } = request.body;
        if (role !== 'chef') {
            return reply.code(403).send({ error: 'Only chefs can reply to reviews' });
        }
        // Verify this review belongs to the requesting chef
        const [profile] = await app.db
            .select({ userId: schema_js_1.chefProfiles.userId })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, userId))
            .limit(1);
        if (!profile)
            return reply.code(404).send({ error: 'Chef profile not found' });
        const [review] = await app.db
            .select({ id: schema_js_1.reviews.id })
            .from(schema_js_1.reviews)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.reviews.id, id), (0, drizzle_orm_1.eq)(schema_js_1.reviews.chefId, userId)))
            .limit(1);
        if (!review)
            return reply.code(404).send({ error: 'Review not found' });
        const [updated] = await app.db
            .update(schema_js_1.reviews)
            .set({ chefReply: replyText })
            .where((0, drizzle_orm_1.eq)(schema_js_1.reviews.id, id))
            .returning();
        return updated;
    });
    // ─── POST /reviews/:id/report ─────────────────────────────────────────────────
    // Authenticated. Flag a review for admin moderation. Increments reportCount.
    app.post('/reviews/:id/report', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const [review] = await app.db
            .select({ id: schema_js_1.reviews.id })
            .from(schema_js_1.reviews)
            .where((0, drizzle_orm_1.eq)(schema_js_1.reviews.id, id))
            .limit(1);
        if (!review)
            return reply.code(404).send({ error: 'Review not found' });
        await app.db
            .update(schema_js_1.reviews)
            .set({ reportCount: (0, drizzle_orm_1.sql) `${schema_js_1.reviews.reportCount} + 1` })
            .where((0, drizzle_orm_1.eq)(schema_js_1.reviews.id, id));
        return reply.code(204).send();
    });
}
