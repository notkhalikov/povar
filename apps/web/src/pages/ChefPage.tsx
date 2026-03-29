import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getChef } from '../api/chefs'
import type { ChefProfile } from '../types'

export default function ChefPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [chef, setChef] = useState<ChefProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stable callback ref so offClick can remove the correct listener
  const goBack = useCallback(() => navigate(-1), [navigate])

  // Telegram BackButton
  useEffect(() => {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(goBack)
    return () => {
      WebApp.BackButton.hide()
      WebApp.BackButton.offClick(goBack)
    }
  }, [goBack])

  useEffect(() => {
    if (!id) return
    getChef(Number(id))
      .then(setChef)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  }
  if (error) {
    return <div style={{ padding: 24, color: 'red' }}>Ошибка: {error}</div>
  }
  if (!chef) return null

  const rating = Number(chef.ratingCache)

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>{chef.name}</h2>
        {chef.city && (
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>
            📍 {chef.city}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 14 }}>
          <span>★ {rating > 0 ? rating.toFixed(1) : '—'}</span>
          <span style={{ color: 'var(--tg-theme-hint-color)' }}>
            {chef.ordersCount} {plural(chef.ordersCount, 'заказ', 'заказа', 'заказов')}
          </span>
        </div>
      </div>

      {/* Bio */}
      {chef.bio && (
        <section style={sectionStyle}>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 15 }}>{chef.bio}</p>
        </section>
      )}

      {/* Cuisine tags */}
      {chef.cuisineTags.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Кухня</SectionLabel>
          <div style={tagsRow}>
            {chef.cuisineTags.map(tag => (
              <span key={tag} style={cuisineTagStyle}>{tag}</span>
            ))}
          </div>
        </section>
      )}

      {/* Work formats */}
      {chef.workFormats.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Формат работы</SectionLabel>
          <div style={tagsRow}>
            {chef.workFormats.map(f => (
              <span key={f} style={formatTagStyle}>
                {f === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Districts */}
      {chef.districts.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Районы</SectionLabel>
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>
            {chef.districts.join(', ')}
          </div>
        </section>
      )}

      {/* Average price */}
      {chef.avgPrice && (
        <section style={sectionStyle}>
          <SectionLabel>Средний чек</SectionLabel>
          <div style={{ fontSize: 20, fontWeight: 600 }}>от {chef.avgPrice} ₾</div>
        </section>
      )}

      {/* Order CTA — Stage 2 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'var(--tg-theme-bg-color)', borderTop: '1px solid var(--tg-theme-hint-color)' }}>
        <button
          style={buttonStyle}
          onClick={() => navigate(`/orders/new?chefId=${chef.id}`)}
        >
          Заказать
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
}

const tagsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const cuisineTagStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 20,
  fontSize: 13,
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
}

const formatTagStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 20,
  fontSize: 13,
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  border: '1px solid var(--tg-theme-hint-color)',
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
