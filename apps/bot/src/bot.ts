import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'
import type { Context } from 'grammy'

const token = process.env.BOT_TOKEN
if (!token) {
  console.error('BOT_TOKEN is not set')
  process.exit(1)
}

const MINI_APP_URL  = process.env.MINI_APP_URL  ?? 'https://example.com'
const API_BASE_URL  = process.env.API_BASE_URL  ?? 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? ''

const bot = new Bot(token)

// ─── Chat relay — in-memory sessions ─────────────────────────────────────────
// Map<telegramId, { orderId, role }>
// Persisted only in RAM; cleared on bot restart (MVP).

interface ChatSession {
  orderId: number
  role: 'customer' | 'chef'
  partnerTelegramId: number
  partnerName: string
}

const activeSessions = new Map<number, ChatSession>()

// ─── API helper ───────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'x-webhook-secret': WEBHOOK_SECRET },
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

interface OrderDetail {
  id: number
  customerId: number
  chefId: number
  status: string
  chatEnabled: boolean
  customerTelegramId?: number
  chefTelegramId?: number
  customerName?: string
  chefName?: string
}

// Fetches order + both participants' telegram IDs via the internal API.
// We use a dedicated internal endpoint protected by webhook-secret.
async function getOrderWithParticipants(orderId: number): Promise<OrderDetail | null> {
  try {
    return await apiGet<OrderDetail>(`/orders/${orderId}/chat-info`)
  } catch {
    return null
  }
}

// ─── /start ───────────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const name  = ctx.from?.first_name ?? 'друг'
  const param = (ctx.match as string | undefined)?.trim() ?? ''

  // chat_{orderId} deep link — activate chat session
  if (param.startsWith('chat_')) {
    const orderId = parseInt(param.slice('chat_'.length), 10)
    if (!isNaN(orderId) && orderId > 0) {
      await handleChatStart(ctx, orderId)
      return
    }
  }

  let appUrl      = MINI_APP_URL
  let buttonLabel = '🍽️ Открыть Mini App'
  let replyText   =
    `Привет, ${name}! 👋\n\n` +
    `Я помогу тебе найти домашнего повара в Тбилиси или Батуми — ` +
    `или заказать готовую еду с доставкой.\n\n` +
    `Нажми кнопку ниже, чтобы открыть каталог поваров.`

  if (param.startsWith('order_')) {
    const id = param.slice('order_'.length)
    appUrl = `${MINI_APP_URL}?startapp=order_${id}`
    buttonLabel = '📦 Открыть заказ'
    replyText = `${name}, вот ваш заказ #${id}:`
  } else if (param.startsWith('request_')) {
    const id = param.slice('request_'.length)
    appUrl = `${MINI_APP_URL}?startapp=request_${id}`
    buttonLabel = '📋 Открыть запрос'
    replyText = `${name}, вот запрос #${id}:`
  } else if (param.startsWith('dispute_')) {
    const id = param.slice('dispute_'.length)
    appUrl = `${MINI_APP_URL}?startapp=dispute_${id}`
    buttonLabel = '⚖️ Открыть спор'
    replyText = `${name}, вот детали спора #${id}:`
  }

  const keyboard = new InlineKeyboard().webApp(buttonLabel, appUrl)
  await ctx.reply(replyText, { reply_markup: keyboard })
})

// ─── /chat_{orderId} command ──────────────────────────────────────────────────

bot.hears(/^\/chat_(\d+)$/, async (ctx) => {
  const orderId = parseInt(ctx.match[1] ?? '', 10)
  if (isNaN(orderId) || orderId <= 0) {
    await ctx.reply('❌ Некорректный номер заказа.')
    return
  }
  await handleChatStart(ctx, orderId)
})

async function handleChatStart(ctx: Context, orderId: number) {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  const order = await getOrderWithParticipants(orderId)
  if (!order) {
    await ctx.reply('❌ Заказ не найден.')
    return
  }

  if (!order.chatEnabled) {
    await ctx.reply('⏳ Чат станет доступен после оплаты заказа.')
    return
  }

  const isCustomer = order.customerTelegramId === telegramId
  const isChef     = order.chefTelegramId     === telegramId

  if (!isCustomer && !isChef) {
    await ctx.reply('❌ Вы не участник этого заказа.')
    return
  }

  const role: 'customer' | 'chef'   = isCustomer ? 'customer' : 'chef'
  const partnerTelegramId            = isCustomer ? order.chefTelegramId!     : order.customerTelegramId!
  const partnerName                  = isCustomer ? (order.chefName ?? 'Повар') : (order.customerName ?? 'Заказчик')

  activeSessions.set(telegramId, { orderId, role, partnerTelegramId, partnerName })

  await ctx.reply(
    `💬 <b>Чат по заказу #${orderId} активен.</b>\n` +
    `Ваш собеседник: ${partnerName}\n\n` +
    `Пишите сообщение — оно будет передано ${role === 'customer' ? 'повару' : 'заказчику'}.\n` +
    `Чтобы завершить чат, напишите /stopchat`,
    { parse_mode: 'HTML' },
  )
}

// ─── /stopchat ────────────────────────────────────────────────────────────────

bot.command('stopchat', async (ctx) => {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  if (activeSessions.has(telegramId)) {
    activeSessions.delete(telegramId)
    await ctx.reply('✅ Чат завершён.')
  } else {
    await ctx.reply('У вас нет активного чата.')
  }
})

// ─── /help ────────────────────────────────────────────────────────────────────

bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Как пользоваться ботом:*\n\n` +
    `🍽️ /start — открыть Mini App с каталогом поваров\n` +
    `💬 /chat_123 — начать чат по заказу #123\n` +
    `🛑 /stopchat — завершить активный чат\n` +
    `❓ /help — эта справка\n\n` +
    `Все основные функции доступны через Mini App.`,
    { parse_mode: 'Markdown' },
  )
})

// ─── /orders ──────────────────────────────────────────────────────────────────

bot.command('orders', async (ctx) => {
  await ctx.reply('📋 Скоро тут будут ваши заказы.')
})

// ─── Message relay ────────────────────────────────────────────────────────────
// Intercepts plain text messages when user has an active chat session.
// Must be registered BEFORE the catch-all / payment handlers.

bot.on('message:text', async (ctx, next) => {
  const telegramId = ctx.from?.id
  if (!telegramId) return next()

  // Skip if message is a command
  if (ctx.message.text.startsWith('/')) return next()

  const session = activeSessions.get(telegramId)
  if (!session) return next()

  const senderLabel = session.role === 'customer' ? '👤 Заказчик' : '👨‍🍳 Повар'

  try {
    await bot.api.sendMessage(
      session.partnerTelegramId,
      `💬 <b>${senderLabel}:</b>\n${ctx.message.text}`,
      { parse_mode: 'HTML' },
    )
    // Confirm delivery to sender
    await ctx.react('👍').catch(() => {})
  } catch {
    await ctx.reply('⚠️ Не удалось доставить сообщение. Попробуйте ещё раз.')
  }
})

// ─── Telegram Payments ────────────────────────────────────────────────────────

bot.on('pre_checkout_query', async (ctx) => {
  const payload = ctx.preCheckoutQuery.invoice_payload
  const orderId = parseInt(payload.split(':')[1] ?? '', 10)

  if (!payload.startsWith('order:') || isNaN(orderId) || orderId <= 0) {
    await ctx.answerPreCheckoutQuery(false, 'Некорректный заказ. Попробуйте ещё раз.')
    return
  }

  await ctx.answerPreCheckoutQuery(true)
})

bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment
  const payload = payment.invoice_payload
  const orderId = parseInt(payload.split(':')[1] ?? '', 10)

  if (!orderId || isNaN(orderId)) {
    console.error('Invalid invoice_payload:', payload)
    return
  }

  try {
    const res = await fetch(`${API_BASE_URL}/payments/telegram-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        orderId,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        providerPaymentChargeId: payment.provider_payment_charge_id,
        totalAmount:  payment.total_amount,
        currency:     payment.currency,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`Payment webhook failed (${res.status}):`, body)
    }
  } catch (err) {
    console.error('Payment webhook error:', err)
  }
})

// ─── Error handler ────────────────────────────────────────────────────────────

bot.catch((err) => {
  console.error('Bot error:', err)
})

// ─── Start ────────────────────────────────────────────────────────────────────

bot.start()
