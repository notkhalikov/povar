"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("../db/schema.js");
const redis_js_1 = require("./redis.js");
const CHAT_CHANNEL = 'chat';
const rooms = new Map();
function addToRoom(room, client) {
    if (client.room && client.room !== room)
        leaveRoom(client);
    client.room = room;
    let set = rooms.get(room);
    if (!set) {
        set = new Set();
        rooms.set(room, set);
    }
    set.add(client);
}
function leaveRoom(client) {
    if (!client.room)
        return;
    const set = rooms.get(client.room);
    set === null || set === void 0 ? void 0 : set.delete(client);
    if (set && set.size === 0)
        rooms.delete(client.room);
    client.room = null;
}
function sendError(client, error) {
    try {
        client.socket.send(JSON.stringify({ type: 'error', error }));
    }
    catch { /* socket closed */ }
}
function broadcastToRoom(app, roomKey, payload) {
    var _a;
    const set = rooms.get(roomKey);
    const size = (_a = set === null || set === void 0 ? void 0 : set.size) !== null && _a !== void 0 ? _a : 0;
    app.log.info(`[WS] message in room ${roomKey}, broadcasting to ${size} connections`);
    if (!set)
        return;
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const c of set) {
        app.log.info(`[WS] sending to connection, readyState: ${c.socket.readyState}`);
        if (c.socket.readyState === 1 /* OPEN */) {
            try {
                c.socket.send(payloadStr);
            }
            catch { /* skip */ }
        }
    }
}
async function authorizeOrder(app, userId, orderId) {
    const [o] = await app.db
        .select({ customerId: schema_js_1.orders.customerId, chefId: schema_js_1.orders.chefId })
        .from(schema_js_1.orders)
        .where((0, drizzle_orm_1.eq)(schema_js_1.orders.id, orderId))
        .limit(1);
    if (!o)
        return false;
    return o.customerId === userId || o.chefId === userId;
}
async function authorizeRequestPair(app, userId, requestId, chefId) {
    const [r] = await app.db
        .select({ customerId: schema_js_1.requests.customerId })
        .from(schema_js_1.requests)
        .where((0, drizzle_orm_1.eq)(schema_js_1.requests.id, requestId))
        .limit(1);
    if (!r)
        return false;
    // Owner of the request, OR the chef whose room this is (joining as themselves).
    return r.customerId === userId || chefId === userId;
}
async function handleJoin(app, client, msg) {
    var _a, _b, _c, _d;
    if (msg.orderId) {
        const ok = await authorizeOrder(app, client.userId, msg.orderId);
        if (!ok)
            return sendError(client, 'Forbidden');
        const room = `order_${msg.orderId}`;
        addToRoom(room, client);
        const size = (_b = (_a = rooms.get(room)) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0;
        app.log.info(`[WS] user ${client.userId} joined room ${room}, total connections: ${size}`);
        client.socket.send(JSON.stringify({ type: 'joined', room }));
        return;
    }
    if (msg.requestId) {
        if (!msg.chefId) {
            client.socket.close(4403, 'chefId required for request join');
            return;
        }
        const ok = await authorizeRequestPair(app, client.userId, msg.requestId, msg.chefId);
        if (!ok) {
            client.socket.close(4403, 'Forbidden');
            return;
        }
        const room = `request_${msg.requestId}_${msg.chefId}`;
        addToRoom(room, client);
        const size = (_d = (_c = rooms.get(room)) === null || _c === void 0 ? void 0 : _c.size) !== null && _d !== void 0 ? _d : 0;
        app.log.info(`[WS] user ${client.userId} joined room ${room}, total connections: ${size}`);
        client.socket.send(JSON.stringify({ type: 'joined', room }));
        return;
    }
    sendError(client, 'orderId or requestId required');
}
async function handleMessage(app, client, msg) {
    var _a;
    if (!client.room)
        return sendError(client, 'Not joined');
    const text = typeof msg.text === 'string' ? msg.text.trim() : '';
    if (!text)
        return sendError(client, 'Empty message');
    const parts = client.room.split('_');
    const isOrder = parts[0] === 'order';
    const insertValues = isOrder
        ? {
            senderId: client.userId,
            body: text,
            orderId: Number(parts[1]),
        }
        : {
            senderId: client.userId,
            body: text,
            requestId: Number(parts[1]),
            chefId: Number(parts[2]),
        };
    const [inserted] = await app.db
        .insert(schema_js_1.messages)
        .values(insertValues)
        .returning();
    const [sender] = await app.db
        .select({ name: schema_js_1.users.name })
        .from(schema_js_1.users)
        .where((0, drizzle_orm_1.eq)(schema_js_1.users.id, client.userId))
        .limit(1);
    const messageObj = {
        type: 'message',
        id: inserted.id,
        senderId: client.userId,
        senderName: (_a = sender === null || sender === void 0 ? void 0 : sender.name) !== null && _a !== void 0 ? _a : '',
        body: inserted.body,
        createdAt: inserted.createdAt,
    };
    app.log.info(`[WS] publishing to redis, room ${client.room}`);
    await redis_js_1.pub.publish(CHAT_CHANNEL, JSON.stringify({ roomKey: client.room, payload: messageObj }));
}
exports.default = (0, fastify_plugin_1.default)(async (app) => {
    await app.register(websocket_1.default);
    // Visibility into Redis connection state in Railway logs
    redis_js_1.pub.on('error', (err) => app.log.error({ err }, '[WS] redis pub error'));
    redis_js_1.sub.on('error', (err) => app.log.error({ err }, '[WS] redis sub error'));
    // One subscription per app instance. ioredis queues until connected.
    redis_js_1.sub.subscribe(CHAT_CHANNEL).catch(err => {
        app.log.error({ err }, '[WS] redis subscribe failed');
    });
    redis_js_1.sub.on('message', (channel, data) => {
        if (channel !== CHAT_CHANNEL)
            return;
        try {
            const { roomKey, payload } = JSON.parse(data);
            broadcastToRoom(app, roomKey, payload);
        }
        catch (err) {
            app.log.error({ err, data }, '[WS] redis parse error');
        }
    });
    app.get('/ws/chat', { websocket: true }, (conn, req) => {
        var _a;
        const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : '/', 'http://localhost');
        const token = url.searchParams.get('token');
        if (!token) {
            conn.socket.close(4401, 'No token');
            return;
        }
        let payload;
        try {
            payload = app.jwt.verify(token);
        }
        catch {
            conn.socket.close(4401, 'Invalid token');
            return;
        }
        const client = {
            socket: conn.socket,
            userId: payload.sub,
            room: null,
        };
        conn.socket.on('message', async (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw.toString());
            }
            catch {
                return sendError(client, 'Invalid JSON');
            }
            try {
                if (msg.type === 'join') {
                    await handleJoin(app, client, msg);
                }
                else if (msg.type === 'message') {
                    await handleMessage(app, client, msg);
                }
                else {
                    sendError(client, 'Unknown message type');
                }
            }
            catch (err) {
                app.log.error({ err, event: 'chat_ws_handler_error' });
                sendError(client, 'Internal error');
            }
        });
        conn.socket.on('close', () => {
            leaveRoom(client);
        });
    });
});
