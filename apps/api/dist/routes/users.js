"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = usersRoutes;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
async function usersRoutes(app) {
    app.patch('/users/me', { onRequest: [app.authenticate] }, async (request, reply) => {
        const { avatarUrl, portfolioPhotos } = request.body;
        const userId = request.user.id;
        const updates = {};
        if (avatarUrl !== undefined)
            updates.avatarUrl = avatarUrl;
        if (portfolioPhotos !== undefined)
            updates.portfolioPhotos = portfolioPhotos;
        if (Object.keys(updates).length === 0) {
            return reply.status(400).send({ error: 'At least one field is required' });
        }
        await app.db.update(schema_js_1.users)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userId));
        return { ok: true };
    });
    app.patch('/users/me/role', { onRequest: [app.authenticate] }, async (request, reply) => {
        const { role } = request.body;
        const userId = request.user.id;
        if (!role || !['chef', 'customer'].includes(role)) {
            return reply.status(400).send({ error: 'role must be "chef" or "customer"' });
        }
        await app.db.update(schema_js_1.users)
            .set({ role })
            .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, userId));
        return { ok: true };
    });
}
