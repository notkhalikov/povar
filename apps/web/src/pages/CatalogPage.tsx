import { useCallback, useEffect, useRef, useState } from 'react'
import { getChefs } from '../api/chefs'
import type { ChefsQuery } from '../api/chefs'
import type { ChefListItem } from '../types'
import { ChefCard } from '../components/ChefCard'
import { ChefCardSkeleton } from '../components/LoadingSkeleton'
import { ErrorScreen } from '../components/ErrorScreen'
import { EmptyState } from '../components/EmptyState'
import { useT } from '../i18n'

const CITIES = ['Тбилиси', 'Батуми']

const RATING_CHIPS = [
  { value: undefined },
  { value: 3,   label: '3★+' },
  { value: 4,   label: '4★+' },
  { value: 4.5, label: '4.5★+' },
] as const

const PAGE_SIZE = 20
const DEFAULT_QUERY: ChefsQuery = { sort: 'rating' }

export default function CatalogPage() {
  const t = useT()
  const [chefs, setChefs]               = useState<ChefListItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [hasMore, setHasMore]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [query, setQuery]               = useState<ChefsQuery>(DEFAULT_QUERY)
  const [cuisineInput, setCuisineInput] = useState('')
  const [offset, setOffset]             = useState(0)

  // Pull-to-refresh
  const [refreshing, setRefreshing]     = useState(false)
  const touchStartY                     = useRef(0)
  const pullDelta                       = useRef(0)
  const scrollRef                       = useRef<HTMLDivElement>(null)

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  // Initial / filter-change load
  function load(q: ChefsQuery) {
    setLoading(true)
    setError(null)
    setOffset(0)
    getChefs({ ...q, limit: PAGE_SIZE, offset: 0 })
      .then(res => {
        setChefs(res.data)
        setHasMore(res.data.length === PAGE_SIZE)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(query) }, [query])

  // Load next page
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    const nextOffset = offset + PAGE_SIZE
    setLoadingMore(true)
    getChefs({ ...query, limit: PAGE_SIZE, offset: nextOffset })
      .then(res => {
        setChefs(prev => [...prev, ...res.data])
        setHasMore(res.data.length === PAGE_SIZE)
        setOffset(nextOffset)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore, offset, query])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  // Pull-to-refresh touch handlers
  function handleTouchStart(e: React.TouchEvent) {
    const el = scrollRef.current
    if (el && el.scrollTop > 0) return
    touchStartY.current = e.touches[0].clientY
    pullDelta.current = 0
  }

  function handleTouchMove(e: React.TouchEvent) {
    const el = scrollRef.current
    if (el && el.scrollTop > 0) return
    pullDelta.current = e.touches[0].clientY - touchStartY.current
  }

  async function handleTouchEnd() {
    if (pullDelta.current >= 80 && !refreshing && !loading) {
      setRefreshing(true)
      try {
        const res = await getChefs({ ...query, limit: PAGE_SIZE, offset: 0 })
        setChefs(res.data)
        setHasMore(res.data.length === PAGE_SIZE)
        setOffset(0)
      } catch { /* ignore */ }
      finally { setRefreshing(false) }
    }
    pullDelta.current = 0
  }

  return (
    <div
      ref={scrollRef}
      style={{ paddingBottom: 'var(--page-padding-bottom)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div style={{
          textAlign: 'center', padding: '8px 0',
          fontSize: 13, color: 'var(--tg-theme-hint-color)',
        }}>
          {t.catalog.refreshing}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 16px 10px' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t.catalog.title}</h2>
      </div>

      {/* Cuisine search */}
      <div style={{ padding: '0 16px 10px' }}>
        <input
          type='text'
          className='field-input'
          placeholder={t.catalog.searchPlaceholder}
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
          {t.catalog.allCities}
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
        {([
          { value: undefined,    label: t.catalog.allFormats },
          { value: 'home_visit', label: t.catalog.homeVisit },
          { value: 'delivery',   label: t.catalog.delivery },
        ] as const).map(f => (
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
            {'label' in r ? r.label : t.catalog.anyRating}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--tg-theme-hint-color)', opacity: .25, flexShrink: 0 }} />
        {([
          { value: 'rating', label: t.catalog.sortByRating },
          { value: 'price',  label: t.catalog.sortByPrice },
        ] as const).map(s => (
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
            {t.catalog.resetFilters}
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && Array.from({ length: 4 }, (_, i) => <ChefCardSkeleton key={i} />)}

        {!loading && error && (
          <ErrorScreen message={error} onRetry={() => load(query)} />
        )}

        {!loading && !error && chefs.length === 0 && (
          <EmptyState
            title={t.catalog.noChefs}
            subtitle={t.catalog.noChefsHint}
            illustration={<div style={{ fontSize: 64 }}>🍽️</div>}
          />
        )}

        {!loading && chefs.map(chef => <ChefCard key={chef.id} chef={chef} />)}

        {/* Infinite scroll sentinel */}
        {!loading && hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

        {loadingMore && (
          <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 2 }, (_, i) => <ChefCardSkeleton key={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}
