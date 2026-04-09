"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const Sentry = __importStar(require("@sentry/node"));
const drizzle_orm_1 = require("drizzle-orm");
const cors_js_1 = __importDefault(require("./plugins/cors.js"));
const db_js_1 = __importDefault(require("./plugins/db.js"));
const auth_js_1 = __importDefault(require("./plugins/auth.js"));
const auth_js_2 = __importDefault(require("./routes/auth.js"));
const chefs_js_1 = __importDefault(require("./routes/chefs.js"));
const orders_js_1 = __importDefault(require("./routes/orders.js"));
const payments_js_1 = __importDefault(require("./routes/payments.js"));
const reviews_js_1 = __importDefault(require("./routes/reviews.js"));
const disputes_js_1 = __importDefault(require("./routes/disputes.js"));
const requests_js_1 = __importDefault(require("./routes/requests.js"));
const admin_js_1 = __importDefault(require("./routes/admin.js"));
const dev_js_1 = __importDefault(require("./routes/dev.js"));
const schema_js_1 = require("./db/schema.js");
const notify_js_1 = require("./services/notify.js");
// Fail fast if required env vars are missing
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'BOT_TOKEN'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`Missing required env variable: ${key}`);
        process.exit(1);
    }
}
// ─── Sentry ───────────────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
}
// ─── App version ─────────────────────────────────────────────────────────────
const APP_VERSION = (_a = process.env.npm_package_version) !== null && _a !== void 0 ? _a : '0.0.1';
// ─── In-memory request counter (rolling 1-hour window) ───────────────────────
const REQUEST_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const requestTimestamps = [];
function recordRequest() {
    const now = Date.now();
    requestTimestamps.push(now);
    // Evict entries older than 1 hour to keep the array bounded
    const cutoff = now - REQUEST_WINDOW_MS;
    while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
        requestTimestamps.shift();
    }
}
const app = (0, fastify_1.default)({ logger: true });
// ─── Global error handler ─────────────────────────────────────────────────────
app.setErrorHandler((err, _request, reply) => {
    var _a, _b;
    app.log.error(err);
    const status = (_a = err.statusCode) !== null && _a !== void 0 ? _a : 500;
    const code = (_b = err.code) !== null && _b !== void 0 ? _b : 'INTERNAL_ERROR';
    // Fastify validation errors
    if (err.validation) {
        return reply.code(400).send({ error: err.message, code: 'VALIDATION_ERROR' });
    }
    // Rate limit errors come with statusCode 429
    if (status === 429) {
        return reply.code(429).send({ error: 'Too many requests, please slow down', code: 'RATE_LIMITED' });
    }
    const message = status < 500 ? err.message : 'Internal server error';
    return reply.code(status).send({ error: message, code });
});
// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
    var _a;
    // Plugins
    await app.register(rate_limit_1.default, { max: 60, timeWindow: '1 minute' });
    await app.register(cors_js_1.default);
    await app.register(db_js_1.default);
    await app.register(auth_js_1.default);
    // Routes
    await app.register(auth_js_2.default);
    await app.register(chefs_js_1.default);
    await app.register(orders_js_1.default);
    await app.register(payments_js_1.default);
    await app.register(reviews_js_1.default);
    await app.register(disputes_js_1.default);
    await app.register(requests_js_1.default);
    await app.register(admin_js_1.default);
    await app.register(dev_js_1.default);
    app.get('/health', async () => ({ status: 'ok' }));
    // ─── Metrics (Railway health check / ops dashboard) ─────────────────────────
    app.get('/metrics', { config: { rateLimit: false } }, async () => ({
        uptime: process.uptime(),
        requestsLastHour: requestTimestamps.length,
        version: APP_VERSION,
    }));
    // ─── Client error sink ───────────────────────────────────────────────────────
    app.post('/client-error', {
        schema: {
            body: {
                type: 'object',
                required: ['message'],
                additionalProperties: true,
                properties: {
                    message: { type: 'string', maxLength: 2000 },
                    stack: { type: 'string', maxLength: 5000 },
                    url: { type: 'string', maxLength: 500 },
                },
            },
        },
    }, async (request) => {
        app.log.error({ event: 'client_error', ...request.body });
        if (process.env.SENTRY_DSN) {
            Sentry.captureException(new Error(request.body.message));
        }
        return { ok: true };
    });
    // Count every request for /metrics
    app.addHook('onRequest', async () => { recordRequest(); });
    // Start
    try {
        await app.listen({
            port: Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000),
            host: '0.0.0.0'
        });
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
bootstrap();
// ─── Review reminder cron (every 30 min) ──────────────────────────────────────
// Finds completed orders with no review and no reminder sent yet, where
// completion was > 2 hours ago, and sends a review nudge to the customer.
setInterval(async () => {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const candidates = await app.db
            .select({
            orderId: schema_js_1.orders.id,
            customerTelegramId: schema_js_1.users.telegramId,
            chefName: (0, drizzle_orm_1.sql) `(SELECT name FROM users WHERE id = ${schema_js_1.orders.chefId})`,
        })
            .from(schema_js_1.orders)
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.users.id, schema_js_1.orders.customerId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.orders.status, 'completed'), (0, drizzle_orm_1.lt)(schema_js_1.orders.updatedAt, twoHoursAgo), (0, drizzle_orm_1.isNull)(schema_js_1.orders.reviewReminderSentAt), (0, drizzle_orm_1.sql) `NOT EXISTS (SELECT 1 FROM reviews WHERE reviews.order_id = ${schema_js_1.orders.id})`))
            .limit(50);
        for (const row of candidates) {
            try {
                await (0, notify_js_1.sendReviewReminder)(row.orderId, row.chefName, row.customerTelegramId);
                await app.db
                    .update(schema_js_1.orders)
                    .set({ reviewReminderSentAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, row.orderId));
            }
            catch (err) {
                app.log.warn({ err, orderId: row.orderId }, 'review reminder send failed');
            }
        }
        if (candidates.length > 0) {
            app.log.info({ event: 'review_reminders_sent', count: candidates.length });
        }
    }
    catch (err) {
        app.log.error({ err }, 'review reminder cron failed');
    }
}, 30 * 60 * 1000);
