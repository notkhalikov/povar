import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'

const token = process.env.BOT_TOKEN
if (!token) {
  console.error('BOT_TOKEN is not set')
  process.exit(1)
}

const MINI_APP_URL = process.env.MINI_APP_URL ?? 'https://example.com'

const bot = new Bot(token)

// ─── /start ───────────────────────────────────────────────────────────────────
// Supports deep links: /start order_123  /start request_456  /start dispute_789
// The start_param is forwarded to the mini app via ?startapp=<param> so the
// web app can navigate to the correct page on first load.

bot.command('start', async (ctx) => {
  const name = ctx.from?.first_name ?? 'друг'
  const param = (ctx.match as string | undefined)?.trim() ?? ''

  let appUrl = MINI_APP_URL
  let buttonLabel = '🍽️ Открыть Mini App'
  let replyText =
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

// ─── /help ────────────────────────────────────────────────────────────────────

bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Как пользоваться ботом:*\n\n` +
    `🍽️ /start — открыть Mini App с каталогом поваров\n` +
    `📋 /orders — мои заказы\n` +
    `❓ /help — эта справка\n\n` +
    `Все основные функции доступны через Mini App: ` +
    `поиск поваров, оформление заказа и оплата.`,
    { parse_mode: 'Markdown' },
  )
})

// ─── /orders ──────────────────────────────────────────────────────────────────

bot.command('orders', async (ctx) => {
  await ctx.reply('📋 Скоро тут будут ваши заказы.')
})

// ─── Telegram Payments ────────────────────────────────────────────────────────

// Validate the order payload is well-formed before Telegram charges the user.
bot.on('pre_checkout_query', async (ctx) => {
  const payload = ctx.preCheckoutQuery.invoice_payload
  const orderId = parseInt(payload.split(':')[1] ?? '', 10)

  if (!payload.startsWith('order:') || isNaN(orderId) || orderId <= 0) {
    await ctx.answerPreCheckoutQuery(false, 'Некорректный заказ. Попробуйте ещё раз.')
    return
  }

  await ctx.answerPreCheckoutQuery(true)
})

// Called after a successful payment. Notifies the API to mark order as paid.
bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment
  const payload = payment.invoice_payload  // "order:123"
  const orderId = parseInt(payload.split(':')[1] ?? '', 10)

  if (!orderId || isNaN(orderId)) {
    console.error('Invalid invoice_payload:', payload)
    return
  }

  try {
    const res = await fetch(`${process.env.API_BASE_URL}/payments/telegram-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({
        orderId,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        providerPaymentChargeId: payment.provider_payment_charge_id,
        totalAmount: payment.total_amount,
        currency: payment.currency,
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
console.log('Bot started')
