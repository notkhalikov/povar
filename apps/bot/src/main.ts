import { Bot } from 'grammy'
import http from 'http'

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

// Health check server for Railway rolling deploys
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200)
    res.end('ok')
  } else {
    res.writeHead(404)
    res.end()
  }
})

const PORT = process.env.PORT ?? 3001
server.listen(PORT, () => {
  console.log(`[bot] health check server on port ${PORT}`)
})

// Graceful shutdown — lets Railway terminate the old instance cleanly
process.on('SIGTERM', async () => {
  console.log('[bot] SIGTERM — stopping bot and server')
  server.close()
  await bot.stop()
  process.exit(0)
})

bot.start()
