import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChefs } from '../api/chefs'
import type { ChefsQuery } from '../api/chefs'
import type { ChefListItem } from '../types'
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
  const navigate = useNavigate()
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

  return (
    <div
      ref={scrollRef}
      style={{ backgroundColor: '#F7F6F3', minHeight: '100dvh', paddingBottom: 64 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div style={{
          textAlign: 'center', padding: '8px 0',
          fontSize: 13, color: '#6B6966',
        }}>
          {t.catalog.refreshing}
        </div>
      )}

      {/* ШАПКА */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1A1917', margin: 0 }}>
              {t.catalog.title}
            </h1>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '1px solid #E8E6E1', backgroundColor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="#6B6966" strokeWidth="1.3"/>
              <line x1="10" y1="10" x2="14" y2="14" stroke="#6B6966"
                strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Строка поиска */}
        <input
          type='text'
          placeholder={t.catalog.searchPlaceholder}
          value={cuisineInput}
          onChange={e => setCuisineInput(e.target.value)}
          style={{
            width: '100%', marginTop: 10, padding: '9px 14px',
            borderRadius: 12, border: '1px solid #E8E6E1',
            fontSize: 14, color: '#1A1917', backgroundColor: '#F7F6F3',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* ФИЛЬТРЫ */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
        padding: '10px 14px',
      }}>

        {/* Сегментированный контрол — город */}
        <div style={{
          display: 'flex',
          backgroundColor: '#F7F6F3',
          borderRadius: 10,
          padding: 3,
          marginBottom: 10,
        }}>
          {([
            { label: 'Все города', value: undefined },
            { label: 'Тбилиси',    value: 'Тбилиси' },
            { label: 'Батуми',     value: 'Батуми' },
          ] as const).map(opt => {
            const active = query.city === opt.value;
            return (
              <button
                key={String(opt.value)}
                onClick={() => setQuery(q => ({ ...q, city: opt.value }))}
                style={{
                  flex: 1, padding: '7px 4px',
                  borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  cursor: 'pointer',
                  backgroundColor: active ? '#D85A30' : 'transparent',
                  color: active ? '#ffffff' : '#6B6966',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Чипы — формат */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { label: 'Все форматы', value: undefined },
            { label: 'На дом',      value: 'home_visit' },
            { label: 'Доставка',    value: 'delivery' },
          ] as const).map(opt => {
            const active = query.format === opt.value;
            return (
              <button
                key={String(opt.value)}
                onClick={() => setQuery(q => ({ ...q, format: opt.value as ChefsQuery['format'] }))}
                style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: `1px solid ${active ? '#D85A30' : '#E8E6E1'}`,
                  backgroundColor: active ? '#D85A30' : '#ffffff',
                  color: active ? '#ffffff' : '#6B6966',
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* СПИСОК ПОВАРОВ */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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

        {!loading && chefs.map(chef => (
          <div
            key={chef.id}
            onClick={() => navigate(`/chefs/${chef.id}`)}
            style={{
              backgroundColor: !chef.isOnVacation ? '#ffffff' : '#F7F6F3',
              border: '1px solid #E8E6E1',
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              gap: 12,
              cursor: 'pointer',
              opacity: !chef.isOnVacation ? 1 : 0.75,
            }}
          >
            {/* Аватар */}
            <div style={{
              width: 54, height: 54, borderRadius: 12, flexShrink: 0,
              backgroundColor: avatarColor(chef.name),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 500, color: '#ffffff',
            }}>
              {initials(chef.name)}
            </div>

            {/* Инфо */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1917' }}>
                  {chef.name}
                </span>
                {Number(chef.ratingCache) > 0 && (
                  <span style={{ fontSize: 13, color: '#BA7517', fontWeight: 500, flexShrink: 0 }}>
                    ★ {Number(chef.ratingCache).toFixed(1)}
                  </span>
                )}
              </div>

              <p style={{ fontSize: 13, color: '#6B6966', margin: '0 0 8px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {chef.cuisineTags.slice(0, 3).join(', ')}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#9E9B97' }}>
                  {chef.avgPrice ? `от ${chef.avgPrice} ₾` : ''} {chef.avgPrice && chef.ordersCount ? '·' : ''} {chef.ordersCount ?? 0} заказов
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6,
                  backgroundColor: !chef.isOnVacation ? '#FAECE7' : '#D3D1C7',
                  color: !chef.isOnVacation ? '#993C1D' : '#5F5E5A',
                }}>
                  {!chef.isOnVacation ? 'Свободен' : 'В отпуске'}
                </span>
              </div>
            </div>
          </div>
        ))}

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
