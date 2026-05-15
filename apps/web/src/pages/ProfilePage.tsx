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
    <div style={{ backgroundColor: '#F7F6F3', minHeight: '100dvh', paddingBottom: 64 }}>

      {/* ШАПКА */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
        padding: '14px 16px',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1A1917', margin: 0 }}>
          Мой профиль
        </h1>
      </div>

      <div style={{ padding: '16px' }}>

        {/* ── Avatar + name ───────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 24, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #E8E6E1', padding: '20px 16px' }}>
          <div
            style={{
              width: 80, height: 80, borderRadius: 12, margin: '0 auto 12px',
              background: avatarColor(fullName),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 700, color: '#ffffff',
            }}
          >
            {initials(fullName)}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: '#1A1917' }}>{fullName}</div>
          {tgUser?.username && (
            <div style={{ fontSize: 13, color: '#6B6966', marginBottom: 12 }}>
              @{tgUser.username}
            </div>
          )}
          {apiUser && (
            <div style={{
              display: 'inline-block',
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: apiUser.role === 'chef' ? '#C0DD97' : '#F7F6F3',
              color: apiUser.role === 'chef' ? '#3B6D11' : '#6B6966',
            }}>
              {t.profile.role[apiUser.role as keyof typeof t.profile.role] ?? t.profile.role.customer}
            </div>
          )}
        </div>

        {/* ── Chef management ─────────────────────────────────────── */}
        {apiUser?.role === 'chef' && chefProfile && (
          <>
            {/* Status toggle */}
            <div style={{ marginBottom: 12, backgroundColor: '#ffffff', border: '1px solid #E8E6E1', borderRadius: 12, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3, color: '#1A1917' }}>{t.profile.status}</div>
                  <div style={{ fontSize: 13, color: '#6B6966' }}>
                    {chefProfile.isActive ? t.profile.accepting : t.profile.vacation}
                  </div>
                </div>
                {/* iOS-style toggle */}
                <button
                  onClick={toggleActive}
                  disabled={togglingActive}
                  aria-label={t.a11y.toggleStatus}
                  style={{
                    width: 51, height: 31, borderRadius: 16, border: 'none', cursor: 'pointer',
                    padding: 0, flexShrink: 0, transition: 'background .2s',
                    background: chefProfile.isActive ? '#D85A30' : '#9E9B97',
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
            <div style={{ marginBottom: 12, backgroundColor: '#ffffff', border: '1px solid #E8E6E1', borderRadius: 12, padding: '16px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1917' }}>{chefProfile.ordersCount}</div>
                <div style={{ fontSize: 12, color: '#6B6966' }}>{t.profile.orders}</div>
              </div>
              <div style={{ width: 1, background: '#E8E6E1', opacity: 1 }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1917' }}>
                  {Number(chefProfile.ratingCache) > 0 ? Number(chefProfile.ratingCache).toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6B6966' }}>{t.profile.rating}</div>
              </div>
              <div style={{ width: 1, background: '#E8E6E1', opacity: 1 }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1917' }}>
                  {chefProfile.verificationStatus === 'approved' ? '✓' : '…'}
                </div>
                <div style={{ fontSize: 12, color: '#6B6966' }}>{t.profile.verification}</div>
              </div>
            </div>

            <button
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                border: 'none', cursor: 'pointer',
              }}
              onClick={() => navigate('/chef/onboarding')}
            >
              {t.profile.editProfile}
            </button>
          </>
        )}

        {/* ── Become chef CTA ─────────────────────────────────────── */}
        {apiUser?.role === 'customer' && (
          <div style={{ textAlign: 'center', padding: '28px 16px', backgroundColor: '#ffffff', border: '1px solid #E8E6E1', borderRadius: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍🍳</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1A1917' }}>{t.profile.becomeChefTitle}</div>
            <div style={{ fontSize: 14, color: '#6B6966', marginBottom: 20, lineHeight: 1.5 }}>
              {t.profile.becomeChefHint}
            </div>
            <button
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                border: 'none', cursor: 'pointer',
              }}
              onClick={() => navigate('/chef/onboarding')}
            >
              {t.profile.becomeChef}
            </button>
          </div>
        )}

        {!apiUser && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#6B6966', fontSize: 14 }}>
            {t.profile.noAuth}
          </div>
        )}
      </div>
    </div>
  )
}
