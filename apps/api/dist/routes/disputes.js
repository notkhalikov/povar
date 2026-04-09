"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = disputesRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const notify_js_1 = require("../services/notify.js");
async function disputesRoutes(app) {
    // ─── POST /disputes ───────────────────────────────────────────────────────────
    // Authenticated. Opens a dispute for a paid or in_progress order.
    // Sets order status to dispute_pending and notifies the other party.
    app.post('/disputes', {
        onRequest: [app.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['orderId', 'reasonCode', 'description'],
                additionalProperties: false,
                properties: {
                    orderId: { type: 'integer' },
                    reasonCode: { type: 'string', minLength: 1, maxLength: 100 },
                    description: { type: 'string', minLength: 1, maxLength: 5000 },
                    attachments: { type: 'array', items: { type: 'string' }, maxItems: 10 },
                },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const { orderId, reasonCode, description, attachments = [] } = request.body;
        // Caller must be a participant of the order
        const [order] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, orderId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId), (0, drizzle_orm_1.eq)(schema_js_1.orders.chefId, userId))))
            .limit(1);
        if (!order)
            return reply.code(404).send({ error: 'Order not found' });
        if (order.status !== 'paid' && order.status !== 'in_progress') {
            return reply.code(422).send({ error: `Cannot open dispute for order in status "${order.status}"` });
        }
        const openedBy = userId === order.customerId ? 'customer' : 'chef';
        // Transition order to dispute_pending
        await app.db
            .update(schema_js_1.orders)
            .set({ status: 'dispute_pending', updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, orderId));
        const [dispute] = await app.db
            .insert(schema_js_1.disputes)
            .values({ orderId, openedBy, reasonCode, description, attachments, status: 'open' })
            .returning();
        app.log.info({ event: 'dispute_opened', disputeId: dispute.id, orderId, openedBy });
        // Notify the other party (fire-and-forget)
        const otherUserId = userId === order.customerId ? order.chefId : order.customerId;
        const [otherUser] = await app.db
            .select({ telegramId: schema_js_1.users.telegramId })
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, otherUserId))
            .limit(1);
        if (otherUser) {
            (0, notify_js_1.notifyDisputeOpened)(dispute, order, otherUser.telegramId)
                .catch(err => app.log.warn({ err }, 'notify dispute open failed'));
        }
        return reply.code(201).send(dispute);
    });
    // ─── GET /disputes/by-order/:orderId ─────────────────────────────────────────
    // Authenticated. Returns the dispute for a given order (for participants).
    // Must be registered before /disputes/:id to avoid :id matching "by-order".
    app.get('/disputes/by-order/:orderId', {
        onRequest: [app.authenticate],
        schema: {
            params: {
                type: 'object',
                required: ['orderId'],
                properties: { orderId: { type: 'integer' } },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const role = request.user.role;
        const { orderId } = request.params;
        // Access check: participant or elevated role
        if (role !== 'support' && role !== 'admin') {
            const [order] = await app.db
                .select({ customerId: schema_js_1.orders.customerId, chefId: schema_js_1.orders.chefId })
                .from(schema_js_1.orders)
                .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, orderId))
                .limit(1);
            if (!order || (order.customerId !== userId && order.chefId !== userId)) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
        }
        const [dispute] = await app.db
            .select()
            .from(schema_js_1.disputes)
            .where((0, drizzle_orm_1.eq)(schema_js_1.disputes.orderId, orderId))
            .limit(1);
        if (!dispute)
            return reply.code(404).send({ error: 'No dispute for this order' });
        return dispute;
    });
    // ─── GET /disputes/:id ────────────────────────────────────────────────────────
    // Authenticated. Returns dispute details to both order participants and support/admin.
    app.get('/disputes/:id', {
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
        const [dispute] = await app.db
            .select()
            .from(schema_js_1.disputes)
            .where((0, drizzle_orm_1.eq)(schema_js_1.disputes.id, id))
            .limit(1);
        if (!dispute)
            return reply.code(404).send({ error: 'Dispute not found' });
        if (role !== 'support' && role !== 'admin') {
            const [order] = await app.db
                .select({ customerId: schema_js_1.orders.customerId, chefId: schema_js_1.orders.chefId })
                .from(schema_js_1.orders)
                .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, dispute.orderId))
                .limit(1);
            if (!order || (order.customerId !== userId && order.chefId !== userId)) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
        }
        return dispute;
    });
    // ─── PATCH /disputes/:id/resolve ─────────────────────────────────────────────
    // Support/admin only. Resolves a dispute and transitions the order to a final state.
    app.patch('/disputes/:id/resolve', {
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
        const role = request.user.role;
        if (role !== 'support' && role !== 'admin') {
            return reply.code(403).send({ error: 'Only support or admin can resolve disputes' });
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
        if (dispute.status === 'resolved') {
            return reply.code(422).send({ error: 'Dispute is already resolved' });
        }
        // Determine final order status: refunds → refunded, no refund → completed
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
        // Notify both parties (fire-and-forget)
        const [orderFull] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, dispute.orderId))
            .limit(1);
        if (orderFull) {
            const [customerUser, chefUser] = await Promise.all([
                app.db.select({ telegramId: schema_js_1.users.telegramId }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, orderFull.customerId)).limit(1),
                app.db.select({ telegramId: schema_js_1.users.telegramId }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, orderFull.chefId)).limit(1),
            ]);
            if (customerUser[0] && chefUser[0]) {
                (0, notify_js_1.notifyDisputeResolved)(resolved, orderFull, customerUser[0].telegramId, chefUser[0].telegramId)
                    .catch(err => app.log.warn({ err }, 'notify dispute resolved failed'));
            }
        }
        return resolved;
    });
}
