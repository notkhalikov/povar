import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import websocket, { type SocketStream } from '@fastify/websocket'
import { eq } from 'drizzle-orm'
import {
  messages,
  orders,
  requests,
  users,
} from '../db/schema.js'
import type { JwtPayload } from '../plugins/auth.js'
import { pub, sub } from './redis.js'

const CHAT_CHANNEL = 'chat'

interface ChatBroadcast {
  roomKey: RoomKey
  payload: unknown
}

type RoomKey = `order_${number}` | `request_${number}_${number}`

interface JoinMessage {
  type: 'join'
  orderId?: number
  requestId?: number
  chefId?: number
}

interface SendMessage {
  type: 'message'
  text: string
  orderId?: number
  requestId?: number
  chefId?: number
}

type ClientMessage = JoinMessage | SendMessage

interface ChatClient {
  socket: SocketStream['socket']
  userId: number
  room: RoomKey | null
}

const rooms = new Map<RoomKey, Set<ChatClient>>()

function addToRoom(room: RoomKey, client: ChatClient) {
  if (client.room && client.room !== room) leaveRoom(client)
  client.room = room
  let set = rooms.get(room)
  if (!set) {
    set = new Set()
    rooms.set(room, set)
  }
  set.add(client)
}

function leaveRoom(client: ChatClient) {
  if (!client.room) return
  const set = rooms.get(client.room)
  set?.delete(client)
  if (set && set.size === 0) rooms.delete(client.room)
  client.room = null
}

function sendError(client: ChatClient, error: string) {
  try {
    client.socket.send(JSON.stringify({ type: 'error', error }))
  } catch { /* socket closed */ }
}

function broadcastToRoom(
  app: FastifyInstance,
  roomKey: RoomKey,
  payload: unknown,
) {
  const set = rooms.get(roomKey)
  const size = set?.size ?? 0
  app.log.info(`[WS] message in room ${roomKey}, broadcasting to ${size} connections`)
  if (!set) return
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
  for (const c of set) {
    app.log.info(`[WS] sending to connection, readyState: ${c.socket.readyState}`)
    if (c.socket.readyState === 1 /* OPEN */) {
      try { c.socket.send(payloadStr) } catch { /* skip */ }
    }
  }
}

async function authorizeOrder(
  app: FastifyInstance,
  userId: number,
  orderId: number,
): Promise<boolean> {
  const [o] = await app.db
    .select({ customerId: orders.customerId, chefId: orders.chefId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  if (!o) return false
  return o.customerId === userId || o.chefId === userId
}

async function authorizeRequestPair(
  app: FastifyInstance,
  userId: number,
  requestId: number,
  chefId: number,
): Promise<boolean> {
  const [r] = await app.db
    .select({ customerId: requests.customerId })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1)
  if (!r) return false
  // Owner of the request, OR the chef whose room this is (joining as themselves).
  return r.customerId === userId || chefId === userId
}

async function handleJoin(
  app: FastifyInstance,
  client: ChatClient,
  msg: JoinMessage,
) {
  if (msg.orderId) {
    const ok = await authorizeOrder(app, client.userId, msg.orderId)
    if (!ok) return sendError(client, 'Forbidden')
    const room: RoomKey = `order_${msg.orderId}`
    addToRoom(room, client)
    const size = rooms.get(room)?.size ?? 0
    app.log.info(`[WS] user ${client.userId} joined room ${room}, total connections: ${size}`)
    client.socket.send(JSON.stringify({ type: 'joined', room }))
    return
  }
  if (msg.requestId) {
    if (!msg.chefId) {
      client.socket.close(4403, 'chefId required for request join')
      return
    }
    const ok = await authorizeRequestPair(
      app,
      client.userId,
      msg.requestId,
      msg.chefId,
    )
    if (!ok) {
      client.socket.close(4403, 'Forbidden')
      return
    }
    const room: RoomKey = `request_${msg.requestId}_${msg.chefId}`
    addToRoom(room, client)
    const size = rooms.get(room)?.size ?? 0
    app.log.info(`[WS] user ${client.userId} joined room ${room}, total connections: ${size}`)
    client.socket.send(JSON.stringify({ type: 'joined', room }))
    return
  }
  sendError(client, 'orderId or requestId required')
}

async function handleMessage(
  app: FastifyInstance,
  client: ChatClient,
  msg: SendMessage,
) {
  if (!client.room) return sendError(client, 'Not joined')

  const text = typeof msg.text === 'string' ? msg.text.trim() : ''
  if (!text) return sendError(client, 'Empty message')

  const parts = client.room.split('_')
  const isOrder = parts[0] === 'order'

  const insertValues = isOrder
    ? {
        senderId:  client.userId,
        body:      text,
        orderId:   Number(parts[1]),
      }
    : {
        senderId:  client.userId,
        body:      text,
        requestId: Number(parts[1]),
        chefId:    Number(parts[2]),
      }

  const [inserted] = await app.db
    .insert(messages)
    .values(insertValues)
    .returning()

  const [sender] = await app.db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, client.userId))
    .limit(1)

  const messageObj = {
    type:       'message',
    id:         inserted.id,
    senderId:   client.userId,
    senderName: sender?.name ?? '',
    body:       inserted.body,
    createdAt:  inserted.createdAt,
  }

  app.log.info(`[WS] publishing to redis, room ${client.room}`)
  await pub.publish(
    CHAT_CHANNEL,
    JSON.stringify({ roomKey: client.room, payload: messageObj } satisfies ChatBroadcast),
  )
}

export default fp(async (app: FastifyInstance) => {
  await app.register(websocket)

  // Visibility into Redis connection state in Railway logs
  pub.on('error', (err) => app.log.error({ err }, '[WS] redis pub error'))
  sub.on('error', (err) => app.log.error({ err }, '[WS] redis sub error'))

  // One subscription per app instance. ioredis queues until connected.
  sub.subscribe(CHAT_CHANNEL).catch(err => {
    app.log.error({ err }, '[WS] redis subscribe failed')
  })

  sub.on('message', (channel, data) => {
    if (channel !== CHAT_CHANNEL) return
    try {
      const { roomKey, payload } = JSON.parse(data) as ChatBroadcast
      broadcastToRoom(app, roomKey, payload)
    } catch (err) {
      app.log.error({ err, data }, '[WS] redis parse error')
    }
  })

  app.get('/ws/chat', { websocket: true }, (conn: SocketStream, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const token = url.searchParams.get('token')

    if (!token) {
      conn.socket.close(4401, 'No token')
      return
    }

    let payload: JwtPayload
    try {
      payload = app.jwt.verify<JwtPayload>(token)
    } catch {
      conn.socket.close(4401, 'Invalid token')
      return
    }

    const client: ChatClient = {
      socket: conn.socket,
      userId: payload.sub,
      room:   null,
    }

    conn.socket.on('message', async (raw: Buffer) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage
      } catch {
        return sendError(client, 'Invalid JSON')
      }

      try {
        if (msg.type === 'join') {
          await handleJoin(app, client, msg)
        } else if (msg.type === 'message') {
          await handleMessage(app, client, msg)
        } else {
          sendError(client, 'Unknown message type')
        }
      } catch (err) {
        app.log.error({ err, event: 'chat_ws_handler_error' })
        sendError(client, 'Internal error')
      }
    })

    conn.socket.on('close', () => {
      leaveRoom(client)
    })
  })
})
