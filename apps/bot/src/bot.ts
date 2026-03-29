import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'

const token = process.env.BOT_TOKEN
if (!token) {
  console.error('BOT_TOKEN is not set')
  process.exit(1)
}

const MINI_APP_URL = process.env.MINI_APP_URL ?? 'https://example.com'
console.log('Mini app URL:', MINI_APP_URL)

const bot = new Bot(token)

// ─── /start ───────────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const name = ctx.from?.first_name ?? 'друг'

  const keyboard = new InlineKeyboard().webApp('🍽️ Открыть Mini App', MINI_APP_URL)

  await ctx.reply(
    `Привет, ${name}! 👋\n\n` +
    `Я помогу тебе найти домашнего повара в Тбилиси или Батуми — ` +
    `или заказать готовую еду с доставкой.\n\n` +
    `Нажми кнопку ниже, чтобы открыть каталог поваров.`,
    { reply_markup: keyboard },
  )
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

// Validate the order is still payable before Telegram charges the user.
bot.on('pre_checkout_query', async (ctx) => {
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
