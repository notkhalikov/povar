import type { TelegramUser } from '../types/index.js';
export interface ParsedInitData {
    user: TelegramUser;
    authDate: number;
    queryId?: string;
}
/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns parsed data on success, null on invalid signature.
 */
export declare function validateInitData(initData: string, botToken: string): ParsedInitData | null;
//# sourceMappingURL=telegram-auth.d.ts.map