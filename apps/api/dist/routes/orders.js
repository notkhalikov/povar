"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ordersRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const order_state_js_1 = require("../services/order-state.js");
const notify_js_1 = require("../services/notify.js");
async function ordersRoutes(app) {
    // ─── POST /orders ────────────────────────────────────────────────────────────
    app.post('/orders', {
        onRequest: [app.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['chefProfileId', 'type', 'city', 'scheduledAt', 'persons'],
                additionalProperties: false,
                properties: {
                    chefProfileId: { type: 'integer' },
                    type: { type: 'string', enum: ['home_visit', 'delivery'] },
                    city: { type: 'string', minLength: 1 },
                    district: { type: 'string' },
                    address: { type: 'string' },
                    scheduledAt: { type: 'string' },
                    persons: { type: 'integer', minimum: 1, maximum: 50 },
                    description: { type: 'string', maxLength: 2000 },
                    agreedPrice: { type: 'number', minimum: 0 },
                    productsBuyer: { type: 'string', enum: ['customer', 'chef'] },
                    productsBudget: { type: 'number', minimum: 0 },
                },
            },
        },
    }, async (request, reply) => {
        const customerId = request.user.sub;
        const body = request.body;
        // Validate scheduledAt is not in the past
        const scheduledDate = new Date(body.scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return reply.code(400).send({ error: 'Invalid scheduledAt date', code: 'INVALID_DATE' });
        }
        if (scheduledDate <= new Date()) {
            return reply.code(422).send({ error: 'scheduledAt must be in the future', code: 'DATE_IN_PAST' });
        }
        // Validate agreedPrice
        if (body.agreedPrice !== undefined && body.agreedPrice <= 0) {
            return reply.code(422).send({ error: 'agreedPrice must be greater than 0', code: 'INVALID_PRICE' });
        }
        // Resolve chefProfileId → chef users.id
        const [profile] = await app.db
            .select({ userId: schema_js_1.chefProfiles.userId, isActive: schema_js_1.chefProfiles.isActive, verificationStatus: schema_js_1.chefProfiles.verificationStatus })
            .from(schema_js_1.chefProfiles)
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.id, body.chefProfileId))
            .limit(1);
        if (!profile)
            return reply.code(404).send({ error: 'Chef not found' });
        if (!profile.isActive || profile.verificationStatus !== 'approved') {
            return reply.code(422).send({ error: 'Chef is not available' });
        }
        const [order] = await app.db
            .insert(schema_js_1.orders)
            .values({
            customerId,
            chefId: profile.userId,
            type: body.type,
            city: body.city,
            district: body.district,
            address: body.address,
            scheduledAt: new Date(body.scheduledAt),
            persons: body.persons,
            description: body.description,
            agreedPrice: body.agreedPrice !== undefined ? String(body.agreedPrice) : undefined,
            productsBuyer: body.productsBuyer,
            productsBudget: body.productsBudget !== undefined ? String(body.productsBudget) : undefined,
            status: 'awaiting_payment',
        })
            .returning();
        app.log.info({ event: 'order_created', orderId: order.id, customerId, chefId: profile.userId, amount: body.agreedPrice });
        // Notify chef about the new order (fire-and-forget)
        const participants = await app.db
            .select({ id: schema_js_1.users.id, name: schema_js_1.users.name, telegramId: schema_js_1.users.telegramId })
            .from(schema_js_1.users)
            .where((0, drizzle_orm_1.inArray)(schema_js_1.users.id, [profile.userId, customerId]));
        const chef = participants.find(u => u.id === profile.userId);
        const customer = participants.find(u => u.id === customerId);
        if (chef) {
            (0, notify_js_1.notifyOrderCreated)(order, chef.telegramId, customer === null || customer === void 0 ? void 0 : customer.name)
                .catch(err => app.log.warn({ err }, 'notify chef new order failed'));
        }
        return reply.code(201).send(order);
    });
    // ─── GET /orders ─────────────────────────────────────────────────────────────
    app.get('/orders', {
        onRequest: [app.authenticate],
    }, async (request) => {
        const userId = request.user.sub;
        const rows = await app.db
            .select({
            id: schema_js_1.orders.id,
            type: schema_js_1.orders.type,
            city: schema_js_1.orders.city,
            scheduledAt: schema_js_1.orders.scheduledAt,
            persons: schema_js_1.orders.persons,
            agreedPrice: schema_js_1.orders.agreedPrice,
            status: schema_js_1.orders.status,
            createdAt: schema_js_1.orders.createdAt,
            chefName: (0, drizzle_orm_1.sql) `chef_user.name`,
            customerName: (0, drizzle_orm_1.sql) `customer_user.name`,
        })
            .from(schema_js_1.orders)
            .leftJoin((0, drizzle_orm_1.sql) `users AS chef_user`, (0, drizzle_orm_1.sql) `chef_user.id = ${schema_js_1.orders.chefId}`)
            .leftJoin((0, drizzle_orm_1.sql) `users AS customer_user`, (0, drizzle_orm_1.sql) `customer_user.id = ${schema_js_1.orders.customerId}`)
            .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId), (0, drizzle_orm_1.eq)(schema_js_1.orders.chefId, userId)))
            .orderBy((0, drizzle_orm_1.sql) `${schema_js_1.orders.createdAt} DESC`);
        return { data: rows };
    });
    // ─── GET /orders/:id ─────────────────────────────────────────────────────────
    app.get('/orders/:id', {
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
        const { id } = request.params;
        const [row] = await app.db
            .select({
            id: schema_js_1.orders.id,
            customerId: schema_js_1.orders.customerId,
            chefId: schema_js_1.orders.chefId,
            type: schema_js_1.orders.type,
            city: schema_js_1.orders.city,
            district: schema_js_1.orders.district,
            address: schema_js_1.orders.address,
            scheduledAt: schema_js_1.orders.scheduledAt,
            persons: schema_js_1.orders.persons,
            description: schema_js_1.orders.description,
            agreedPrice: schema_js_1.orders.agreedPrice,
            productsBuyer: schema_js_1.orders.productsBuyer,
            productsBudget: schema_js_1.orders.productsBudget,
            status: schema_js_1.orders.status,
            chatEnabled: schema_js_1.orders.chatEnabled,
            createdAt: schema_js_1.orders.createdAt,
            updatedAt: schema_js_1.orders.updatedAt,
            chefName: (0, drizzle_orm_1.sql) `chef_user.name`,
            customerName: (0, drizzle_orm_1.sql) `customer_user.name`,
        })
            .from(schema_js_1.orders)
            .leftJoin((0, drizzle_orm_1.sql) `users AS chef_user`, (0, drizzle_orm_1.sql) `chef_user.id = ${schema_js_1.orders.chefId}`)
            .leftJoin((0, drizzle_orm_1.sql) `users AS customer_user`, (0, drizzle_orm_1.sql) `customer_user.id = ${schema_js_1.orders.customerId}`)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId), (0, drizzle_orm_1.eq)(schema_js_1.orders.chefId, userId))))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Order not found' });
        return row;
    });
    // ─── PATCH /orders/:id ───────────────────────────────────────────────────────
    // Authenticated (customer). Edits mutable fields while order is awaiting_payment.
    app.patch('/orders/:id', {
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
                    scheduledAt: { type: 'string' },
                    address: { type: 'string' },
                    district: { type: 'string' },
                    persons: { type: 'integer', minimum: 1, maximum: 50 },
                    description: { type: 'string', maxLength: 2000 },
                    agreedPrice: { type: 'number', minimum: 0 },
                    productsBuyer: { type: 'string', enum: ['customer', 'chef'] },
                    productsBudget: { type: 'number', minimum: 0 },
                },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const { id } = request.params;
        const body = request.body;
        const [order] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id), (0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId)))
            .limit(1);
        if (!order)
            return reply.code(404).send({ error: 'Order not found' });
        if (order.status !== 'awaiting_payment') {
            return reply.code(422).send({ error: 'Order can only be edited in awaiting_payment status' });
        }
        if (body.scheduledAt !== undefined) {
            const scheduledDate = new Date(body.scheduledAt);
            if (isNaN(scheduledDate.getTime())) {
                return reply.code(400).send({ error: 'Invalid scheduledAt date', code: 'INVALID_DATE' });
            }
            if (scheduledDate <= new Date()) {
                return reply.code(422).send({ error: 'scheduledAt must be in the future', code: 'DATE_IN_PAST' });
            }
        }
        if (body.agreedPrice !== undefined && body.agreedPrice <= 0) {
            return reply.code(422).send({ error: 'agreedPrice must be greater than 0', code: 'INVALID_PRICE' });
        }
        const updates = { updatedAt: new Date() };
        if (body.scheduledAt !== undefined)
            updates.scheduledAt = new Date(body.scheduledAt);
        if (body.address !== undefined)
            updates.address = body.address;
        if (body.district !== undefined)
            updates.district = body.district;
        if (body.persons !== undefined)
            updates.persons = body.persons;
        if (body.description !== undefined)
            updates.description = body.description;
        if (body.agreedPrice !== undefined)
            updates.agreedPrice = String(body.agreedPrice);
        if (body.productsBuyer !== undefined)
            updates.productsBuyer = body.productsBuyer;
        if (body.productsBudget !== undefined)
            updates.productsBudget = String(body.productsBudget);
        const [updated] = await app.db
            .update(schema_js_1.orders)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id))
            .returning();
        return updated;
    });
    // ─── POST /orders/:id/invoice ────────────────────────────────────────────────
    app.post('/orders/:id/invoice', {
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
        const { id } = request.params;
        const [order] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id), (0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId)))
            .limit(1);
        if (!order)
            return reply.code(404).send({ error: 'Order not found' });
        if (order.status !== 'awaiting_payment') {
            return reply.code(422).send({ error: `Cannot invoice order in status "${order.status}"` });
        }
        if (!order.agreedPrice) {
            return reply.code(422).send({ error: 'Agreed price must be set before creating an invoice' });
        }
        const paymentsToken = process.env.PAYMENTS_TOKEN;
        if (!paymentsToken) {
            return reply.code(503).send({ error: 'Payment provider not configured' });
        }
        // Amount in smallest currency unit (tetri for GEL: 1 GEL = 100 tetri)
        const amountTetri = Math.round(Number(order.agreedPrice) * 100);
        const tgRes = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `Заказ #${order.id}`,
                description: `${order.type === 'home_visit' ? 'Повар на дом' : 'Доставка'} · ${order.persons} чел. · ${order.city}`,
                payload: `order:${order.id}`,
                provider_token: paymentsToken,
                currency: 'GEL',
                prices: [{ label: 'Итого', amount: amountTetri }],
            }),
        });
        const tgJson = await tgRes.json();
        if (!tgJson.ok) {
            app.log.error({ tgJson }, 'createInvoiceLink failed');
            return reply.code(502).send({ error: 'Failed to create invoice', detail: tgJson.description });
        }
        // Record the pending payment
        await app.db.insert(schema_js_1.payments).values({
            orderId: order.id,
            amount: order.agreedPrice,
            currency: 'GEL',
            provider: 'telegram',
            status: 'created',
        });
        return reply.send({ invoiceUrl: tgJson.result });
    });
    // ─── POST /orders/:id/complete ───────────────────────────────────────────────
    // Authenticated (customer only). Marks an order as completed.
    // Works from both 'paid' (chef never moved it) and 'in_progress' states.
    app.post('/orders/:id/complete', {
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
        const { id } = request.params;
        const [order] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id), (0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId)))
            .limit(1);
        if (!order)
            return reply.code(404).send({ error: 'Order not found' });
        if (order.status !== 'paid' && order.status !== 'in_progress') {
            return reply.code(422).send({ error: `Cannot complete order in status "${order.status}"` });
        }
        const [updated] = await app.db
            .update(schema_js_1.orders)
            .set({ status: 'completed', updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id))
            .returning();
        // Increment chef's completed orders counter
        await app.db
            .update(schema_js_1.chefProfiles)
            .set({ ordersCount: (0, drizzle_orm_1.sql) `${schema_js_1.chefProfiles.ordersCount} + 1` })
            .where((0, drizzle_orm_1.eq)(schema_js_1.chefProfiles.userId, order.chefId));
        // Notify chef + schedule review reminder for customer (fire-and-forget)
        const [chef, customer] = await Promise.all([
            app.db.select({ telegramId: schema_js_1.users.telegramId }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, order.chefId)).limit(1),
            app.db.select({ telegramId: schema_js_1.users.telegramId }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, order.customerId)).limit(1),
        ]);
        if (chef[0]) {
            (0, notify_js_1.notifyOrderCompleted)(updated, chef[0].telegramId)
                .catch(err => app.log.warn({ err }, 'notify chef complete failed'));
        }
        return updated;
    });
    // ─── PATCH /orders/:id/status ────────────────────────────────────────────────
    app.patch('/orders/:id/status', {
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
                    status: {
                        type: 'string',
                        enum: ['draft', 'awaiting_payment', 'paid', 'in_progress', 'completed', 'dispute_pending', 'refunded', 'cancelled'],
                    },
                },
            },
        },
    }, async (request, reply) => {
        const userId = request.user.sub;
        const role = request.user.role;
        const { id } = request.params;
        const { status: nextStatus } = request.body;
        const [order] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId), (0, drizzle_orm_1.eq)(schema_js_1.orders.chefId, userId))))
            .limit(1);
        if (!order)
            return reply.code(404).send({ error: 'Order not found' });
        const err = (0, order_state_js_1.canTransition)(order.status, nextStatus, role);
        if (err) {
            return reply.code(err.code === 'FORBIDDEN' ? 403 : 422).send({ error: err.message });
        }
        const [updated] = await app.db
            .update(schema_js_1.orders)
            .set({ status: nextStatus, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id))
            .returning();
        // Notify the other party (fire-and-forget)
        if (nextStatus === 'cancelled') {
            const [chefUser, customerUser] = await Promise.all([
                app.db.select({ telegramId: schema_js_1.users.telegramId }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, order.chefId)).limit(1),
                app.db.select({ telegramId: schema_js_1.users.telegramId }).from(schema_js_1.users).where((0, drizzle_orm_1.eq)(schema_js_1.users.id, order.customerId)).limit(1),
            ]);
            if (chefUser[0] && customerUser[0]) {
                (0, notify_js_1.notifyOrderCancelled)(updated, chefUser[0].telegramId, customerUser[0].telegramId)
                    .catch(err => app.log.warn({ err }, 'notify cancelled failed'));
            }
        }
        else {
            const otherUserId = userId === order.customerId ? order.chefId : order.customerId;
            const [otherUser] = await app.db
                .select({ telegramId: schema_js_1.users.telegramId })
                .from(schema_js_1.users)
                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, otherUserId))
                .limit(1);
            if (otherUser) {
                (0, notify_js_1.notifyUser)(otherUser.telegramId, (0, notify_js_1.statusNotifyText)(nextStatus, id), id)
                    .catch(err => app.log.warn({ err }, 'notify status change failed'));
            }
        }
        return updated;
    });
    // ─── GET /orders/:id/chat-info ───────────────────────────────────────────────
    // Bot-internal endpoint. Protected by x-webhook-secret header.
    // Returns order status, chatEnabled flag, and both participants' Telegram IDs + names.
    app.get('/orders/:id/chat-info', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
            },
        },
    }, async (request, reply) => {
        const secret = request.headers['x-webhook-secret'];
        const expected = process.env.WEBHOOK_SECRET;
        if (!expected || secret !== expected) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { id } = request.params;
        const [row] = await app.db
            .select({
            id: schema_js_1.orders.id,
            customerId: schema_js_1.orders.customerId,
            chefId: schema_js_1.orders.chefId,
            status: schema_js_1.orders.status,
            chatEnabled: schema_js_1.orders.chatEnabled,
            customerTelegramId: (0, drizzle_orm_1.sql) `customer_user.telegram_id`,
            chefTelegramId: (0, drizzle_orm_1.sql) `chef_user.telegram_id`,
            customerName: (0, drizzle_orm_1.sql) `customer_user.name`,
            chefName: (0, drizzle_orm_1.sql) `chef_user.name`,
        })
            .from(schema_js_1.orders)
            .leftJoin((0, drizzle_orm_1.sql) `users AS customer_user`, (0, drizzle_orm_1.sql) `customer_user.id = ${schema_js_1.orders.customerId}`)
            .leftJoin((0, drizzle_orm_1.sql) `users AS chef_user`, (0, drizzle_orm_1.sql) `chef_user.id = ${schema_js_1.orders.chefId}`)
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id))
            .limit(1);
        if (!row)
            return reply.code(404).send({ error: 'Order not found' });
        return row;
    });
    // ─── POST /orders/:id/enable-chat ────────────────────────────────────────────
    // Authenticated. Either participant can enable the relay chat once the order
    // is paid or further along. Returns the chat deep-link for the bot.
    app.post('/orders/:id/enable-chat', {
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
        const { id } = request.params;
        const [order] = await app.db
            .select()
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.orders.customerId, userId), (0, drizzle_orm_1.eq)(schema_js_1.orders.chefId, userId))))
            .limit(1);
        if (!order)
            return reply.code(404).send({ error: 'Order not found' });
        const CHAT_ALLOWED_STATUSES = ['paid', 'in_progress', 'completed', 'dispute_pending'];
        if (!CHAT_ALLOWED_STATUSES.includes(order.status)) {
            return reply.code(422).send({ error: 'Chat can only be enabled for paid or later orders' });
        }
        if (!order.chatEnabled) {
            await app.db
                .update(schema_js_1.orders)
                .set({ chatEnabled: true, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, id));
        }
        const botUsername = process.env.BOT_USERNAME;
        const chatLink = botUsername ? `https://t.me/${botUsername}?start=chat_${id}` : null;
        return { chatEnabled: true, chatLink };
    });
}
