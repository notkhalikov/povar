import { Bot } from 'grammy'

const token = process.env.BOT_TOKEN
if (!token) throw new Error('BOT_TOKEN is not set')

const bot = new Bot(token)

bot.command('start', (ctx) =>
  ctx.reply('Добро пожаловать в Повар! 🍽️'),
)

bot.start()
