"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRoutes = uploadRoutes;
const r2_js_1 = require("../services/r2.js");
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
async function uploadRoutes(app) {
    app.post('/upload', {
        onRequest: [app.authenticate],
    }, async (request, reply) => {
        var _a, _b;
        try {
            const data = await request.file();
            if (!data) {
                return reply.code(400).send({ error: 'No file provided' });
            }
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
            if (!allowedTypes.includes(data.mimetype)) {
                return reply.code(400).send({ error: 'Only JPEG, PNG, WEBP, HEIC formats allowed' });
            }
            const chunks = [];
            for await (const chunk of data.file) {
                // Check size as we stream to fail fast on large files
                const currentSize = chunks.reduce((sum, buf) => sum + buf.length, 0) + chunk.length;
                if (currentSize > MAX_FILE_SIZE) {
                    return reply.code(413).send({ error: 'Файл слишком большой. Максимум 15 МБ' });
                }
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            if (buffer.length > MAX_FILE_SIZE) {
                return reply.code(413).send({ error: 'Файл слишком большой. Максимум 15 МБ' });
            }
            const folder = (_a = request.query.folder) !== null && _a !== void 0 ? _a : 'avatars';
            const url = await (0, r2_js_1.uploadToR2)(buffer, data.filename, data.mimetype, folder);
            return reply.send({ url });
        }
        catch (err) {
            if (err.code === 'FST_FILES_LIMIT' || err.statusCode === 413 || ((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes('too large'))) {
                return reply.status(413).send({ error: 'Файл слишком большой. Максимум 15 МБ' });
            }
            throw err;
        }
    });
}
