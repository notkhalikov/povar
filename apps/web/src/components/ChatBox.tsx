import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../hooks/useChat'

interface ChatBoxProps {
  orderId?: number
  requestId?: number
  // Required when requestId is passed — selects the customer↔chef pair.
  chefId?: number
}

export function ChatBox({ orderId, requestId, chefId }: ChatBoxProps) {
  const { user } = useAuth()
  const { messages, sendMessage, isConnected, isLoading } = useChat({ orderId, requestId, chefId })

  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  function handleSend() {
    const value = text.trim()
    if (!value) return
    sendMessage(value)
    setText('')
  }

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ ...listStyle, gap: 10 }}>
          <div className='sk' style={{ height: 36, width: '60%', borderRadius: 14 }} />
          <div className='sk' style={{ height: 36, width: '70%', borderRadius: 14, alignSelf: 'flex-end' }} />
          <div className='sk' style={{ height: 36, width: '50%', borderRadius: 14 }} />
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {!isConnected && (
        <div style={bannerStyle}>Переподключение…</div>
      )}

      <div ref={listRef} style={listStyle}>
        {messages.length === 0 && (
          <div style={emptyStyle}>Сообщений пока нет</div>
        )}
        {messages.map(m => {
          const isOwn = m.senderId === user?.id
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isOwn ? 'flex-end' : 'flex-start',
              }}
            >
              {!isOwn && (
                <div style={senderNameStyle}>{m.senderName}</div>
              )}
              <div
                style={{
                  ...bubbleBaseStyle,
                  background: isOwn ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                  color:      isOwn ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                  borderBottomRightRadius: isOwn ? 4 : 14,
                  borderBottomLeftRadius:  isOwn ? 14 : 4,
                }}
              >
                {m.body}
              </div>
            </div>
          )
        })}
      </div>

      <div style={inputRowStyle}>
        <input
          type='text'
          className='field-input'
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder='Сообщение…'
          maxLength={4000}
          style={{ flex: 1 }}
        />
        <button
          className='btn-primary'
          style={{ width: 'auto', padding: '0 18px', flexShrink: 0, opacity: text.trim() ? 1 : 0.5 }}
          disabled={!text.trim()}
          onClick={handleSend}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--tg-theme-hint-color)22',
  borderRadius: 12,
  background: 'var(--tg-theme-bg-color)',
  marginBottom: 16,
  overflow: 'hidden',
}

const bannerStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#f5a62322',
  color: '#b8740a',
  fontSize: 12,
  textAlign: 'center',
  fontWeight: 500,
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  height: 320,
  overflowY: 'auto',
}

const emptyStyle: React.CSSProperties = {
  margin: 'auto',
  fontSize: 13,
  color: 'var(--tg-theme-hint-color)',
}

const senderNameStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--tg-theme-hint-color)',
  marginBottom: 2,
  padding: '0 8px',
}

const bubbleBaseStyle: React.CSSProperties = {
  maxWidth: '80%',
  padding: '8px 12px',
  borderRadius: 14,
  fontSize: 14,
  lineHeight: 1.4,
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
}

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: 8,
  borderTop: '1px solid var(--tg-theme-hint-color)22',
  alignItems: 'center',
}
