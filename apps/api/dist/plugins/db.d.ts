import type { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.js';
type DB = ReturnType<typeof drizzle<typeof schema>>;
declare module 'fastify' {
    interface FastifyInstance {
        db: DB;
    }
}
declare const _default: (app: FastifyInstance) => Promise<void>;
export default _default;
//# sourceMappingURL=db.d.ts.map