import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { ApiUser } from '../types'

export default function LoginPage() {
  const navigate = useNavigate()
  const { token, signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inTelegram, setInTelegram] = useState(false)

  // Already signed in — go straight to the app
  useEffect(() => {
    if (token) navigate('/orders', { replace: true })
  }, [token, navigate])

  // Auto-login via Mini App initData
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    const initData = tg?.initData

    if (!initData) {
      // Not inside Telegram Mini App
      setInTelegram(false)
      setLoading(false)
      return
    }

    setInTelegram(true)
    setError(null)

    apiFetch<{ token: string; user: ApiUser }>(
      '/auth/telegram-miniapp',
      { method: 'POST', body: JSON.stringify({ initData }) },
    )
      .then(({ token: jwt, user }) => {
        signIn(jwt, user)
        navigate('/orders', { replace: true })
      })
      .catch(err => {
        setError(err.message || 'Не удалось войти')
        setLoading(false)
      })
  }, [signIn, navigate])

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

      {/* Loading или статус */}
      {loading ? (
        <div style={{
          fontSize: 16, color: '#6B6966',
          marginBottom: 16, minHeight: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          ⏳ Загрузка...
        </div>
      ) : !inTelegram ? (
        <div style={{
          fontSize: 16, color: '#E24B4A', fontWeight: 500,
          marginBottom: 16, minHeight: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          Открой приложение в Telegram
        </div>
      ) : error ? (
        <div style={{
          color: '#E24B4A',
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 16,
          maxWidth: 280,
        }}>
          {error}
        </div>
      ) : null}

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
