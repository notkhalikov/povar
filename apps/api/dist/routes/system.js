"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = systemRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const SYSTEM_SECRET = (_a = process.env.SYSTEM_SECRET) !== null && _a !== void 0 ? _a : '';
async function systemRoutes(app) {
    /**
     * GET /system/user-context?telegramId=X
     *
     * Internal endpoint used by the bot to determine smart /start context.
     * Protected by x-system-secret header (must match SYSTEM_SECRET env var).
     *
     * Returns:
     *   { found: false }
     *   or
     *   {
     *     found: true,
     *     role: 'customer' | 'chef',
     *     isChef: boolean,
     *     chefStatus: 'active' | 'vacation' | null,
     *     activeOrdersCount: number,        // for customer: active orders; for chef: active orders
     *     activeOrder: { id, scheduledAt } | null,  // customer's nearest active order
     *     incomingRequestsCount: number,    // chef only: open requests awaiting response
     *   }
     */
    app.get('/system/user-context', {
        schema: {
            querystring: {
                type: 'object',
                required: ['telegramId'],
                properties: {
                    telegramId: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        var _a;
        const secret = request.headers['x-system-secret'];
        if (!SYSTEM_SECRET || secret !== SYSTEM_SECRET) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const telegramId = parseInt(request.query.telegramId, 10);
        if (isNaN(telegramId)) {
            return reply.code(400).send({ error: 'Invalid telegramId' });
        }
        // Look up user
        const [user] = await app.db
            .select({
            id: schema_js_1.users.id,
            role: schema_js_1.users.role,
            name: schema_js_1.users.name,
        })
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.telegramId, telegramId))
            .limit(1);
        if (!user) {
            return { found: false };
        }
        const isChef = user.role === 'chef';
        // ── Chef branch ───────────────────────────────────────────────────────────
        if (isChef) {
            const [profile] = await app.db
                .select({ isActive: schema_js_1.chefProfiles.isActive, city: schema_js_1.users.city })
                .from(schema_js_1.chefProfiles)
                .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.chefProfiles.userId))
                .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, user.id))
                .limit(1);
            const chefStatus = profile ? (profile.isActive ? 'active' : 'vacation') : 'active';
            // Count open chef_responses for this chef where request is still open
            // (i.e. requests in the chef's city that have NO response from this chef yet)
            const [{ value: incomingRequestsCount }] = await app.db
                .select({ value: (0, drizzle_orm_1.count)() })
                .from(schema_js_1.requests)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.requests.status, 'open')));
            // Count active orders for chef
            const [{ value: activeOrdersCount }] = await app.db
                .select({ value: (0, drizzle_orm_1.count)() })
                .from(schema_js_1.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.chefId, user.id), (0, drizzle_orm_1.inArray)(schema_js_1.orders.status, ['paid', 'in_progress', 'awaiting_payment'])));
            return {
                found: true,
                role: user.role,
                isChef: true,
                chefStatus,
                activeOrdersCount,
                activeOrder: null,
                incomingRequestsCount: Number(incomingRequestsCount),
            };
        }
        // ── Customer branch ───────────────────────────────────────────────────────
        const activeOrders = await app.db
            .select({ id: schema_js_1.orders.id, scheduledAt: schema_js_1.orders.scheduledAt })
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, user.id), (0, drizzle_orm_1.inArray)(schema_js_1.orders.status, ['awaiting_payment', 'paid', 'in_progress'])))
            .limit(1);
        const activeOrder = (_a = activeOrders[0]) !== null && _a !== void 0 ? _a : null;
        return {
            found: true,
            role: user.role,
            isChef: false,
            chefStatus: null,
            activeOrdersCount: activeOrders.length,
            activeOrder: activeOrder
                ? { id: activeOrder.id, scheduledAt: activeOrder.scheduledAt }
                : null,
            incomingRequestsCount: 0,
        };
    });
    /**
     * PATCH /system/chef-active
     *
     * Called by the bot's activate_chef callback query to flip isActive=true.
     * Protected by x-system-secret header.
     */
    app.patch('/system/chef-active', {
        schema: {
            body: {
                type: 'object',
                required: ['telegramId'],
                properties: {
                    telegramId: { type: 'integer' },
                },
            },
        },
    }, async (request, reply) => {
        const secret = request.headers['x-system-secret'];
        if (!SYSTEM_SECRET || secret !== SYSTEM_SECRET) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { telegramId } = request.body;
        const [user] = await app.db
            .select({ id: schema_js_1.users.id })
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.telegramId, telegramId))
            .limit(1);
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }
        await app.db
            .update(schema_js_1.chefProfiles)
            .set({ isActive: true })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, user.id));
        return { ok: true };
    });
    // ─── GET /chat-sessions/:telegramId ──────────────────────────────────────────
    app.get('/chat-sessions/:telegramId', async (request, reply) => {
        const secret = request.headers['x-system-secret'];
        if (!SYSTEM_SECRET || secret !== SYSTEM_SECRET) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const tid = parseInt(request.params.telegramId, 10);
        if (isNaN(tid))
            return reply.code(400).send({ error: 'Invalid telegramId' });
        const [session] = await app.db
            .select()
            .from(schema_js_1.chatSessions)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chatSessions.initiatorTelegramId, tid))
            .limit(1);
        if (!session)
            return reply.code(404).send({ error: 'Session not found' });
        return session;
    });
    app.post('/chat-sessions', {
        schema: {
            body: {
                type: 'object',
                required: ['orderId', 'initiatorTelegramId', 'recipientTelegramId', 'role'],
                additionalProperties: false,
                properties: {
                    orderId: { type: 'integer' },
                    initiatorTelegramId: { type: 'integer' },
                    recipientTelegramId: { type: 'integer' },
                    role: { type: 'string', maxLength: 20 },
                },
            },
        },
    }, async (request, reply) => {
        const secret = request.headers['x-system-secret'];
        if (!SYSTEM_SECRET || secret !== SYSTEM_SECRET) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { orderId, initiatorTelegramId, recipientTelegramId, role } = request.body;
        await app.db
            .insert(schema_js_1.chatSessions)
            .values({ orderId, initiatorTelegramId, recipientTelegramId, role })
            .onConflictDoUpdate({
            target: schema_js_1.chatSessions.initiatorTelegramId,
            set: { orderId, recipientTelegramId, role, createdAt: new Date() },
        });
        return reply.code(201).send({ ok: true });
    });
    // ─── DELETE /chat-sessions/:telegramId ───────────────────────────────────────
    app.delete('/chat-sessions/:telegramId', async (request, reply) => {
        const secret = request.headers['x-system-secret'];
        if (!SYSTEM_SECRET || secret !== SYSTEM_SECRET) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const tid = parseInt(request.params.telegramId, 10);
        if (isNaN(tid))
            return reply.code(400).send({ error: 'Invalid telegramId' });
        await app.db
            .delete(schema_js_1.chatSessions)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chatSessions.initiatorTelegramId, tid));
        return { ok: true };
    });
}
