import { createHmac } from 'crypto'
import type { TelegramUser } from '../types/index.js'

export interface ParsedInitData {
  user: TelegramUser
  authDate: number
  queryId?: string
}

/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns parsed data on success, null on invalid signature.
 */
export function validateInitData(
  initData: string,
  botToken: string,
): ParsedInitData | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')

  if (!hash) return null

  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (expectedHash !== hash) return null

  const userRaw = params.get('user')
  if (!userRaw) return null

  let user: TelegramUser
  try {
    user = JSON.parse(userRaw) as TelegramUser
  } catch {
    return null
  }

  const authDate = Number(params.get('auth_date') ?? 0)

  return { user, authDate, queryId: params.get('query_id') ?? undefined }
}
