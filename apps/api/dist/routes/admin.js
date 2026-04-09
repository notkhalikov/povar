"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = adminRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const schema_js_1 = require("../db/schema.js");
const notify_js_1 = require("../services/notify.js");
// ─── Access guard ─────────────────────────────────────────────────────────────
function isAdminOrSupport(role) {
    return role === 'admin' || role === 'support';
}
async function adminRoutes(app) {
    /**
     * GET /admin/chefs/pending
     * Admin/support. Returns chefs with verificationStatus='pending', newest first.
     */
    app.get('/admin/chefs/pending', {
        onRequest: [app.authenticate],
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const rows = await app.db
            .select({
            id: schema_js_1.chefProfiles.id,
            userId: schema_js_1.chefProfiles.userId,
            name: schema_js_1.users.name,
            city: schema_js_1.users.city,
            telegramId: schema_js_1.users.telegramId,
            verificationStatus: schema_js_1.chefProfiles.verificationStatus,
            verificationDocumentId: schema_js_1.chefProfiles.verificationDocumentId,
            verificationSelfieId: schema_js_1.chefProfiles.verificationSelfieId,
            ordersCount: schema_js_1.chefProfiles.ordersCount,
            ratingCache: schema_js_1.chefProfiles.ratingCache,
        })
            .from(schema_js_1.chefProfiles)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, schema_js_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.verificationStatus, 'pending'))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.chefProfiles.id));
        return { data: rows };
    });
    /**
     * PATCH /admin/chefs/:id/verify
     * Admin/support. Approves or rejects a chef's verification request.
     * Notifies the chef via Telegram.
     */
    app.patch('/admin/chefs/:id/verify', {
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
                additionalProperties: false,
                properties: {
                    status: { type: 'string', enum: ['approved', 'rejected'] },
                    comment: { type: 'string', maxLength: 1000 },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { id } = request.params;
        const { status, comment } = request.body;
        const [row] = await app.db
            .select({ verificationStatus: schema_js_1.chefProfiles.verificationStatus, userId: schema_js_1.chefProfiles.userId })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.id, id))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Chef profile not found' });
        const [updated] = await app.db
            .update(schema_js_1.chefProfiles)
            .set({ verificationStatus: status })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.id, id))
            .returning({
            id: schema_js_1.chefProfiles.id,
            verificationStatus: schema_js_1.chefProfiles.verificationStatus,
        });
        // Notify chef
        const [userRow] = await app.db
            .select({ telegramId: schema_js_1.users.telegramId })
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, row.userId))
            .limit(1);
        if (userRow) {
            (0, notify_js_1.notifyVerificationDecision)(userRow.telegramId, status === 'approved', comment).catch(err => console.error('notify chef verification decision failed', err));
        }
        return updated;
    });
    /**
     * GET /admin/users
     * Admin/support. Paginated user list with optional role/status filters.
     */
    app.get('/admin/users', {
        onRequest: [app.authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    role: { type: 'string' },
                    status: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { role, status, limit = 50, offset = 0 } = request.query;
        const conditions = [];
        if (role)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.users.role}::text = ${role}`);
        if (status)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.users.status}::text = ${status}`);
        const rows = await app.db
            .select({
            id: schema_js_1.users.id,
            telegramId: schema_js_1.users.telegramId,
            name: schema_js_1.users.name,
            role: schema_js_1.users.role,
            status: schema_js_1.users.status,
            city: schema_js_1.users.city,
            utmSource: schema_js_1.users.utmSource,
            utmMedium: schema_js_1.users.utmMedium,
            utmCampaign: schema_js_1.users.utmCampaign,
            createdAt: schema_js_1.users.createdAt,
        })
            .from(schema_js_1.users)
            .where(conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.users.createdAt))
            .limit(limit)
            .offset(offset);
        return { data: rows, limit, offset };
    });
    /**
     * PATCH /admin/users/:id/status
     * Admin/support. Bans or unbans a user.
     */
    app.patch('/admin/users/:id/status', {
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
                additionalProperties: false,
                properties: {
                    status: { type: 'string', enum: ['active', 'banned'] },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { id } = request.params;
        const { status } = request.body;
        const [updated] = await app.db
            .update(schema_js_1.users)
            .set({ status })
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, id))
            .returning({ id: schema_js_1.users.id, name: schema_js_1.users.name, status: schema_js_1.users.status });
        if (!updated)
            return reply.code(404).send({ error: 'User not found' });
        return updated;
    });
    /**
     * GET /admin/orders
     * Admin/support. Paginated order list with optional filters.
     */
    app.get('/admin/orders', {
        onRequest: [app.authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    city: { type: 'string' },
                    from: { type: 'string' },
                    to: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { status, city, from, to, limit = 50, offset = 0 } = request.query;
        const customerUser = (0, pg_core_1.alias)(schema_js_1.users, 'customer_user');
        const chefUser = (0, pg_core_1.alias)(schema_js_1.users, 'chef_user');
        const conditions = [];
        if (status)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.orders.status}::text = ${status}`);
        if (city)
            conditions.push((0, drizzle_orm_1.eq)(schema_js_1.orders.city, city));
        if (from)
            conditions.push((0, drizzle_orm_1.gte)(schema_js_1.orders.createdAt, new Date(from)));
        if (to)
            conditions.push((0, drizzle_orm_1.lte)(schema_js_1.orders.createdAt, new Date(to)));
        const rows = await app.db
            .select({
            id: schema_js_1.orders.id,
            status: schema_js_1.orders.status,
            type: schema_js_1.orders.type,
            city: schema_js_1.orders.city,
            district: schema_js_1.orders.district,
            scheduledAt: schema_js_1.orders.scheduledAt,
            agreedPrice: schema_js_1.orders.agreedPrice,
            persons: schema_js_1.orders.persons,
            createdAt: schema_js_1.orders.createdAt,
            customerName: customerUser.name,
            chefName: chefUser.name,
            customerId: schema_js_1.orders.customerId,
            chefId: schema_js_1.orders.chefId,
        })
            .from(schema_js_1.orders)
            .innerJoin(customerUser, (0, drizzle_orm_1.eq)(customerUser.id, schema_js_1.orders.customerId))
            .innerJoin(chefUser, (0, drizzle_orm_1.eq)(chefUser.id, schema_js_1.orders.chefId))
            .where(conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.orders.createdAt))
            .limit(limit)
            .offset(offset);
        return { data: rows, limit, offset };
    });
    /**
     * GET /admin/disputes
     * Admin/support. Paginated dispute list with party names.
     */
    app.get('/admin/disputes', {
        onRequest: [app.authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { status, limit = 50, offset = 0 } = request.query;
        const customerUser = (0, pg_core_1.alias)(schema_js_1.users, 'customer_user');
        const chefUser = (0, pg_core_1.alias)(schema_js_1.users, 'chef_user');
        const conditions = [];
        if (status)
            conditions.push((0, drizzle_orm_1.sql) `${schema_js_1.disputes.status}::text = ${status}`);
        const rows = await app.db
            .select({
            id: schema_js_1.disputes.id,
            orderId: schema_js_1.disputes.orderId,
            openedBy: schema_js_1.disputes.openedBy,
            reasonCode: schema_js_1.disputes.reasonCode,
            description: schema_js_1.disputes.description,
            status: schema_js_1.disputes.status,
            resolutionType: schema_js_1.disputes.resolutionType,
            resolutionComment: schema_js_1.disputes.resolutionComment,
            createdAt: schema_js_1.disputes.createdAt,
            updatedAt: schema_js_1.disputes.updatedAt,
            customerName: customerUser.name,
            chefName: chefUser.name,
            customerId: schema_js_1.orders.customerId,
            chefId: schema_js_1.orders.chefId,
        })
            .from(schema_js_1.disputes)
            .innerJoin(schema_js_1.orders, (0, drizzle_orm_1.eq)(schema_js_1.orders.id, schema_js_1.disputes.orderId))
            .innerJoin(customerUser, (0, drizzle_orm_1.eq)(customerUser.id, schema_js_1.orders.customerId))
            .innerJoin(chefUser, (0, drizzle_orm_1.eq)(chefUser.id, schema_js_1.orders.chefId))
            .where(conditions.length ? (0, drizzle_orm_1.and)(...conditions) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.disputes.createdAt))
            .limit(limit)
            .offset(offset);
        return { data: rows, limit, offset };
    });
    /**
     * PATCH /admin/disputes/:id/resolve
     * Support/admin only. Delegates to core resolve logic (duplicated here for the admin prefix).
     */
    app.patch('/admin/disputes/:id/resolve', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
            body: {
                type: 'object',
                required: ['resolutionType'],
                additionalProperties: false,
                properties: {
                    resolutionType: { type: 'string', enum: ['full_refund', 'partial_refund', 'no_refund'] },
                    resolutionComment: { type: 'string', maxLength: 2000 },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { id } = request.params;
        const { resolutionType, resolutionComment } = request.body;
        const [dispute] = await app.db
            .select()
            .from(schema_js_1.disputes)
            .where((0, drizzle_orm_1.eq)(schema_js_1.disputes.id, id))
            .limit(1);
        if (!dispute)
            return reply.code(404).send({ error: 'Dispute not found' });
        if (dispute.status === 'resolved')
            return reply.code(422).send({ error: 'Already resolved' });
        const finalOrderStatus = resolutionType === 'no_refund' ? 'completed' : 'refunded';
        await app.db
            .update(schema_js_1.orders)
            .set({ status: finalOrderStatus, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, dispute.orderId));
        const [resolved] = await app.db
            .update(schema_js_1.disputes)
            .set({ status: 'resolved', resolutionType, resolutionComment, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.disputes.id, id))
            .returning();
        return resolved;
    });
    /**
     * GET /admin/reviews
     * Admin/support. Returns reviews for moderation (newest first).
     */
    app.get('/admin/reviews', {
        onRequest: [app.authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    flagged: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { limit = 50, offset = 0 } = request.query;
        const authorUser = (0, pg_core_1.alias)(schema_js_1.users, 'author_user');
        const rows = await app.db
            .select({
            id: schema_js_1.reviews.id,
            orderId: schema_js_1.reviews.orderId,
            chefId: schema_js_1.reviews.chefId,
            rating: schema_js_1.reviews.rating,
            tagsQuality: schema_js_1.reviews.tagsQuality,
            text: schema_js_1.reviews.text,
            chefReply: schema_js_1.reviews.chefReply,
            isHidden: schema_js_1.reviews.isHidden,
            reportCount: schema_js_1.reviews.reportCount,
            createdAt: schema_js_1.reviews.createdAt,
            authorName: authorUser.name,
        })
            .from(schema_js_1.reviews)
            .innerJoin(authorUser, (0, drizzle_orm_1.eq)(authorUser.id, schema_js_1.reviews.authorId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.reviews.createdAt))
            .limit(limit)
            .offset(offset);
        return { data: rows, limit, offset };
    });
    /**
     * PATCH /admin/reviews/:id/hide
     * Admin/support. Toggles isHidden on a review.
     */
    app.patch('/admin/reviews/:id/hide', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
            body: {
                type: 'object',
                required: ['hidden'],
                additionalProperties: false,
                properties: {
                    hidden: { type: 'boolean' },
                },
            },
        },
    }, async (request, reply) => {
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { id } = request.params;
        const { hidden } = request.body;
        const [updated] = await app.db
            .update(schema_js_1.reviews)
            .set({ isHidden: hidden })
            .where((0, drizzle_orm_1.eq)(schema_js_1.reviews.id, id))
            .returning();
        if (!updated)
            return reply.code(404).send({ error: 'Review not found' });
        return updated;
    });
    /**
     * GET /admin/stats
     * Admin/support. Returns aggregate metrics + UTM/city breakdowns.
     * Optional filters: from, to (ISO dates), city, utmSource.
     */
    app.get('/admin/stats', {
        onRequest: [app.authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    from: { type: 'string' },
                    to: { type: 'string' },
                    city: { type: 'string' },
                    utmSource: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        if (!isAdminOrSupport(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { from, to, city, utmSource } = request.query;
        // Build date + city conditions for orders table
        const orderConditions = [];
        if (from)
            orderConditions.push((0, drizzle_orm_1.gte)(schema_js_1.orders.createdAt, new Date(from)));
        if (to)
            orderConditions.push((0, drizzle_orm_1.lte)(schema_js_1.orders.createdAt, new Date(to)));
        if (city)
            orderConditions.push((0, drizzle_orm_1.eq)(schema_js_1.orders.city, city));
        // Condition applied to users join for UTM filter
        const utmCondition = utmSource
            ? (0, drizzle_orm_1.sql) `${schema_js_1.users.utmSource} = ${utmSource}`
            : undefined;
        const baseOrderWhere = orderConditions.length ? (0, drizzle_orm_1.and)(...orderConditions) : undefined;
        // Orders joined with customers for UTM filter
        const orderWithUtmWhere = () => {
            const parts = [...orderConditions];
            if (utmCondition)
                parts.push(utmCondition);
            return parts.length ? (0, drizzle_orm_1.and)(...parts) : undefined;
        };
        const [totalOrdersRow, revenueRow, homeVisitRow, deliveryRow, disputesRow, openDisputesRow, chefsRow, usersRow, byCityRows, byUtmRows,] = await Promise.all([
            // totals (filtered)
            app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.orders)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.orders.customerId))
                .where(orderWithUtmWhere()),
            app.db.select({ total: (0, drizzle_orm_1.sum)(schema_js_1.orders.agreedPrice) })
                .from(schema_js_1.orders)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.orders.customerId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_js_1.orders.status}::text IN ('completed', 'refunded')`, ...(orderConditions.length ? orderConditions : []), ...(utmCondition ? [utmCondition] : []))),
            app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.orders)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.orders.customerId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_js_1.orders.type}::text = 'home_visit'`, orderWithUtmWhere())),
            app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.orders)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.orders.customerId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_js_1.orders.type}::text = 'delivery'`, orderWithUtmWhere())),
            // disputes unfiltered
            app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.disputes),
            app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.disputes)
                .where((0, drizzle_orm_1.sql) `${schema_js_1.disputes.status}::text != 'resolved'`),
            // chefs & users unfiltered
            app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.chefProfiles)
                .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.verificationStatus, 'approved')),
            app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.users),
            // orders_by_city
            app.db
                .select({
                city: schema_js_1.orders.city,
                count: (0, drizzle_orm_1.count)(),
                revenue: (0, drizzle_orm_1.sum)(schema_js_1.orders.agreedPrice),
            })
                .from(schema_js_1.orders)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.orders.customerId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_js_1.orders.status}::text IN ('completed', 'refunded')`, ...(orderConditions.length ? orderConditions : []), ...(utmCondition ? [utmCondition] : [])))
                .groupBy(schema_js_1.orders.city)
                .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)())),
            // orders_by_utm
            app.db
                .select({
                utmSource: schema_js_1.users.utmSource,
                count: (0, drizzle_orm_1.count)(),
                revenue: (0, drizzle_orm_1.sum)(schema_js_1.orders.agreedPrice),
            })
                .from(schema_js_1.orders)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.orders.customerId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_js_1.orders.status}::text IN ('completed', 'refunded')`, ...(orderConditions.length ? orderConditions : [])))
                .groupBy(schema_js_1.users.utmSource)
                .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)())),
        ]);
        // Funnel: registered / paid
        const registeredRow = await app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.users);
        const createdOrderRow = await app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.orders)
            .where(baseOrderWhere);
        const paidOrderRow = await app.db.select({ n: (0, drizzle_orm_1.count)() }).from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.sql) `${schema_js_1.orders.status}::text IN ('paid', 'in_progress', 'completed', 'refunded')`, ...(orderConditions.length ? orderConditions : [])));
        return {
            totalOrders: Number((_b = (_a = totalOrdersRow[0]) === null || _a === void 0 ? void 0 : _a.n) !== null && _b !== void 0 ? _b : 0),
            totalRevenue: Number((_d = (_c = revenueRow[0]) === null || _c === void 0 ? void 0 : _c.total) !== null && _d !== void 0 ? _d : 0),
            ordersByType: {
                home_visit: Number((_f = (_e = homeVisitRow[0]) === null || _e === void 0 ? void 0 : _e.n) !== null && _f !== void 0 ? _f : 0),
                delivery: Number((_h = (_g = deliveryRow[0]) === null || _g === void 0 ? void 0 : _g.n) !== null && _h !== void 0 ? _h : 0),
            },
            totalDisputes: Number((_k = (_j = disputesRow[0]) === null || _j === void 0 ? void 0 : _j.n) !== null && _k !== void 0 ? _k : 0),
            openDisputes: Number((_m = (_l = openDisputesRow[0]) === null || _l === void 0 ? void 0 : _l.n) !== null && _m !== void 0 ? _m : 0),
            approvedChefs: Number((_p = (_o = chefsRow[0]) === null || _o === void 0 ? void 0 : _o.n) !== null && _p !== void 0 ? _p : 0),
            totalUsers: Number((_r = (_q = usersRow[0]) === null || _q === void 0 ? void 0 : _q.n) !== null && _r !== void 0 ? _r : 0),
            ordersByCity: byCityRows.map(r => {
                var _a;
                return ({
                    city: r.city,
                    count: Number(r.count),
                    revenue: Number((_a = r.revenue) !== null && _a !== void 0 ? _a : 0),
                });
            }),
            ordersByUtm: byUtmRows.map(r => {
                var _a, _b;
                return ({
                    utmSource: (_a = r.utmSource) !== null && _a !== void 0 ? _a : '(прямой)',
                    count: Number(r.count),
                    revenue: Number((_b = r.revenue) !== null && _b !== void 0 ? _b : 0),
                });
            }),
            funnel: {
                registered: Number((_t = (_s = registeredRow[0]) === null || _s === void 0 ? void 0 : _s.n) !== null && _t !== void 0 ? _t : 0),
                createdOrder: Number((_v = (_u = createdOrderRow[0]) === null || _u === void 0 ? void 0 : _u.n) !== null && _v !== void 0 ? _v : 0),
                paidOrder: Number((_x = (_w = paidOrderRow[0]) === null || _w === void 0 ? void 0 : _w.n) !== null && _x !== void 0 ? _x : 0),
            },
        };
    });
    /**
     * GET /admin/export/orders.csv
     * Admin/support. Streams all orders as CSV. Auth via ?token= query param.
     */
    app.get('/admin/export/orders.csv', {
        schema: {
            querystring: {
                type: 'object',
                properties: { token: { type: 'string' } },
            },
        },
    }, async (request, reply) => {
        var _a, _b;
        // Accept JWT from query param since this is a direct browser download link
        const token = ((_a = request.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '')) ||
            request.query.token;
        if (!token)
            return reply.code(401).send({ error: 'Unauthorized' });
        let payload;
        try {
            payload = app.jwt.verify(token);
        }
        catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }
        if (!isAdminOrSupport((_b = payload.role) !== null && _b !== void 0 ? _b : '')) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const customerUser = (0, pg_core_1.alias)(schema_js_1.users, 'customer_user');
        const chefUser = (0, pg_core_1.alias)(schema_js_1.users, 'chef_user');
        const rows = await app.db
            .select({
            id: schema_js_1.orders.id,
            status: schema_js_1.orders.status,
            type: schema_js_1.orders.type,
            city: schema_js_1.orders.city,
            district: schema_js_1.orders.district,
            scheduledAt: schema_js_1.orders.scheduledAt,
            agreedPrice: schema_js_1.orders.agreedPrice,
            persons: schema_js_1.orders.persons,
            createdAt: schema_js_1.orders.createdAt,
            customerName: customerUser.name,
            chefName: chefUser.name,
        })
            .from(schema_js_1.orders)
            .innerJoin(customerUser, (0, drizzle_orm_1.eq)(customerUser.id, schema_js_1.orders.customerId))
            .innerJoin(chefUser, (0, drizzle_orm_1.eq)(chefUser.id, schema_js_1.orders.chefId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.orders.createdAt));
        const header = 'id,status,type,city,district,scheduledAt,agreedPrice,persons,customerName,chefName,createdAt';
        const csvRows = rows.map(r => {
            var _a, _b;
            return [
                r.id, r.status, r.type, r.city,
                (_a = r.district) !== null && _a !== void 0 ? _a : '',
                r.scheduledAt.toISOString(),
                (_b = r.agreedPrice) !== null && _b !== void 0 ? _b : '',
                r.persons,
                csvEscape(r.customerName),
                csvEscape(r.chefName),
                r.createdAt.toISOString(),
            ].join(',');
        });
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="orders.csv"');
        return reply.send('\uFEFF' + [header, ...csvRows].join('\n'));
    });
    /**
     * GET /admin/export/users.csv
     * Admin/support. Streams all users as CSV. Auth via ?token= query param.
     */
    app.get('/admin/export/users.csv', {
        schema: {
            querystring: {
                type: 'object',
                properties: { token: { type: 'string' } },
            },
        },
    }, async (request, reply) => {
        var _a, _b;
        const token = ((_a = request.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '')) ||
            request.query.token;
        if (!token)
            return reply.code(401).send({ error: 'Unauthorized' });
        let payload;
        try {
            payload = app.jwt.verify(token);
        }
        catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }
        if (!isAdminOrSupport((_b = payload.role) !== null && _b !== void 0 ? _b : '')) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const rows = await app.db
            .select({
            id: schema_js_1.users.id,
            telegramId: schema_js_1.users.telegramId,
            name: schema_js_1.users.name,
            role: schema_js_1.users.role,
            status: schema_js_1.users.status,
            city: schema_js_1.users.city,
            utmSource: schema_js_1.users.utmSource,
            utmMedium: schema_js_1.users.utmMedium,
            utmCampaign: schema_js_1.users.utmCampaign,
            utmContent: schema_js_1.users.utmContent,
            utmTerm: schema_js_1.users.utmTerm,
            createdAt: schema_js_1.users.createdAt,
        })
            .from(schema_js_1.users)
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.users.createdAt));
        const header = 'id,telegramId,name,role,status,city,utmSource,utmMedium,utmCampaign,utmContent,utmTerm,createdAt';
        const csvRows = rows.map(r => {
            var _a, _b, _c, _d, _e, _f;
            return [
                r.id, r.telegramId,
                csvEscape(r.name),
                r.role, r.status,
                (_a = r.city) !== null && _a !== void 0 ? _a : '',
                (_b = r.utmSource) !== null && _b !== void 0 ? _b : '',
                (_c = r.utmMedium) !== null && _c !== void 0 ? _c : '',
                (_d = r.utmCampaign) !== null && _d !== void 0 ? _d : '',
                (_e = r.utmContent) !== null && _e !== void 0 ? _e : '',
                (_f = r.utmTerm) !== null && _f !== void 0 ? _f : '',
                r.createdAt.toISOString(),
            ].join(',');
        });
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="users.csv"');
        return reply.send('\uFEFF' + [header, ...csvRows].join('\n'));
    });
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function csvEscape(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
