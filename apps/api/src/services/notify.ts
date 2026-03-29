import type { OrderStatus } from '../types/index.js'

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

export async function notifyUser(
  telegramId: number,
  text: string,
  orderId: number,
): Promise<void> {
  const miniAppUrl = process.env.MINI_APP_URL
  const token = process.env.BOT_TOKEN
  if (!token) return

  const body: Record<string, unknown> = {
    chat_id: telegramId,
    text,
    parse_mode: 'HTML',
  }

  if (miniAppUrl) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: 'Открыть заказ', url: `${miniAppUrl}/orders/${orderId}` },
      ]],
    }
  }

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
