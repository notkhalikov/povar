import { createHash, createHmac } from 'crypto'
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

export interface TelegramWidgetPayload {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export interface ValidatedWidgetData {
  user: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
  }
  authDate: number
}

/**
 * Validates Telegram Login Widget payload.
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * Unlike Mini App initData, the secret key here is plain SHA256(botToken),
 * not HMAC-SHA256 keyed with "WebAppData".
 */
export function validateWidgetData(
  data: TelegramWidgetPayload,
  botToken: string,
  maxAgeSeconds = 86400,
): ValidatedWidgetData | null {
  const { hash, ...fields } = data
  if (!hash) return null

  const dataCheckString = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (expectedHash !== hash) return null

  const nowSec = Math.floor(Date.now() / 1000)
  if (nowSec - data.auth_date > maxAgeSeconds) return null

  return {
    user: {
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      username: data.username,
      photo_url: data.photo_url,
    },
    authDate: data.auth_date,
  }
}
