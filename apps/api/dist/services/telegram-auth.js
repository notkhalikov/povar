"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInitData = validateInitData;
const crypto_1 = require("crypto");
/**
 * Validates Telegram WebApp initData using HMAC-SHA256.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns parsed data on success, null on invalid signature.
 */
function validateInitData(initData, botToken) {
    var _a, _b;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash)
        return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    const secretKey = (0, crypto_1.createHmac)('sha256', 'WebAppData')
        .update(botToken)
        .digest();
    const expectedHash = (0, crypto_1.createHmac)('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
    if (expectedHash !== hash)
        return null;
    const userRaw = params.get('user');
    if (!userRaw)
        return null;
    let user;
    try {
        user = JSON.parse(userRaw);
    }
    catch {
        return null;
    }
    const authDate = Number((_a = params.get('auth_date')) !== null && _a !== void 0 ? _a : 0);
    return { user, authDate, queryId: (_b = params.get('query_id')) !== null && _b !== void 0 ? _b : undefined };
}
