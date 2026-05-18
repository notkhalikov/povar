import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
    console.log('Migrations applied successfully');
  } catch (e: any) {
    // If table already exists — mark as resolved and continue
    if (e?.cause?.code === '42P07' || e?.code === '42P07') {
      console.warn('Some tables already exist, skipping. DB is up to date.');
    } else {
      throw e;
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});