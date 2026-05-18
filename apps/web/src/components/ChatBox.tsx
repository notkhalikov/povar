import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { useChat } from '../hooks/useChat'

interface ChatBoxProps {
  orderId?: number
  requestId?: number
  // Required when requestId is passed — selects the customer↔chef pair.
  chefId?: number
  // When the chat is actually visible to the user. Default `true` keeps existing
  // behaviour for callers that always render the chat (e.g. request page).
  // Pass `false` from a parent that toggles the chat behind a button — that
  // suppresses the auto-mark-as-read until the user explicitly opens it.
  isOpen?: boolean
}

export function ChatBox({ orderId, requestId, chefId, isOpen = true }: ChatBoxProps) {
  const { user } = useAuth()
  const { messages, sendMessage, markAsRead, isConnected, isLoading } = useChat({
    orderId,
    requestId,
    chefId,
    currentUserId: user?.id,
  })

  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  useEffect(() => {
    if (!isOpen) return
    markAsRead()
  }, [isOpen, markAsRead])

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && isOpen) markAsRead()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [markAsRead, isOpen])

  function handleSend() {
    const value = text.trim()
    if (!value) return
    sendMessage(value)
    setText('')
  }

  if (isLoading) {
    return (
      <div style={{ backgroundColor: '#ffffff', borderTop: '1px solid #E8E6E1', padding: '12px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className='sk' style={{ height: 36, width: '60%', borderRadius: 14 }} />
          <div className='sk' style={{ height: 36, width: '70%', borderRadius: 14, alignSelf: 'flex-end' }} />
          <div className='sk' style={{ height: 36, width: '50%', borderRadius: 14 }} />
        </div>
      </div>
    )
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ backgroundColor: '#ffffff', borderTop: '1px solid #E8E6E1' }}>

      {/* Заголовок чата */}
      <div style={{
        padding: '12px 16px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6966' }}>Чат</span>
      </div>

      {!isConnected && (
        <div style={{
          padding: '8px 12px',
          background: '#f5a62322',
          color: '#b8740a',
          fontSize: 12,
          textAlign: 'center',
          fontWeight: 500,
        }}>
          Переподключение…
        </div>
      )}

      {/* Сообщения */}
      <div
        ref={listRef}
        style={{
          padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: 320, overflowY: 'auto',
        }}
      >
        {messages.length === 0 && (
          <div style={{ margin: 'auto', fontSize: 13, color: '#9E9B97' }}>
            Сообщений пока нет
          </div>
        )}
        {messages.map(msg => {
          const isOwn = msg.senderId === user?.id
          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isOwn ? 'flex-end' : 'flex-start',
              gap: 2,
            }}>
              {!isOwn && (
                <span style={{ fontSize: 11, color: '#9E9B97', paddingLeft: 2 }}>
                  {msg.senderName}
                </span>
              )}
              <div style={{
                maxWidth: '75%', padding: '8px 12px',
                borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                backgroundColor: isOwn ? '#D85A30' : '#F7F6F3',
                color: isOwn ? '#ffffff' : '#1A1917',
                fontSize: 14, lineHeight: 1.4,
              }}>
                {msg.body}
              </div>
              {isOwn && (
                <span style={{ fontSize: 10, color: '#9E9B97' }}>
                  {new Date(msg.createdAt).toLocaleTimeString('ru', {
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderTop: '1px solid #E8E6E1',
      }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder="Написать сообщение..."
          style={{
            flex: 1, padding: '9px 14px',
            borderRadius: 20, border: '1px solid #E8E6E1',
            backgroundColor: '#F7F6F3', fontSize: 14,
            color: '#1A1917', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            backgroundColor: '#D85A30', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h10M9 4l4 4-4 4"
              stroke="#ffffff" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

    </div>
  )
}