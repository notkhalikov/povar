import type { OrderStatus } from '../types/index.js'

// ─── Minimal shapes needed by notify functions ────────────────────────────────

export interface NotifyOrder {
  id: number
  scheduledAt: Date
  persons: number
  agreedPrice: string | null
  type: string
  city: string
  district?: string | null
  description?: string | null
  customerId: number
  chefId: number
}

export interface NotifyDispute {
  id: number
  orderId: number
  openedBy: 'customer' | 'chef'
  reasonCode: string
  description?: string | null
  resolutionType: 'full_refund' | 'partial_refund' | 'no_refund' | null
  resolutionComment: string | null
}

export interface NotifyRequest {
  id: number
  city: string
  scheduledAt: Date
  persons: number
}

export interface NotifyResponse {
  id: number
  proposedPrice: string | null
  comment?: string | null
  chefRating?: string | null
  chefOrdersCount?: number
  chefProfileId?: number
}

// ─── Deep-link keyboard builders ──────────────────────────────────────────────

function appUrl(startapp: string): string | undefined {
  const base = process.env.MINI_APP_URL
  return base ? `${base}?startapp=${startapp}` : undefined
}

function orderKeyboard(orderId: number) {
  const url = appUrl(`order_${orderId}`)
  if (!url) return undefined
  return {
    inline_keyboard: [[
      { text: '📋 Открыть заказ', web_app: { url } },
    ]],
  }
}

function newOrderKeyboard(orderId: number) {
  const url = appUrl(`order_${orderId}`)
  const botUsername = process.env.BOT_USERNAME
  const chatUrl = botUsername ? `https://t.me/${botUsername}?start=chat_${orderId}` : null
  if (!url) return undefined
  const row: object[] = [{ text: '📋 Открыть заказ', web_app: { url } }]
  if (chatUrl) row.push({ text: '💬 Написать заказчику', url: chatUrl })
  return { inline_keyboard: [row] }
}

function reviewKeyboard(orderId: number) {
  const url = appUrl(`review_${orderId}`)
  if (!url) return undefined
  return {
    inline_keyboard: [[
      { text: '✍️ Оставить отзыв', web_app: { url } },
    ]],
  }
}

function responseKeyboard(requestId: number, chefProfileId?: number) {
  const requestUrl = appUrl(`request_${requestId}`)
  if (!requestUrl) return undefined
  const buttons: object[] = [{ text: '👀 Смотреть все отклики', web_app: { url: requestUrl } }]
  const chefUrl = chefProfileId ? appUrl(`chef_${chefProfileId}`) : undefined
  if (chefUrl) buttons.push({ text: '👨‍🍳 Профиль повара', web_app: { url: chefUrl } })
  return { inline_keyboard: [buttons] }
}

// ─── Low-level sender ─────────────────────────────────────────────────────────

async function sendMessage(
  telegramId: number,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  const token = process.env.BOT_TOKEN
  if (!token) return

  const body: Record<string, unknown> = {
    chat_id: telegramId,
    text,
    parse_mode: 'HTML',
  }
  if (replyMarkup) body.reply_markup = replyMarkup

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Telegram sendMessage failed: ${detail}`)
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(date: Date): string {
  return date.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long',
    timeZone: 'Asia/Tbilisi',
  })
}

function fmtTime(date: Date): string {
  return date.toLocaleString('ru-RU', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Tbilisi',
  })
}

function typeLabel(type: string): string {
  return type === 'home_visit' ? 'повар на дом' : 'доставка'
}

function resolutionLabel(type: string | null): string {
  if (type === 'full_refund')    return 'полный возврат средств'
  if (type === 'partial_refund') return 'частичный возврат средств'
  if (type === 'no_refund')      return 'отказ в возврате'
  return 'не указано'
}

// ─── Typed notification functions ─────────────────────────────────────────────

/**
 * Notify chef about a new order just created by a customer.
 */
export async function notifyOrderCreated(
  order: NotifyOrder,
  chefTelegramId: number,
  customerName = 'клиент',
): Promise<void> {
  const location = [order.district, order.city].filter(Boolean).join(', ')
  const price    = order.agreedPrice ? `${order.agreedPrice} GEL` : 'не указана'
  const text =
    `🆕 <b>Новый заказ!</b>\n` +
    `от ${customerName}\n` +
    `📅 ${fmtDate(order.scheduledAt)} в ${fmtTime(order.scheduledAt)}\n` +
    `👥 ${order.persons} чел. · ${typeLabel(order.type)}\n` +
    (location ? `📍 ${location}\n` : '') +
    `💰 ${price}` +
    (order.description ? `\n<i>${order.description}</i>` : '')
  await sendMessage(chefTelegramId, text, newOrderKeyboard(order.id))
}

/**
 * Notify chef that the order has been paid.
 */
export async function notifyOrderPaid(
  order: NotifyOrder,
  chefTelegramId: number,
): Promise<void> {
  const price = order.agreedPrice ? `${order.agreedPrice}` : '—'
  const text =
    `✅ <b>Заказ оплачен</b>\n` +
    `Заказчик подтвердил оплату. Ждём тебя ${fmtDate(order.scheduledAt)} в ${fmtTime(order.scheduledAt)}!\n` +
    `💰 ${price} GEL зарезервированы на платформе.`
  await sendMessage(chefTelegramId, text, orderKeyboard(order.id))
}

/**
 * Notify both parties that the order has been cancelled.
 */
export async function notifyOrderCancelled(
  order: NotifyOrder,
  chefTelegramId: number,
  customerTelegramId: number,
): Promise<void> {
  const text =
    `❌ <b>Заказ отменён</b>\n` +
    `${fmtDate(order.scheduledAt)}, ${order.persons} чел.\n` +
    `Причина: отмена до оплаты.`
  await Promise.allSettled([
    sendMessage(chefTelegramId, text),
    sendMessage(customerTelegramId, text),
  ])
}

/**
 * Notify chef that the customer confirmed order completion.
 */
export async function notifyOrderCompleted(
  order: NotifyOrder,
  chefTelegramId: number,
): Promise<void> {
  const price = order.agreedPrice ? `${order.agreedPrice}` : '—'
  const text =
    `🎉 <b>Заказ завершён!</b>\n` +
    `Заказчик подтвердил выполнение.\n` +
    `💰 ${price} GEL будут переведены в течение 24 часов.`
  await sendMessage(chefTelegramId, text, orderKeyboard(order.id))
}

/**
 * Notify customer that a chef responded to their open request.
 */
export async function notifyNewResponse(
  request: NotifyRequest,
  response: NotifyResponse,
  customerTelegramId: number,
  chefName: string,
): Promise<void> {
  const rating     = response.chefRating ? Number(response.chefRating).toFixed(1) : '—'
  const orders     = response.chefOrdersCount ?? 0
  const price      = response.proposedPrice ? `${response.proposedPrice} GEL` : 'не указана'
  const text =
    `👨‍🍳 <b>Новый отклик от ${chefName}</b>\n` +
    `⭐ ${rating} · ${orders} заказов\n` +
    `💰 Предлагает: ${price}` +
    (response.comment ? `\n<i>${response.comment}</i>` : '')
  await sendMessage(customerTelegramId, text, responseKeyboard(request.id, response.chefProfileId))
}

/**
 * Notify the other party that a dispute has been opened.
 */
export async function notifyDisputeOpened(
  dispute: NotifyDispute,
  order: NotifyOrder,
  recipientTelegramId: number,
): Promise<void> {
  const text =
    `⚠️ <b>Открыт спор по заказу</b>\n` +
    `Причина: ${dispute.reasonCode}\n` +
    (dispute.description ? `<i>${dispute.description}</i>\n` : '') +
    `Саппорт рассмотрит в течение 24 часов.`
  await sendMessage(recipientTelegramId, text, orderKeyboard(order.id))
}

/**
 * Notify both parties about the dispute resolution.
 */
export async function notifyDisputeResolved(
  dispute: NotifyDispute,
  order: NotifyOrder,
  customerTelegramId: number,
  chefTelegramId: number,
): Promise<void> {
  const text =
    `⚖️ <b>Спор решён</b>\n` +
    `Решение: ${resolutionLabel(dispute.resolutionType)}` +
    (dispute.resolutionComment ? `\n<i>${dispute.resolutionComment}</i>` : '')
  await Promise.allSettled([
    sendMessage(customerTelegramId, text, orderKeyboard(order.id)),
    sendMessage(chefTelegramId,    text, orderKeyboard(order.id)),
  ])
}

/**
 * Send review reminder to customer.
 * Called by the cron job in main.ts — timing is handled externally.
 */
export async function sendReviewReminder(
  orderId: number,
  chefName: string,
  customerTelegramId: number,
): Promise<void> {
  const text =
    `⭐ <b>Как прошло?</b>\n` +
    `Оцени повара ${chefName} — это помогает другим выбрать хорошего кулинара.`
  await sendMessage(customerTelegramId, text, reviewKeyboard(orderId))
}

// ─── Verification notifications ───────────────────────────────────────────────

/**
 * Notify admin that a chef has submitted verification documents.
 */
export async function notifyVerificationSubmitted(
  chefName: string,
  chefProfileId: number,
  adminTelegramId: number,
): Promise<void> {
  const text =
    `📋 <b>Новая заявка на верификацию</b>\n` +
    `Повар: ${chefName}\n` +
    `Профиль #${chefProfileId}`
  await sendMessage(adminTelegramId, text)
}

/**
 * Notify chef about the outcome of their verification request.
 */
export async function notifyVerificationDecision(
  chefTelegramId: number,
  approved: boolean,
  comment?: string,
): Promise<void> {
  const icon   = approved ? '✅' : '❌'
  const result = approved ? 'одобрена' : 'отклонена'
  const text =
    `${icon} <b>Ваша заявка на верификацию ${result}.</b>` +
    (comment ? `\n\n${comment}` : '')
  await sendMessage(chefTelegramId, text)
}

// ─── Auto-complete (unchanged) ────────────────────────────────────────────────

/**
 * Auto-complete an order 24 h after payment if no dispute has been opened.
 */
export function scheduleAutoComplete(
  order: NotifyOrder,
  customerTelegramId: number,
  chefTelegramId: number,
  hasDispute: () => Promise<boolean>,
  completeOrder: () => Promise<void>,
  delayMs = 24 * 60 * 60 * 1000,
): void {
  setTimeout(async () => {
    try {
      if (await hasDispute()) return
      await completeOrder()
      const text =
        `✅ <b>Заказ #${order.id} автоматически завершён.</b>\n` +
        `Спор не был открыт в течение 24 часов после оплаты.`
      await Promise.allSettled([
        sendMessage(customerTelegramId, text, orderKeyboard(order.id)),
        sendMessage(chefTelegramId, text, orderKeyboard(order.id)),
      ])
    } catch (err) {
      console.error('auto-complete failed', err)
    }
  }, delayMs)
}

// ─── Backward-compatible helpers (used by PATCH /orders/:id/status) ───────────

const STATUS_TEXT: Partial<Record<OrderStatus, string>> = {
  in_progress:     '👨‍🍳 Повар приступил к работе',
  completed:       '✅ Заказ подтверждён клиентом',
  dispute_pending: '⚠️ По заказу открыт спор',
  cancelled:       '❌ Заказ отменён',
}

export function statusNotifyText(status: OrderStatus, orderId: number): string {
  const base = STATUS_TEXT[status] ?? `Статус заказа изменён: ${status}`
  return `${base} #${orderId}`
}

/**
 * Generic notification with order deep-link button.
 */
export async function notifyUser(
  telegramId: number,
  text: string,
  orderId: number,
): Promise<void> {
  await sendMessage(telegramId, text, orderKeyboard(orderId))
}

// ─── Kept for import compatibility — replaced by cron-based approach ──────────

/** @deprecated Use sendReviewReminder called from the cron job in main.ts */
export function scheduleReviewReminder(
  _order: NotifyOrder,
  _customerTelegramId: number,
  _hasReview: () => Promise<boolean>,
): void {
  // No-op: review reminders are now sent by the 30-min cron job in main.ts
  // which uses reviewReminderSentAt to avoid duplicate sends.
}
