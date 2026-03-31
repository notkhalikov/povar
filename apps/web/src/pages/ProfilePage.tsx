import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { useAuth } from '../context/AuthContext'
import { getMyChef, patchMyChef } from '../api/chefs'
import type { MyChefProfile } from '../types'

export default function ProfilePage() {
  const { user: tgUser } = useTelegram()
  const { user: apiUser } = useAuth()
  const navigate = useNavigate()

  const [chefProfile, setChefProfile] = useState<MyChefProfile | null>(null)
  const [togglingActive, setTogglingActive] = useState(false)

  useEffect(() => {
    if (apiUser?.role !== 'chef') return

    getMyChef()
      .then(setChefProfile)
      .catch((err: { status?: number }) => {
        if (err.status === 404) {
          navigate('/chef/onboarding')
        }
      })
  }, [apiUser?.role, navigate])

  async function toggleActive() {
    if (!chefProfile || togglingActive) return
    setTogglingActive(true)
    try {
      const updated = await patchMyChef({ isActive: !chefProfile.isActive })
      setChefProfile(updated)
    } finally {
      setTogglingActive(false)
    }
  }

  return (
    <div style={{ padding: '24px 16px' }}>
      <h2 style={{ margin: '0 0 20px' }}>Профиль</h2>

      <div style={sectionStyle}>
        <Row label='Имя' value={tgUser?.first_name ?? '—'} />
        {tgUser?.last_name && <Row label='Фамилия' value={tgUser.last_name} />}
        {tgUser?.username && <Row label='Username' value={`@${tgUser.username}`} />}
        <Row
          label='Роль'
          value={
            apiUser?.role === 'chef'
              ? '👨‍🍳 Повар'
              : apiUser?.role === 'admin'
              ? '🛡 Администратор'
              : '🛒 Заказчик'
          }
        />
      </div>

      {apiUser?.role === 'chef' && chefProfile && (
        <div style={{ marginTop: 24 }}>
          {/* isActive toggle */}
          <div style={{ ...sectionStyle, padding: '0 16px', marginBottom: 16 }}>
            <div style={toggleRowStyle}>
              <div>
                <div style={{ fontSize: 15 }}>Доступность</div>
                <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
                  {chefProfile.isActive ? 'Активен — виден в каталоге' : 'В отпуске — скрыт из каталога'}
                </div>
              </div>
              <button
                onClick={toggleActive}
                disabled={togglingActive}
                aria-label='Переключить статус'
                style={{
                  ...toggleBtnStyle,
                  background: chefProfile.isActive
                    ? 'var(--tg-theme-button-color)'
                    : 'var(--tg-theme-hint-color)',
                  opacity: togglingActive ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'transform 0.2s',
                    transform: chefProfile.isActive ? 'translateX(18px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          </div>

          <button style={buttonStyle} onClick={() => navigate('/chef/onboarding')}>
            Редактировать анкету
          </button>
        </div>
      )}

      {apiUser?.role === 'customer' && (
        <div style={{ marginTop: 24 }}>
          <button style={buttonStyle} onClick={() => navigate('/chef/onboarding')}>
            Стать поваром
          </button>
        </div>
      )}

      {!apiUser && (
        <p style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14, marginTop: 16 }}>
          Откройте приложение через Telegram для авторизации
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--tg-theme-hint-color)' }}>
      <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--tg-theme-secondary-bg-color)',
  borderRadius: 12,
  padding: '0 16px',
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 0',
}

const toggleBtnStyle: React.CSSProperties = {
  width: 44,
  height: 26,
  borderRadius: 13,
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  transition: 'background 0.2s',
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
}
