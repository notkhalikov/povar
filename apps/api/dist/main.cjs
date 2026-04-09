"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_js_1 = __importDefault(require("./plugins/cors.js"));
const db_js_1 = __importDefault(require("./plugins/db.js"));
const auth_js_1 = __importDefault(require("./plugins/auth.js"));
const auth_js_2 = __importDefault(require("./routes/auth.js"));
const chefs_js_1 = __importDefault(require("./routes/chefs.js"));
const orders_js_1 = __importDefault(require("./routes/orders.js"));
const payments_js_1 = __importDefault(require("./routes/payments.js"));
// Fail fast if required env vars are missing
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'BOT_TOKEN'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`Missing required env variable: ${key}`);
        process.exit(1);
    }
}
const app = (0, fastify_1.default)({ logger: true });
async function bootstrap() {
    var _a;
    // Plugins
    await app.register(cors_js_1.default);
    await app.register(db_js_1.default);
    await app.register(auth_js_1.default);
    // Routes
    await app.register(auth_js_2.default);
    await app.register(chefs_js_1.default);
    await app.register(orders_js_1.default);
    await app.register(payments_js_1.default);
    app.get('/health', async () => ({ status: 'ok' }));
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
