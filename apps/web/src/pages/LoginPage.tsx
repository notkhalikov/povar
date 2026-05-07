import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { ApiUser } from '../types'

interface TelegramAuthUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthUser) => void
  }
}

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? 'povarissimobot'

export default function LoginPage() {
  const navigate = useNavigate()
  const { token, signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)

  // Already signed in — go straight to the app
  useEffect(() => {
    if (token) navigate('/orders', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    window.onTelegramAuth = async (tgUser: TelegramAuthUser) => {
      setError(null)
      try {
        const { token: jwt, user } = await apiFetch<{ token: string; user: ApiUser }>(
          '/auth/telegram-widget',
          { method: 'POST', body: JSON.stringify(tgUser) },
        )
        signIn(jwt, user)
        navigate('/orders', { replace: true })
      } catch {
        setError('Не удалось войти, попробуйте снова')
      }
    }

    const container = document.getElementById('tg-login-btn')
    if (!container) return

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', BOT_USERNAME)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    container.appendChild(script)

    return () => {
      window.onTelegramAuth = undefined
      if (container.contains(script)) container.removeChild(script)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1 }}>👨‍🍳</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Povar</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
          Домашняя кухня в Тбилиси и Батуми
        </p>
      </div>

      <div id='tg-login-btn' style={{ minHeight: 44, display: 'flex', justifyContent: 'center' }} />

      {error && (
        <div style={errorStyle}>{error}</div>
      )}
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 28,
  padding: 24,
}

const errorStyle: React.CSSProperties = {
  color: 'var(--color-danger, #d33)',
  fontSize: 14,
  textAlign: 'center',
  maxWidth: 280,
}
