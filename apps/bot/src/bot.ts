import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'
import type { Context } from 'grammy'

const token = process.env.BOT_TOKEN
if (!token) {
  console.error('BOT_TOKEN is not set')
  process.exit(1)
}

const MINI_APP_URL   = process.env.MINI_APP_URL   ?? 'https://example.com'
const API_BASE_URL   = process.env.API_BASE_URL   ?? 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? ''
const SYSTEM_SECRET  = process.env.SYSTEM_SECRET  ?? ''

const bot = new Bot(token)

// ─── Chat relay — DB-backed sessions ─────────────────────────────────────────
// Persisted in chat_sessions table via API so restarts don't lose sessions.

interface ChatSession {
  orderId: number
  role: string
  recipientTelegramId: number
}

async function getSession(telegramId: number): Promise<ChatSession | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/chat-sessions/${telegramId}`, {
      headers: { 'x-system-secret': SYSTEM_SECRET },
    })
    if (!res.ok) return null
    const data = await res.json() as {
      orderId: number
      role: string
      recipientTelegramId: number
    }
    return data
  } catch {
    return null
  }
}

async function saveSession(data: {
  orderId: number
  initiatorTelegramId: number
  recipientTelegramId: number
  role: string
}): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/chat-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-system-secret': SYSTEM_SECRET,
      },
      body: JSON.stringify(data),
    })
  } catch (err) {
    console.error('[chat] saveSession failed:', err)
  }
}

async function deleteSession(telegramId: number): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/chat-sessions/${telegramId}`, {
      method: 'DELETE',
      headers: { 'x-system-secret': SYSTEM_SECRET },
    })
  } catch { /* silent */ }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'x-webhook-secret': WEBHOOK_SECRET },
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

type UserContext =
  | { found: false }
  | {
      found: true
      role: string
      isChef: boolean
      chefStatus: 'active' | 'vacation' | null
      activeOrdersCount: number
      activeOrder: { id: number; scheduledAt: string } | null
      incomingRequestsCount: number
    }

async function getUserContext(telegramId: number): Promise<UserContext> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/system/user-context?telegramId=${telegramId}`,
      { headers: { 'x-system-secret': SYSTEM_SECRET } },
    )
    if (!res.ok) return { found: false }
    return res.json() as Promise<UserContext>
  } catch {
    return { found: false }
  }
}

async function getChefsCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE_URL}/chefs?limit=1`)
    if (!res.ok) return 0
    const data = (await res.json()) as { total?: number }
    return data.total ?? 0
  } catch {
    return 0
  }
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
  console.log('[start] ctx.match:', JSON.stringify(ctx.match))
  console.log('[start] message text:', ctx.message?.text)
  console.log('[start] full update:', JSON.stringify(ctx.update).slice(0, 500))

  const name       = ctx.from?.first_name ?? 'друг'
  const telegramId = ctx.from?.id
  const param      = (ctx.match as string | undefined)?.trim() ?? ''

  // ── Deep-link passthrough: chat / order / request / dispute ─────────────

  if (param.startsWith('chat_')) {
    const orderId = parseInt(param.slice('chat_'.length), 10)
    if (!isNaN(orderId) && orderId > 0) {
      await handleChatStart(ctx, orderId)
      return
    }
  }

  if (param.startsWith('order_')) {
    const id = param.slice('order_'.length)
    const keyboard = new InlineKeyboard().webApp('📦 Открыть заказ', `${MINI_APP_URL}?startapp=order_${id}`)
    await ctx.reply(`${name}, вот ваш заказ #${id}:`, { reply_markup: keyboard })
    return
  }

  if (param.startsWith('request_')) {
    const id = param.slice('request_'.length)
    const keyboard = new InlineKeyboard().webApp('📋 Открыть запрос', `${MINI_APP_URL}?startapp=request_${id}`)
    await ctx.reply(`${name}, вот запрос #${id}:`, { reply_markup: keyboard })
    return
  }

  if (param.startsWith('dispute_')) {
    const id = param.slice('dispute_'.length)
    const keyboard = new InlineKeyboard().webApp('⚖️ Открыть спор', `${MINI_APP_URL}?startapp=dispute_${id}`)
    await ctx.reply(`${name}, вот детали спора #${id}:`, { reply_markup: keyboard })
    return
  }

  // ── Smart /start: personalised greeting based on user context ────────────

  if (!telegramId) {
    await ctx.reply(`Привет, ${name}! 👋`)
    return
  }

  const context = await getUserContext(telegramId)

  // ── New user ─────────────────────────────────────────────────────────────
  if (!context.found) {
    const chefsCount = await getChefsCount()
    const keyboard = new InlineKeyboard()
      .webApp('🍽️ Найти повара', MINI_APP_URL)
      .row()
      .webApp('👨‍🍳 Я повар — хочу заказы', `${MINI_APP_URL}/chef/onboarding`)
    await ctx.reply(
      `👋 Привет, ${name}!\n\n` +
      `Я помогу найти домашнего повара в Тбилиси или Батуми — или заказать готовую еду с доставкой.\n\n` +
      (chefsCount > 0 ? `🍽️ У нас ${chefsCount} проверенных поваров.` : ''),
      { reply_markup: keyboard },
    )
    return
  }

  // ── Chef: vacation ────────────────────────────────────────────────────────
  if (context.isChef && context.chefStatus === 'vacation') {
    const keyboard = new InlineKeyboard()
      .text('✅ Включить активность', 'activate_chef')
      .row()
      .webApp('📋 Мои заказы', `${MINI_APP_URL}?startapp=orders`)
    await ctx.reply(
      `Привет, ${name}! 👨‍🍳\n` +
      `Твой статус: 😴 В отпуске — новые заказы не приходят.`,
      { reply_markup: keyboard },
    )
    return
  }

  // ── Chef: active ──────────────────────────────────────────────────────────
  if (context.isChef) {
    const keyboard = new InlineKeyboard()
      .webApp('📋 Мои заказы', `${MINI_APP_URL}?startapp=orders`)
      .row()
      .webApp('📩 Входящие запросы', `${MINI_APP_URL}?startapp=requests`)
      .row()
      .webApp('⚙️ Профиль', `${MINI_APP_URL}?startapp=profile`)
    await ctx.reply(
      `Привет, ${name}! 👨‍🍳\n` +
      `Твой статус: 🟢 Активен\n` +
      `Входящих запросов: ${context.incomingRequestsCount}`,
      { reply_markup: keyboard },
    )
    return
  }

  // ── Customer: has active order ────────────────────────────────────────────
  if (context.activeOrder) {
    const date = new Date(context.activeOrder.scheduledAt).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long',
    })
    const keyboard = new InlineKeyboard()
      .webApp('📋 Открыть заказ', `${MINI_APP_URL}?startapp=order_${context.activeOrder.id}`)
      .row()
      .webApp('🍽️ Каталог поваров', MINI_APP_URL)
    await ctx.reply(
      `С возвращением, ${name}! 👋\n` +
      `У тебя есть активный заказ на ${date}.`,
      { reply_markup: keyboard },
    )
    return
  }

  // ── Customer: no active orders ────────────────────────────────────────────
  const keyboard = new InlineKeyboard()
    .webApp('🍽️ Найти повара', MINI_APP_URL)
    .row()
    .webApp('📩 Создать запрос', `${MINI_APP_URL}?startapp=new-request`)
  await ctx.reply(
    `С возвращением, ${name}! 👋\n` +
    `Снова хочется домашней еды? 😄`,
    { reply_markup: keyboard },
  )
})

// ─── activate_chef callback ───────────────────────────────────────────────────

bot.callbackQuery('activate_chef', async (ctx) => {
  const telegramId = ctx.from.id
  try {
    const res = await fetch(`${API_BASE_URL}/system/chef-active`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-system-secret': SYSTEM_SECRET,
      },
      body: JSON.stringify({ telegramId }),
    })
    if (!res.ok) throw new Error(`API responded ${res.status}`)
    await ctx.answerCallbackQuery('✅ Ты снова активен!')
    await ctx.editMessageText('Отлично! Теперь ты снова получаешь запросы.')
  } catch (err) {
    console.error('[activate_chef] failed:', err)
    await ctx.answerCallbackQuery('⚠️ Не удалось включить активность, попробуй позже.')
  }
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

  const isCustomer = Number(order.customerTelegramId) === telegramId
  const isChef     = Number(order.chefTelegramId)     === telegramId

  if (!isCustomer && !isChef) {
    await ctx.reply('❌ Вы не участник этого заказа.')
    return
  }

  const role          = isCustomer ? 'customer' : 'chef'
  const partnerTelegramId = isCustomer ? order.chefTelegramId!     : order.customerTelegramId!
  const partnerName       = isCustomer ? (order.chefName ?? 'Повар') : (order.customerName ?? 'Заказчик')

  await saveSession({
    orderId,
    initiatorTelegramId: telegramId,
    recipientTelegramId: Number(partnerTelegramId),
    role,
  })
  console.log('[chat] session saved to DB for telegramId:', telegramId, { orderId, role, partnerTelegramId })

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

  const session = await getSession(telegramId)
  if (session) {
    await deleteSession(telegramId)
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

  // Skip commands
  if (ctx.message.text.startsWith('/')) return next()

  const session = await getSession(telegramId)
  console.log('[relay] session from DB for telegramId', telegramId, ':', session)

  if (!session) return next()

  const senderLabel = session.role === 'customer' ? '👤 Заказчик' : '👨‍🍳 Повар'

  try {
    await bot.api.sendMessage(
      session.recipientTelegramId,
      `💬 <b>${senderLabel}:</b>\n${ctx.message.text}`,
      { parse_mode: 'HTML' },
    )
    await ctx.react('👍').catch(() => {})
  } catch (err) {
    console.error('[relay] sendMessage failed:', err)
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

// ─── /status (admin only) ─────────────────────────────────────────────────────

bot.command('status', async (ctx) => {
  if (String(ctx.from?.id) !== process.env.ADMIN_TELEGRAM_ID) return

  try {
    const res = await fetch(`${API_BASE_URL}/health/detailed`, {
      headers: { 'x-system-secret': SYSTEM_SECRET },
    })
    if (!res.ok) {
      await ctx.reply(`⚠️ API вернул ${res.status}`)
      return
    }
    const data = await res.json() as {
      status: string
      counts: { users: number; active_chefs: number; orders: number }
      uptime: number
    }
    const h = Math.floor(data.uptime / 3600)
    const m = Math.floor((data.uptime % 3600) / 60)
    await ctx.reply(
      `🟢 <b>Статус системы</b>\n\n` +
      `👥 Пользователей: ${data.counts.users}\n` +
      `👨‍🍳 Активных поваров: ${data.counts.active_chefs}\n` +
      `📋 Заказов всего: ${data.counts.orders}\n` +
      `⏱ Uptime: ${h}ч ${m}м`,
      { parse_mode: 'HTML' },
    )
  } catch (err) {
    await ctx.reply(`❌ Не удалось получить статус: ${String(err)}`)
  }
})

// ─── Error handler ────────────────────────────────────────────────────────────

bot.catch((err) => {
  console.error('Bot error:', err)
})

// ─── Start ────────────────────────────────────────────────────────────────────

bot.start()
