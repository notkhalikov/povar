import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { useAuth } from '../context/AuthContext'
import { getMyChef, patchMyChef } from '../api/chefs'
import type { MyChefProfile } from '../types'
import { useT } from '../i18n'

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#C89FE0', '#F4A261', '#52B788', '#E76F51',
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase() || '?'
}

export default function ProfilePage() {
  const t = useT()
  const { user: tgUser }    = useTelegram()
  const { user: apiUser }   = useAuth()
  const navigate            = useNavigate()
  const [chefProfile, setChefProfile]     = useState<MyChefProfile | null>(null)
  const [togglingActive, setTogglingActive] = useState(false)

  useEffect(() => {
    if (apiUser?.role !== 'chef') return
    getMyChef()
      .then(setChefProfile)
      .catch((err: { status?: number }) => {
        if (err.status === 404) navigate('/chef/onboarding')
      })
  }, [apiUser?.role, navigate])

  async function toggleActive() {
    if (!chefProfile || togglingActive) return
    setTogglingActive(true)
    try {
      const updated = await patchMyChef({ isActive: !chefProfile.isActive })
      setChefProfile(updated)
    } finally { setTogglingActive(false) }
  }

  const fullName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || '—'

  return (
    <div style={{ padding: '24px 16px', paddingBottom: 'var(--page-padding-bottom)' }}>

      {/* ── Avatar + name ───────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          className='profile-avatar'
          style={{ background: avatarColor(fullName) }}
        >
          {initials(fullName)}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{fullName}</div>
        {tgUser?.username && (
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>
            @{tgUser.username}
          </div>
        )}
        {apiUser && (
          <div style={{
            display: 'inline-block', marginTop: 8,
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: apiUser.role === 'chef' ? '#34c75922' : 'var(--tg-theme-secondary-bg-color)',
            color: apiUser.role === 'chef' ? '#34c759' : 'var(--tg-theme-hint-color)',
          }}>
            {t.profile.role[apiUser.role as keyof typeof t.profile.role] ?? t.profile.role.customer}
          </div>
        )}
      </div>

      {/* ── Chef management ─────────────────────────────────────── */}
      {apiUser?.role === 'chef' && chefProfile && (
        <>
          {/* Status toggle */}
          <div className='card' style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{t.profile.status}</div>
                <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
                  {chefProfile.isActive ? t.profile.accepting : t.profile.vacation}
                </div>
              </div>
              {/* iOS-style toggle */}
              <button
                onClick={toggleActive}
                disabled={togglingActive}
                aria-label='Переключить статус'
                style={{
                  width: 51, height: 31, borderRadius: 16, border: 'none', cursor: 'pointer',
                  padding: 0, flexShrink: 0, transition: 'background .2s',
                  background: chefProfile.isActive ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-hint-color)',
                  opacity: togglingActive ? .6 : 1,
                  position: 'relative',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 3, width: 25, height: 25, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left .2s',
                  left: chefProfile.isActive ? 23 : 3,
                  boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                }} />
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className='card' style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{chefProfile.ordersCount}</div>
                <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)' }}>{t.profile.orders}</div>
              </div>
              <div style={{ width: 1, background: 'var(--tg-theme-hint-color)', opacity: .2 }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {Number(chefProfile.ratingCache) > 0 ? Number(chefProfile.ratingCache).toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)' }}>{t.profile.rating}</div>
              </div>
              <div style={{ width: 1, background: 'var(--tg-theme-hint-color)', opacity: .2 }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {chefProfile.verificationStatus === 'approved' ? '✓' : '…'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)' }}>{t.profile.verification}</div>
              </div>
            </div>
          </div>

          <button
            className='btn-primary'
            onClick={() => navigate('/chef/onboarding')}
          >
            {t.profile.editProfile}
          </button>
        </>
      )}

      {/* ── Become chef CTA ─────────────────────────────────────── */}
      {apiUser?.role === 'customer' && (
        <div className='card' style={{ textAlign: 'center', padding: '28px 16px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍🍳</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.profile.becomeChefTitle}</div>
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)', marginBottom: 20, lineHeight: 1.5 }}>
            {t.profile.becomeChefHint}
          </div>
          <button
            className='btn-primary'
            onClick={() => navigate('/chef/onboarding')}
          >
            {t.profile.becomeChef}
          </button>
        </div>
      )}

      {!apiUser && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
          {t.profile.noAuth}
        </div>
      )}
    </div>
  )
}
