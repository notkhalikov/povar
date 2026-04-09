"use strict";
/**
 * Production seed — creates the first admin user by Telegram ID.
 *
 * Usage:
 *   npx tsx src/db/seed-production.ts <telegram_id>
 *
 * Example:
 *   npx tsx src/db/seed-production.ts 123456789
 *
 * Run once after the first deploy. Subsequent runs are idempotent.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const postgres_1 = __importDefault(require("postgres"));
const postgres_js_1 = require("drizzle-orm/postgres-js");
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("./schema.js");
const telegramIdArg = process.argv[2];
if (!telegramIdArg || isNaN(Number(telegramIdArg))) {
    console.error('Usage: npx tsx src/db/seed-production.ts <telegram_id>');
    process.exit(1);
}
const telegramId = Number(telegramIdArg);
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}
const sql = (0, postgres_1.default)(process.env.DATABASE_URL);
const db = (0, postgres_js_1.drizzle)(sql);
async function seedProduction() {
    console.log(`\n🔑 Creating admin user for telegramId=${telegramId}…\n`);
    const existing = await db
        .select({ id: schema_js_1.users.id, role: schema_js_1.users.role })
        .from(schema_js_1.users)
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.telegramId, telegramId))
        .limit(1);
    if (existing[0]) {
        const u = existing[0];
        if (u.role === 'admin') {
            console.log(`✓ User #${u.id} is already an admin. Nothing to do.`);
        }
        else {
            await db
                .update(schema_js_1.users)
                .set({ role: 'admin' })
                .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, u.id));
            console.log(`✓ Promoted existing user #${u.id} to admin.`);
        }
    }
    else {
        const [created] = await db
            .insert(schema_js_1.users)
            .values({
            telegramId,
            name: 'Admin',
            role: 'admin',
            lang: 'ru',
        })
            .returning({ id: schema_js_1.users.id });
        console.log(`✓ Created admin user #${created.id} for telegramId=${telegramId}.`);
    }
    console.log('\n✅ Done.\n');
}
seedProduction()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => sql.end());
