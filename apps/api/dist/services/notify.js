"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOrderCreated = notifyOrderCreated;
exports.notifyOrderPaid = notifyOrderPaid;
exports.notifyOrderCancelled = notifyOrderCancelled;
exports.notifyOrderCompleted = notifyOrderCompleted;
exports.notifyNewResponse = notifyNewResponse;
exports.notifyDisputeOpened = notifyDisputeOpened;
exports.notifyDisputeResolved = notifyDisputeResolved;
exports.sendReviewReminder = sendReviewReminder;
exports.notifyVerificationSubmitted = notifyVerificationSubmitted;
exports.notifyVerificationDecision = notifyVerificationDecision;
exports.scheduleAutoComplete = scheduleAutoComplete;
exports.statusNotifyText = statusNotifyText;
exports.notifyUser = notifyUser;
exports.scheduleReviewReminder = scheduleReviewReminder;
// ─── Deep-link keyboard builders ──────────────────────────────────────────────
function appUrl(startapp) {
    const base = process.env.MINI_APP_URL;
    return base ? `${base}?startapp=${startapp}` : undefined;
}
function orderKeyboard(orderId) {
    const url = appUrl(`order_${orderId}`);
    if (!url)
        return undefined;
    return {
        inline_keyboard: [[
                { text: '📋 Открыть заказ', web_app: { url } },
            ]],
    };
}
function newOrderKeyboard(orderId) {
    const url = appUrl(`order_${orderId}`);
    const botUsername = process.env.BOT_USERNAME;
    const chatUrl = botUsername ? `https://t.me/${botUsername}?start=chat_${orderId}` : null;
    if (!url)
        return undefined;
    const row = [{ text: '📋 Открыть заказ', web_app: { url } }];
    if (chatUrl)
        row.push({ text: '💬 Написать заказчику', url: chatUrl });
    return { inline_keyboard: [row] };
}
function reviewKeyboard(orderId) {
    const url = appUrl(`review_${orderId}`);
    if (!url)
        return undefined;
    return {
        inline_keyboard: [[
                { text: '✍️ Оставить отзыв', web_app: { url } },
            ]],
    };
}
function responseKeyboard(requestId, chefProfileId) {
    const requestUrl = appUrl(`request_${requestId}`);
    if (!requestUrl)
        return undefined;
    const buttons = [{ text: '👀 Смотреть все отклики', web_app: { url: requestUrl } }];
    const chefUrl = chefProfileId ? appUrl(`chef_${chefProfileId}`) : undefined;
    if (chefUrl)
        buttons.push({ text: '👨‍🍳 Профиль повара', web_app: { url: chefUrl } });
    return { inline_keyboard: [buttons] };
}
// ─── Low-level sender ─────────────────────────────────────────────────────────
async function sendMessage(telegramId, text, replyMarkup) {
    const token = process.env.BOT_TOKEN;
    if (!token)
        return;
    const body = {
        chat_id: telegramId,
        text,
        parse_mode: 'HTML',
    };
    if (replyMarkup)
        body.reply_markup = replyMarkup;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Telegram sendMessage failed: ${detail}`);
    }
}
// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtDate(date) {
    return date.toLocaleString('ru-RU', {
        day: 'numeric', month: 'long',
        timeZone: 'Asia/Tbilisi',
    });
}
function fmtTime(date) {
    return date.toLocaleString('ru-RU', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Tbilisi',
    });
}
function typeLabel(type) {
    return type === 'home_visit' ? 'повар на дом' : 'доставка';
}
function resolutionLabel(type) {
    if (type === 'full_refund')
        return 'полный возврат средств';
    if (type === 'partial_refund')
        return 'частичный возврат средств';
    if (type === 'no_refund')
        return 'отказ в возврате';
    return 'не указано';
}
// ─── Typed notification functions ─────────────────────────────────────────────
/**
 * Notify chef about a new order just created by a customer.
 */
async function notifyOrderCreated(order, chefTelegramId, customerName = 'клиент') {
    const location = [order.district, order.city].filter(Boolean).join(', ');
    const price = order.agreedPrice ? `${order.agreedPrice} GEL` : 'не указана';
    const text = `🆕 <b>Новый заказ!</b>\n` +
        `от ${customerName}\n` +
        `📅 ${fmtDate(order.scheduledAt)} в ${fmtTime(order.scheduledAt)}\n` +
        `👥 ${order.persons} чел. · ${typeLabel(order.type)}\n` +
        (location ? `📍 ${location}\n` : '') +
        `💰 ${price}` +
        (order.description ? `\n<i>${order.description}</i>` : '');
    await sendMessage(chefTelegramId, text, newOrderKeyboard(order.id));
}
/**
 * Notify chef that the order has been paid.
 */
async function notifyOrderPaid(order, chefTelegramId) {
    const price = order.agreedPrice ? `${order.agreedPrice}` : '—';
    const text = `✅ <b>Заказ оплачен</b>\n` +
        `Заказчик подтвердил оплату. Ждём тебя ${fmtDate(order.scheduledAt)} в ${fmtTime(order.scheduledAt)}!\n` +
        `💰 ${price} GEL зарезервированы на платформе.`;
    await sendMessage(chefTelegramId, text, orderKeyboard(order.id));
}
/**
 * Notify both parties that the order has been cancelled.
 */
async function notifyOrderCancelled(order, chefTelegramId, customerTelegramId) {
    const text = `❌ <b>Заказ отменён</b>\n` +
        `${fmtDate(order.scheduledAt)}, ${order.persons} чел.\n` +
        `Причина: отмена до оплаты.`;
    await Promise.allSettled([
        sendMessage(chefTelegramId, text),
        sendMessage(customerTelegramId, text),
    ]);
}
/**
 * Notify chef that the customer confirmed order completion.
 */
async function notifyOrderCompleted(order, chefTelegramId) {
    const price = order.agreedPrice ? `${order.agreedPrice}` : '—';
    const text = `🎉 <b>Заказ завершён!</b>\n` +
        `Заказчик подтвердил выполнение.\n` +
        `💰 ${price} GEL будут переведены в течение 24 часов.`;
    await sendMessage(chefTelegramId, text, orderKeyboard(order.id));
}
/**
 * Notify customer that a chef responded to their open request.
 */
async function notifyNewResponse(request, response, customerTelegramId, chefName) {
    var _a;
    const rating = response.chefRating ? Number(response.chefRating).toFixed(1) : '—';
    const orders = (_a = response.chefOrdersCount) !== null && _a !== void 0 ? _a : 0;
    const price = response.proposedPrice ? `${response.proposedPrice} GEL` : 'не указана';
    const text = `👨‍🍳 <b>Новый отклик от ${chefName}</b>\n` +
        `⭐ ${rating} · ${orders} заказов\n` +
        `💰 Предлагает: ${price}` +
        (response.comment ? `\n<i>${response.comment}</i>` : '');
    await sendMessage(customerTelegramId, text, responseKeyboard(request.id, response.chefProfileId));
}
/**
 * Notify the other party that a dispute has been opened.
 */
async function notifyDisputeOpened(dispute, order, recipientTelegramId) {
    const text = `⚠️ <b>Открыт спор по заказу</b>\n` +
        `Причина: ${dispute.reasonCode}\n` +
        (dispute.description ? `<i>${dispute.description}</i>\n` : '') +
        `Саппорт рассмотрит в течение 24 часов.`;
    await sendMessage(recipientTelegramId, text, orderKeyboard(order.id));
}
/**
 * Notify both parties about the dispute resolution.
 */
async function notifyDisputeResolved(dispute, order, customerTelegramId, chefTelegramId) {
    const text = `⚖️ <b>Спор решён</b>\n` +
        `Решение: ${resolutionLabel(dispute.resolutionType)}` +
        (dispute.resolutionComment ? `\n<i>${dispute.resolutionComment}</i>` : '');
    await Promise.allSettled([
        sendMessage(customerTelegramId, text, orderKeyboard(order.id)),
        sendMessage(chefTelegramId, text, orderKeyboard(order.id)),
    ]);
}
/**
 * Send review reminder to customer.
 * Called by the cron job in main.ts — timing is handled externally.
 */
async function sendReviewReminder(orderId, chefName, customerTelegramId) {
    const text = `⭐ <b>Как прошло?</b>\n` +
        `Оцени повара ${chefName} — это помогает другим выбрать хорошего кулинара.`;
    await sendMessage(customerTelegramId, text, reviewKeyboard(orderId));
}
// ─── Verification notifications ───────────────────────────────────────────────
/**
 * Notify admin that a chef has submitted verification documents.
 */
async function notifyVerificationSubmitted(chefName, chefProfileId, adminTelegramId) {
    const text = `📋 <b>Новая заявка на верификацию</b>\n` +
        `Повар: ${chefName}\n` +
        `Профиль #${chefProfileId}`;
    await sendMessage(adminTelegramId, text);
}
/**
 * Notify chef about the outcome of their verification request.
 */
async function notifyVerificationDecision(chefTelegramId, approved, comment) {
    const icon = approved ? '✅' : '❌';
    const result = approved ? 'одобрена' : 'отклонена';
    const text = `${icon} <b>Ваша заявка на верификацию ${result}.</b>` +
        (comment ? `\n\n${comment}` : '');
    await sendMessage(chefTelegramId, text);
}
// ─── Auto-complete (unchanged) ────────────────────────────────────────────────
/**
 * Auto-complete an order 24 h after payment if no dispute has been opened.
 */
function scheduleAutoComplete(order, customerTelegramId, chefTelegramId, hasDispute, completeOrder, delayMs = 24 * 60 * 60 * 1000) {
    setTimeout(async () => {
        try {
            if (await hasDispute())
                return;
            await completeOrder();
            const text = `✅ <b>Заказ #${order.id} автоматически завершён.</b>\n` +
                `Спор не был открыт в течение 24 часов после оплаты.`;
            await Promise.allSettled([
                sendMessage(customerTelegramId, text, orderKeyboard(order.id)),
                sendMessage(chefTelegramId, text, orderKeyboard(order.id)),
            ]);
        }
        catch (err) {
            console.error('auto-complete failed', err);
        }
    }, delayMs);
}
// ─── Backward-compatible helpers (used by PATCH /orders/:id/status) ───────────
const STATUS_TEXT = {
    in_progress: '👨‍🍳 Повар приступил к работе',
    completed: '✅ Заказ подтверждён клиентом',
    dispute_pending: '⚠️ По заказу открыт спор',
    cancelled: '❌ Заказ отменён',
};
function statusNotifyText(status, orderId) {
    var _a;
    const base = (_a = STATUS_TEXT[status]) !== null && _a !== void 0 ? _a : `Статус заказа изменён: ${status}`;
    return `${base} #${orderId}`;
}
/**
 * Generic notification with order deep-link button.
 */
async function notifyUser(telegramId, text, orderId) {
    await sendMessage(telegramId, text, orderKeyboard(orderId));
}
// ─── Kept for import compatibility — replaced by cron-based approach ──────────
/** @deprecated Use sendReviewReminder called from the cron job in main.ts */
function scheduleReviewReminder(_order, _customerTelegramId, _hasReview) {
    // No-op: review reminders are now sent by the 30-min cron job in main.ts
    // which uses reviewReminderSentAt to avoid duplicate sends.
}
