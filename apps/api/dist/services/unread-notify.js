"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startUnreadNotifier = startUnreadNotifier;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const TICK_INTERVAL_MS = 60000;
const BATCH_SIZE = 50;
const STALE_INTERVAL_SQL = (0, drizzle_orm_1.sql) `now() - interval '2 minutes'`;
function startUnreadNotifier(app) {
    setInterval(() => {
        run(app).catch(err => {
            app.log.warn({ err, event: 'unread_notifier_tick_error' });
        });
    }, TICK_INTERVAL_MS);
    app.log.info('[unread-notify] started, tick every 60s');
}
async function run(app) {
    var _a;
    const botToken = process.env.BOT_TOKEN;
    if (!botToken)
        return;
    const frontendUrl = (_a = process.env.FRONTEND_URL) !== null && _a !== void 0 ? _a : '';
    const candidates = await app.db
        .select({
        id: schema_js_1.messages.id,
        orderId: schema_js_1.messages.orderId,
        requestId: schema_js_1.messages.requestId,
        chefId: schema_js_1.messages.chefId,
        senderId: schema_js_1.messages.senderId,
        body: schema_js_1.messages.body,
    })
        .from(schema_js_1.messages)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.lt)(schema_js_1.messages.createdAt, STALE_INTERVAL_SQL), (0, drizzle_orm_1.isNull)(schema_js_1.messages.readAt), (0, drizzle_orm_1.isNull)(schema_js_1.messages.notifiedAt)))
        .limit(BATCH_SIZE);
    if (candidates.length === 0)
        return;
    let sent = 0;
    for (const m of candidates) {
        try {
            const ok = await notifyOne(app, m, botToken, frontendUrl);
            if (ok)
                sent += 1;
        }
        catch (err) {
            app.log.warn({ err, messageId: m.id }, '[unread-notify] per-message error');
        }
    }
    app.log.info({ event: 'unread_notifier_batch', scanned: candidates.length, sent });
}
async function notifyOne(app, m, botToken, frontendUrl) {
    let recipientUserId = null;
    let entityLabel = '';
    let entityPath = '';
    if (m.orderId !== null) {
        const [o] = await app.db
            .select({ customerId: schema_js_1.orders.customerId, chefId: schema_js_1.orders.chefId })
            .from(schema_js_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, m.orderId))
            .limit(1);
        if (!o)
            return false;
        recipientUserId = m.senderId === o.customerId ? o.chefId : o.customerId;
        entityLabel = `по заказу #${m.orderId}`;
        entityPath = `/orders/${m.orderId}?chat=1`;
    }
    else if (m.requestId !== null && m.chefId !== null) {
        const [r] = await app.db
            .select({ customerId: schema_js_1.requests.customerId })
            .from(schema_js_1.requests)
            .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, m.requestId))
            .limit(1);
        if (!r)
            return false;
        // Pair is customer ↔ m.chefId. Recipient is the one who's not the sender.
        recipientUserId = m.senderId === r.customerId ? m.chefId : r.customerId;
        entityLabel = `по заявке #${m.requestId}`;
        entityPath = `/requests/${m.requestId}?chat=1`;
    }
    else {
        return false;
    }
    const [recipient] = await app.db
        .select({ telegramId: schema_js_1.users.telegramId })
        .from(schema_js_1.users)
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, recipientUserId))
        .limit(1);
    if (!(recipient === null || recipient === void 0 ? void 0 : recipient.telegramId))
        return false;
    const text = `💬 У вас непрочитанное сообщение ${entityLabel}\n\n"${m.body.slice(0, 100)}"`;
    const url = `${frontendUrl}${entityPath}`;
    let res;
    try {
        res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: recipient.telegramId,
                text,
                reply_markup: {
                    inline_keyboard: [[{ text: '💬 Открыть чат', web_app: { url } }]],
                },
            }),
        });
    }
    catch (err) {
        app.log.warn({
            err: err instanceof Error ? err.message : String(err),
            messageId: m.id,
            recipientTelegramId: recipient.telegramId,
            orderId: m.orderId,
            requestId: m.requestId,
        }, '[unread-notify] telegram send failed');
        return false;
    }
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        app.log.warn({
            err: detail,
            status: res.status,
            messageId: m.id,
            recipientTelegramId: recipient.telegramId,
            orderId: m.orderId,
            requestId: m.requestId,
        }, '[unread-notify] telegram failed, marking notified to avoid retry');
        // 4xx/5xx are permanent from our side (bot blocked, chat not found, etc.) —
        // mark notified so the cron stops retrying every minute.
        await app.db
            .update(schema_js_1.messages)
            .set({ notifiedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_js_1.messages.id, m.id));
        return false;
    }
    await app.db
        .update(schema_js_1.messages)
        .set({ notifiedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.messages.id, m.id));
    return true;
}
