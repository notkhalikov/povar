import { useEffect, useState } from 'react'
import { getChefs } from '../api/chefs'
import type { ChefsQuery } from '../api/chefs'
import type { ChefListItem } from '../types'
import { ChefCard } from '../components/ChefCard'
import { ChefCardSkeleton } from '../components/LoadingSkeleton'
import { ErrorScreen } from '../components/ErrorScreen'
import { EmptyState } from '../components/EmptyState'

const CITIES = ['Тбилиси', 'Батуми']

const FORMAT_CHIPS = [
  { value: undefined,    label: 'Все форматы' },
  { value: 'home_visit', label: '🏠 На дом' },
  { value: 'delivery',   label: '🚚 Доставка' },
] as const

const RATING_CHIPS = [
  { value: undefined, label: 'Любой' },
  { value: 3,         label: '3★+' },
  { value: 4,         label: '4★+' },
  { value: 4.5,       label: '4.5★+' },
] as const

const SORT_CHIPS = [
  { value: 'rating', label: 'По рейтингу' },
  { value: 'price',  label: 'По цене' },
] as const

const DEFAULT_QUERY: ChefsQuery = { sort: 'rating' }

export default function CatalogPage() {
  const [chefs, setChefs]               = useState<ChefListItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [query, setQuery]               = useState<ChefsQuery>(DEFAULT_QUERY)
  const [cuisineInput, setCuisineInput] = useState('')

  const hasActiveFilters = Boolean(query.city || query.format || query.cuisine || query.minRating)

  function resetFilters() {
    setQuery(DEFAULT_QUERY)
    setCuisineInput('')
  }

  useEffect(() => {
    const t = setTimeout(
      () => setQuery(q => ({ ...q, cuisine: cuisineInput.trim() || undefined })),
      400,
    )
    return () => clearTimeout(t)
  }, [cuisineInput])

  function load() {
    setLoading(true)
    setError(null)
    getChefs(query)
      .then(res => setChefs(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [query])

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 10px' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Повара</h2>
      </div>

      {/* Cuisine search */}
      <div style={{ padding: '0 16px 10px' }}>
        <input
          type='text'
          className='field-input'
          placeholder='🔍 Кухня (грузинская, европейская…)'
          value={cuisineInput}
          onChange={e => setCuisineInput(e.target.value)}
          style={{ fontSize: 14 }}
        />
      </div>

      {/* City chips */}
      <div className='chips-row' style={{ padding: '0 16px' }}>
        <button
          className={`chip${!query.city ? ' active' : ''}`}
          onClick={() => setQuery(q => ({ ...q, city: undefined }))}
        >
          Все города
        </button>
        {CITIES.map(c => (
          <button
            key={c}
            className={`chip${query.city === c ? ' active' : ''}`}
            onClick={() => setQuery(q => ({ ...q, city: c }))}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Format chips */}
      <div className='chips-row' style={{ padding: '4px 16px 0' }}>
        {FORMAT_CHIPS.map(f => (
          <button
            key={String(f.value)}
            className={`chip${query.format === f.value ? ' active' : ''}`}
            onClick={() => setQuery(q => ({ ...q, format: f.value as ChefsQuery['format'] }))}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Rating + sort + reset */}
      <div className='chips-row' style={{ padding: '4px 16px 8px' }}>
        {RATING_CHIPS.map(r => (
          <button
            key={String(r.value)}
            className={`chip${query.minRating === r.value ? ' active' : ''}`}
            onClick={() => setQuery(q => ({ ...q, minRating: r.value }))}
          >
            {r.label}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--tg-theme-hint-color)', opacity: .25, flexShrink: 0 }} />
        {SORT_CHIPS.map(s => (
          <button
            key={s.value}
            className={`chip${(query.sort ?? 'rating') === s.value ? ' active' : ''}`}
            onClick={() => setQuery(q => ({ ...q, sort: s.value }))}
          >
            {s.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            className='chip'
            onClick={resetFilters}
            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          >
            ✕ Сбросить
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && Array.from({ length: 4 }, (_, i) => <ChefCardSkeleton key={i} />)}

        {!loading && error && (
          <ErrorScreen message={error} onRetry={load} />
        )}

        {!loading && !error && chefs.length === 0 && (
          <EmptyState
            title='Поваров не найдено'
            subtitle='Поваров по вашему запросу не найдено. Попробуйте изменить фильтры'
            illustration={<div style={{ fontSize: 64 }}>🍽️</div>}
          />
        )}

        {!loading && chefs.map(chef => <ChefCard key={chef.id} chef={chef} />)}
      </div>
    </div>
  )
}
