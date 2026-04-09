import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);
await migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
await sql.end();
console.log('Migrations applied successfully');
//# sourceMappingURL=migrate.js.map