import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getChefs } from '../api/chefs'
import type { ChefsQuery } from '../api/chefs'
import type { ChefListItem } from '../types'

const CITIES = ['Тбилиси', 'Батуми']
const FORMATS = [
  { value: '', label: 'Любой формат' },
  { value: 'home_visit', label: 'Повар на дом' },
  { value: 'delivery', label: 'Доставка' },
] as const

const DEFAULT_QUERY: ChefsQuery = { sort: 'rating' }

export default function CatalogPage() {
  const [chefs, setChefs] = useState<ChefListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState<ChefsQuery>(DEFAULT_QUERY)
  const [cuisineInput, setCuisineInput] = useState('')

  const hasActiveFilters = Boolean(
    query.city || query.format || query.cuisine || query.minRating
  )

  function resetFilters() {
    setQuery(DEFAULT_QUERY)
    setCuisineInput('')
  }

  // Debounce cuisine input → query
  useEffect(() => {
    const t = setTimeout(
      () => setQuery(q => ({ ...q, cuisine: cuisineInput.trim() || undefined })),
      400,
    )
    return () => clearTimeout(t)
  }, [cuisineInput])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getChefs(query)
      .then(res => setChefs(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [query])

  return (
    <div style={{ padding: '12px 16px' }}>
      <h2 style={{ margin: '0 0 12px' }}>Повара</h2>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {/* Row 1: city + format */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={query.city ?? ''}
            onChange={e => setQuery(q => ({ ...q, city: e.target.value || undefined }))}
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value=''>Все города</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={query.format ?? ''}
            onChange={e =>
              setQuery(q => ({
                ...q,
                format: (e.target.value as ChefsQuery['format']) || undefined,
              }))
            }
            style={{ ...selectStyle, flex: 1 }}
          >
            {FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Row 2: cuisine + sort */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type='text'
            placeholder='Кухня (грузинская…)'
            value={cuisineInput}
            onChange={e => setCuisineInput(e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
          />

          <select
            value={query.sort ?? 'rating'}
            onChange={e =>
              setQuery(q => ({ ...q, sort: e.target.value as 'rating' | 'price' }))
            }
            style={selectStyle}
          >
            <option value='rating'>По рейтингу</option>
            <option value='price'>По цене</option>
          </select>
        </div>

        {/* Row 3: minRating + reset */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={query.minRating ?? ''}
            onChange={e =>
              setQuery(q => ({ ...q, minRating: e.target.value ? Number(e.target.value) : undefined }))
            }
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value=''>Любой рейтинг</option>
            <option value='3'>от 3 ★</option>
            <option value='4'>от 4 ★</option>
            <option value='4.5'>от 4.5 ★</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={resetBtnStyle}
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <p style={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center', marginTop: 32 }}>
          Загрузка…
        </p>
      )}
      {error && (
        <p style={{ color: 'red' }}>Ошибка: {error}</p>
      )}
      {!loading && !error && chefs.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
          <p style={{ color: 'var(--tg-theme-hint-color)', margin: 0 }}>Поваров не найдено</p>
          <p style={{ color: 'var(--tg-theme-hint-color)', fontSize: 13, margin: '4px 0 0' }}>
            Попробуйте изменить фильтры
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chefs.map(chef => (
          <ChefCard key={chef.id} chef={chef} />
        ))}
      </div>
    </div>
  )
}

function ChefCard({ chef }: { chef: ChefListItem }) {
  const rating = Number(chef.ratingCache)

  return (
    <Link to={`/chefs/${chef.id}`} style={cardStyle}>
      {/* Name + rating */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <strong style={{ fontSize: 16, lineHeight: 1.3 }}>{chef.name}</strong>
        <span style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)', whiteSpace: 'nowrap', marginLeft: 8 }}>
          ★ {rating > 0 ? rating.toFixed(1) : '—'}
        </span>
      </div>

      {/* City */}
      {chef.city && (
        <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
          {chef.city}
        </div>
      )}

      {/* Bio preview */}
      {chef.bio && (
        <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.4, color: 'var(--tg-theme-text-color)' }}>
          {chef.bio.length > 90 ? chef.bio.slice(0, 90) + '…' : chef.bio}
        </div>
      )}

      {/* Badges: cuisine tags + format */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {chef.cuisineTags.map((tag: string) => (
          <span key={tag} style={cuisineTagStyle}>{tag}</span>
        ))}
        {chef.workFormats.map((f: string) => (
          <span key={f} style={formatTagStyle}>
            {f === 'home_visit' ? '🏠 На дом' : '🚚 Доставка'}
          </span>
        ))}
      </div>

      {/* Price */}
      {chef.avgPrice && (
        <div style={{ fontSize: 13, marginTop: 8, color: 'var(--tg-theme-hint-color)' }}>
          от {chef.avgPrice} ₾
        </div>
      )}
    </Link>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 14,
  outline: 'none',
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  padding: '14px',
  borderRadius: 14,
  background: 'var(--tg-theme-secondary-bg-color)',
  textDecoration: 'none',
  color: 'var(--tg-theme-text-color)',
}

const cuisineTagStyle: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 20,
  fontSize: 12,
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
}

const formatTagStyle: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 20,
  fontSize: 12,
  background: 'var(--tg-theme-bg-color)',
  color: 'var(--tg-theme-text-color)',
  border: '1px solid var(--tg-theme-hint-color)',
}

const resetBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'transparent',
  color: 'var(--tg-theme-hint-color)',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
