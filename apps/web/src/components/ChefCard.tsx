import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChefListItem } from '../types'
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

export function ChefCard({ chef }: { chef: ChefListItem }) {
  const t = useT()
  const rating  = Number(chef.ratingCache)
  const [pressed, setPressed] = useState(false)

  const badges: { label: string; color: string; bg: string }[] = []
  if (chef.verificationStatus === 'approved')
    badges.push({ label: t.chef.badgeVerified, color: '#007aff', bg: '#007aff22' })
  if (rating >= 4.8 && chef.ordersCount >= 10)
    badges.push({ label: t.chef.badgeTop, color: '#f5a623', bg: '#f5a62322' })
  if (chef.ordersCount < 3)
    badges.push({ label: t.chef.badgeNew, color: '#8e8e93', bg: '#8e8e9322' })

  function handlePressStart() {
    setPressed(true)
    setTimeout(() => setPressed(false), 100)
  }

  return (
    <Link
      to={`/chefs/${chef.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      onMouseDown={handlePressStart}
      onTouchStart={handlePressStart}
    >
      <div
        className='card'
        style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 0.1s ease',
        }}
      >
        {/* Avatar */}
        <div
          className='chef-avatar-sm'
          style={{ background: avatarColor(chef.name) }}
        >
          {initials(chef.name)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + rating */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <strong style={{ fontSize: 15, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {chef.name}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <span style={{ color: '#f5a623', fontSize: 13 }}>★</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: rating > 0 ? 'var(--tg-theme-text-color)' : 'var(--tg-theme-hint-color)' }}>
                {rating > 0 ? rating.toFixed(1) : '—'}
              </span>
            </div>
          </div>

          {/* Location */}
          {chef.city && (
            <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)', marginBottom: 8 }}>
              📍 {chef.city}{chef.districts.length > 0 ? ` · ${chef.districts[0]}` : ''}
            </div>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {badges.map(b => (
                <span key={b.label} style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: b.bg, color: b.color,
                }}>
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {chef.cuisineTags.slice(0, 3).map(tag => (
              <span key={tag} className='tag-cuisine'>{tag}</span>
            ))}
            {chef.workFormats.map(f => (
              <span key={f} className='tag-format'>
                {f === 'home_visit' ? '🏠 На дом' : '🚚 Доставка'}
              </span>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
              {chef.avgPrice ? `от ${chef.avgPrice} ₾` : `${chef.ordersCount} заказов`}
            </span>
            <span style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
            }}>
              {t.catalog.moreBtn}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
