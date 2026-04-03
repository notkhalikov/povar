import type { OrderStatus } from '../types/index.js'

// ─── Minimal shapes needed by notify functions ────────────────────────────────
// Using plain interfaces instead of importing DB types to keep this service
// decoupled from Drizzle schema details.

export interface NotifyOrder {
  id: number
  scheduledAt: Date
  persons: number
  agreedPrice: string | null
  type: string
  city: string
  customerId: number
  chefId: number
}

export interface NotifyDispute {
  id: number
  orderId: number
  openedBy: 'customer' | 'chef'
  reasonCode: string
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
}

// ─── Deep-link keyboard builders ──────────────────────────────────────────────

function orderKeyboard(orderId: number) {
  const url = process.env.MINI_APP_URL
  if (!url) return undefined
  return {
    inline_keyboard: [[
      { text: '📦 Открыть заказ', web_app: { url: `${url}?startapp=order_${orderId}` } },
    ]],
  }
}

function requestKeyboard(requestId: number) {
  const url = process.env.MINI_APP_URL
  if (!url) return undefined
  return {
    inline_keyboard: [[
      { text: '📋 Открыть запрос', web_app: { url: `${url}?startapp=request_${requestId}` } },
    ]],
  }
}

function disputeKeyboard(disputeId: number) {
  const url = process.env.MINI_APP_URL
  if (!url) return undefined
  return {
    inline_keyboard: [[
      { text: '⚖️ Открыть спор', web_app: { url: `${url}?startapp=dispute_${disputeId}` } },
    ]],
  }
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

// ─── Date formatter ───────────────────────────────────────────────────────────

function fmtDate(date: Date): string {
  return date.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Tbilisi',
  })
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
  const date = fmtDate(order.scheduledAt)
  const price = order.agreedPrice ? `${order.agreedPrice} GEL` : 'не указана'
  const text =
    `🍽 <b>Новый заказ #${order.id}</b> от ${customerName}\n` +
    `📅 ${date} · 👥 ${order.persons} чел.\n` +
    `💰 Сумма: ${price}`
  await sendMessage(chefTelegramId, text, orderKeyboard(order.id))
}

/**
 * Notify chef that the order has been paid.
 */
export async function notifyOrderPaid(
  order: NotifyOrder,
  chefTelegramId: number,
): Promise<void> {
  const date = fmtDate(order.scheduledAt)
  const text =
    `💳 <b>Заказ #${order.id} оплачен!</b>\n` +
    `Ждём тебя ${date} · 👥 ${order.persons} чел.`
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
  const text = `❌ <b>Заказ #${order.id} отменён.</b>`
  await Promise.allSettled([
    sendMessage(chefTelegramId, text, orderKeyboard(order.id)),
    sendMessage(customerTelegramId, text, orderKeyboard(order.id)),
  ])
}

/**
 * Notify chef that the customer confirmed order completion.
 */
export async function notifyOrderCompleted(
  order: NotifyOrder,
  chefTelegramId: number,
): Promise<void> {
  const text =
    `✅ <b>Заказ #${order.id} завершён!</b>\n` +
    `Клиент подтвердил выполнение. Средства будут переведены в течение 1–3 рабочих дней.`
  await sendMessage(chefTelegramId, text, orderKeyboard(order.id))
}

/**
 * Notify the other party that a dispute has been opened.
 */
export async function notifyDisputeOpened(
  dispute: NotifyDispute,
  order: NotifyOrder,
  recipientTelegramId: number,
): Promise<void> {
  const side = dispute.openedBy === 'customer' ? 'заказчик' : 'повар'
  const text =
    `⚠️ <b>По заказу #${order.id} открыт спор.</b>\n` +
    `Инициатор: ${side}.\n` +
    `Спор рассматривается службой поддержки в течение 24–48 часов.`
  await sendMessage(recipientTelegramId, text, disputeKeyboard(dispute.id))
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
  const resolutionText =
    dispute.resolutionType === 'full_refund'    ? 'полный возврат средств' :
    dispute.resolutionType === 'partial_refund' ? 'частичный возврат средств' :
                                                  'отказ в возврате'
  const text =
    `⚖️ <b>Спор по заказу #${order.id} рассмотрен.</b>\n` +
    `Решение: ${resolutionText}.` +
    (dispute.resolutionComment ? `\n\n${dispute.resolutionComment}` : '')
  await Promise.allSettled([
    sendMessage(customerTelegramId, text, disputeKeyboard(dispute.id)),
    sendMessage(chefTelegramId,    text, disputeKeyboard(dispute.id)),
  ])
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
  const price = response.proposedPrice ? ` · ${response.proposedPrice} GEL` : ''
  const text =
    `📬 <b>Новый отклик от повара ${chefName}</b>\n` +
    `По запросу #${request.id}${price}`
  await sendMessage(customerTelegramId, text, requestKeyboard(request.id))
}

/**
 * Auto-complete an order 24 h after payment if no dispute has been opened.
 * Calls `completeOrder()` which should update the DB status and ordersCount.
 * Fires only if `hasDispute()` returns false at the time of the check.
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

/**
 * Remind the customer to leave a review 2 hours after order completion.
 * Fires only if `hasReview()` returns false at the time of the reminder.
 */
export function scheduleReviewReminder(
  order: NotifyOrder,
  customerTelegramId: number,
  hasReview: () => Promise<boolean>,
): void {
  setTimeout(async () => {
    try {
      if (await hasReview()) return
      const text =
        `⭐ <b>Как прошёл заказ #${order.id}?</b>\n` +
        `Оставьте отзыв — это поможет другим заказчикам выбрать повара.`
      await sendMessage(customerTelegramId, text, orderKeyboard(order.id))
    } catch (err) {
      console.error('review reminder failed', err)
    }
  }, 2 * 60 * 60 * 1000)
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
  const icon = approved ? '✅' : '❌'
  const result = approved ? 'одобрена' : 'отклонена'
  const text =
    `${icon} <b>Ваша заявка на верификацию ${result}.</b>` +
    (comment ? `\n\n${comment}` : '')
  await sendMessage(chefTelegramId, text)
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
 * Kept for PATCH /orders/:id/status which handles many transitions generically.
 */
export async function notifyUser(
  telegramId: number,
  text: string,
  orderId: number,
): Promise<void> {
  await sendMessage(telegramId, text, orderKeyboard(orderId))
}
