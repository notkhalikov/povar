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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      padding: '2rem',
      backgroundColor: '#ffffff',
      textAlign: 'center',
    }}>
      {/* Логотип */}
      <div style={{
        width: 72, height: 72,
        borderRadius: 18,
        backgroundColor: '#FAECE7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <rect x="9" y="15" width="20" height="14" rx="3" fill="#D85A30" opacity="0.15"/>
          <path d="M13 15C13 10 25 10 25 15" stroke="#D85A30" strokeWidth="2"
            strokeLinecap="round" fill="none"/>
          <circle cx="19" cy="21" r="3.5" fill="#D85A30"/>
          <line x1="15" y1="29" x2="15" y2="33" stroke="#D85A30"
            strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="23" y1="29" x2="23" y2="33" stroke="#D85A30"
            strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Название */}
      <h1 style={{
        fontSize: 28, fontWeight: 500,
        color: '#1A1917', margin: '0 0 8px',
      }}>
        Povarissimo
      </h1>

      {/* Подзаголовок */}
      <p style={{
        fontSize: 15, color: '#6B6966',
        margin: '0 0 40px', lineHeight: 1.6,
      }}>
        Домашние повара<br />Тбилиси · Батуми
      </p>

      {/* Кнопка Telegram */}
      <div style={{ width: '100%', maxWidth: 320, marginBottom: 16 }}>
        <div id='tg-login-btn' style={{ display: 'flex', justifyContent: 'center' }} />
      </div>

      {/* Ошибка */}
      {error && (
        <div style={{
          color: '#E24B4A',
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 16,
          maxWidth: 280,
        }}>
          {error}
        </div>
      )}

      {/* Дисклеймер */}
      <p style={{ fontSize: 12, color: '#9E9B97', lineHeight: 1.6 }}>
        Мы получим только ваше имя и Telegram ID.<br />Никаких паролей.
      </p>

      {/* Три фичи снизу */}
      <div style={{
        display: 'flex', gap: 24,
        marginTop: 48,
      }}>
        {[
          { label: 'Рейтинг', icon: '★' },
          { label: 'Безопасно', icon: '✓' },
          { label: 'Проверено', icon: '⚑' },
        ].map(f => (
          <div key={f.label} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              backgroundColor: '#FAECE7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#D85A30',
            }}>
              {f.icon}
            </div>
            <span style={{ fontSize: 11, color: '#9E9B97' }}>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
