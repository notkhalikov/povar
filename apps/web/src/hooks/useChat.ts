import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: number
  senderId: number
  senderName: string
  body: string
  createdAt: string
  readAt: string | null
}

interface UseChatOptions {
  orderId?: number
  requestId?: number
  // Required when requestId is provided — selects the customer↔chef pair.
  chefId?: number
}

interface UseChatResult {
  messages: ChatMessage[]
  sendMessage: (text: string) => void
  isConnected: boolean
  isLoading: boolean
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 3000

export function useChat({ orderId, requestId, chefId }: UseChatOptions): UseChatResult {
  const kind: 'order' | 'request' | null =
    orderId   !== undefined ? 'order'   :
    requestId !== undefined ? 'request' :
    null
  const parentId = orderId ?? requestId ?? null

  const baseUrl = import.meta.env.VITE_BASE_URL ?? ''
  const wsBase  = import.meta.env.VITE_WS_URL
    ?? import.meta.env.VITE_BASE_URL?.replace('http', 'ws')

  useEffect(() => {
    if (requestId !== undefined && chefId === undefined) {
      console.warn('useChat: chefId is required when requestId is provided')
    }
  }, [requestId, chefId])

  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading]     = useState(true)

  const wsRef               = useRef<WebSocket | null>(null)
  const reconnectTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const unmountedRef        = useRef(false)

  // ── Load history + mark read on mount / parent change ─────────────────────
  useEffect(() => {
    if (kind === null || parentId === null) return
    if (kind === 'request' && chefId === undefined) return

    let cancelled = false
    const token   = sessionStorage.getItem('jwt')
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const path    = kind === 'order'
      ? `/orders/${parentId}/messages`
      : `/requests/${parentId}/messages`
    const query   = kind === 'request' ? `?chefId=${chefId}` : ''

    setIsLoading(true)

    fetch(`${baseUrl}${path}${query}`, { headers })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((rows: ChatMessage[]) => {
        if (!cancelled) setMessages(rows)
      })
      .catch(() => { if (!cancelled) setMessages([]) })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    // Reset unread counter (fire-and-forget)
    fetch(`${baseUrl}${path}/read${query}`, { method: 'POST', headers }).catch(() => {})

    return () => { cancelled = true }
  }, [kind, parentId, chefId, baseUrl])

  // ── WebSocket lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (kind === null || parentId === null || !wsBase) return
    if (kind === 'request' && chefId === undefined) return

    unmountedRef.current        = false
    reconnectAttemptsRef.current = 0

    function connect() {
      const token = sessionStorage.getItem('jwt')
      const ws    = new WebSocket(
        `${wsBase}/ws/chat?token=${encodeURIComponent(token ?? '')}`,
      )
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
        const joinPayload: Record<string, unknown> = { type: 'join' }
        if (kind === 'order') {
          joinPayload.orderId = parentId
        } else if (kind === 'request') {
          joinPayload.requestId = parentId
          joinPayload.chefId    = chefId
        }
        ws.send(JSON.stringify(joinPayload))
      }

      ws.onmessage = (ev) => {
        let data: { type?: string } & Partial<ChatMessage>
        try { data = JSON.parse(ev.data) } catch { return }
        if (data.type !== 'message' || data.id === undefined) return
        setMessages(prev => [...prev, {
          id:         data.id!,
          senderId:   data.senderId!,
          senderName: data.senderName ?? '',
          body:       data.body ?? '',
          createdAt:  data.createdAt!,
          readAt:     data.readAt ?? null,
        }])
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        if (unmountedRef.current) return
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }

      ws.onerror = () => {
        // close handler runs the reconnect logic
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      const ws = wsRef.current
      wsRef.current = null
      if (ws) {
        ws.onclose = null
        try { ws.close() } catch { /* already closed */ }
      }
      setIsConnected(false)
    }
  }, [kind, parentId, chefId, wsBase])

  // ── Public sender ─────────────────────────────────────────────────────────
  const sendMessage = useCallback((text: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    if (kind === null || parentId === null) return
    if (kind === 'request' && chefId === undefined) return
    const payload: Record<string, unknown> = { type: 'message', text }
    if (kind === 'order') {
      payload.orderId = parentId
    } else if (kind === 'request') {
      payload.requestId = parentId
      payload.chefId    = chefId
    }
    ws.send(JSON.stringify(payload))
  }, [kind, parentId, chefId])

  return { messages, sendMessage, isConnected, isLoading }
}
