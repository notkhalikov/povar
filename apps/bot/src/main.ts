import { Bot } from 'grammy'

const token = process.env.BOT_TOKEN
if (!token) throw new Error('BOT_TOKEN is not set')

const bot = new Bot(token)

function logNotifyError(type: string, userId: number | undefined, err: unknown) {
  console.error(JSON.stringify({
    event: 'notify_failed',
    type,
    userId,
    error: err instanceof Error ? err.message : String(err),
  }))
}

bot.command('start', async (ctx) => {
  try {
    await ctx.reply('Добро пожаловать в Повар! 🍽️')
  } catch (err) {
    logNotifyError('start_reply', ctx.from?.id, err)
  }
})

// Global error handler — logs but never crashes the process
bot.catch((err) => {
  logNotifyError('unhandled_update', err.ctx.from?.id, err.error)
})

bot.start()
