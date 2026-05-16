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
  const [cityFilter, setCityFilter]     = useState<string | null>(null)
  const [formatFilter, setFormatFilter] = useState<string | null>(null)
  const [searchOpen, setSearchOpen]     = useState(false)
  const [filtersOpen, setFiltersOpen]   = useState(false)

  const activeFiltersCount = [
    !!cityFilter,
    !!formatFilter,
    !!query.minRating,
  ].filter(Boolean).length

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

  useEffect(() => {
    const formatMap: Record<string, ChefsQuery['format']> = {
      'home': 'home_visit',
      'delivery': 'delivery',
    }
    setQuery(q => ({
      ...q,
      city: cityFilter || undefined,
      format: formatFilter ? formatMap[formatFilter] : undefined,
    }))
  }, [cityFilter, formatFilter])

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
          <button
            onClick={() => setFiltersOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 20,
              border: '1px solid #E8E6E1',
              backgroundColor: activeFiltersCount > 0 ? '#FAECE7' : '#ffffff',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 3h12M3 7h8M5 11h4"
                stroke={activeFiltersCount > 0 ? '#D85A30' : '#6B6966'}
                strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500,
              color: activeFiltersCount > 0 ? '#993C1D' : '#6B6966' }}>
              Фильтры
            </span>
            {activeFiltersCount > 0 && (
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                backgroundColor: '#D85A30', color: '#ffffff',
                fontSize: 11, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Строка поиска */}
        {searchOpen && (
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
            autoFocus
          />
        )}
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

      {/* BOTTOM SHEET ФИЛЬТРЫ */}
      {filtersOpen && (
        <>
          <div onClick={() => setFiltersOpen(false)} style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 200,
          }}/>
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: '#ffffff',
            borderRadius: '20px 20px 0 0',
            padding: '20px 16px 40px', zIndex: 201,
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2,
              backgroundColor: '#D0CEC9', margin: '0 auto 20px' }}/>
            <h3 style={{ fontSize: 17, fontWeight: 500, color: '#1A1917', margin: '0 0 20px' }}>
              Фильтры
            </h3>

            <p style={{ fontSize: 11, color: '#9E9B97', margin: '0 0 8px',
              fontWeight: 500, letterSpacing: '0.06em' }}>ГОРОД</p>
            <div style={{ display: 'flex', backgroundColor: '#F0EEE9',
              borderRadius: 10, padding: 3, border: '1px solid #E8E6E1', marginBottom: 20 }}>
              {[{l:'Все',v:null},{l:'Тбилиси',v:'Tbilisi'},{l:'Батуми',v:'Batumi'}]
                .map(o => {
                  const on = cityFilter === o.v;
                  return <button key={String(o.v)} onClick={() => setCityFilter(o.v)}
                    style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none',
                      fontSize:13, fontWeight: on?500:400, cursor:'pointer',
                      backgroundColor: on?'#D85A30':'transparent',
                      color: on?'#ffffff':'#6B6966' }}>{o.l}</button>;
                })}
            </div>

            <p style={{ fontSize: 11, color: '#9E9B97', margin: '0 0 8px',
              fontWeight: 500, letterSpacing: '0.06em' }}>ФОРМАТ</p>
            <div style={{ display:'flex', gap:6, marginBottom:20 }}>
              {[{l:'Все',v:null},{l:'На дом',v:'home'},{l:'Доставка',v:'delivery'}]
                .map(o => {
                  const on = formatFilter === o.v;
                  return <button key={String(o.v)} onClick={() => setFormatFilter(o.v)}
                    style={{ padding:'7px 16px', borderRadius:20,
                      border:`1.5px solid ${on?'#D85A30':'#E8E6E1'}`,
                      backgroundColor: on?'#D85A30':'#ffffff',
                      color: on?'#ffffff':'#6B6966',
                      fontSize:13, fontWeight: on?500:400, cursor:'pointer',
                      flex: 1, textAlign: 'center' }}>{o.l}</button>;
                })}
            </div>

            <p style={{ fontSize: 11, color: '#9E9B97', margin: '0 0 8px',
              fontWeight: 500, letterSpacing: '0.06em' }}>РЕЙТИНГ</p>
            <div style={{ display:'flex', gap:6, marginBottom:28 }}>
              {[{l:'Любой',v:undefined},{l:'3★+',v:3},{l:'4★+',v:4},{l:'4.5★+',v:4.5}]
                .map(o => {
                  const on = query.minRating === o.v;
                  return <button key={String(o.v)} onClick={() => setQuery(q => ({ ...q, minRating: o.v }))}
                    style={{ flex:1, padding:'7px 0', borderRadius:20,
                      border:`1.5px solid ${on?'#D85A30':'#E8E6E1'}`,
                      backgroundColor: on?'#D85A30':'#ffffff',
                      color: on?'#ffffff':'#6B6966',
                      fontSize:13, fontWeight: on?500:400, cursor:'pointer' }}>{o.l}</button>;
                })}
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setCityFilter(null); setFormatFilter(null); setQuery(q => ({ ...q, minRating: undefined })); }}
                style={{ flex:1, padding:13, borderRadius:12,
                  border:'1px solid #E8E6E1', backgroundColor:'#ffffff',
                  color:'#6B6966', fontSize:15, fontWeight:500, cursor:'pointer' }}>
                Сбросить
              </button>
              <button onClick={() => setFiltersOpen(false)}
                style={{ flex:2, padding:13, borderRadius:12,
                  border:'none', backgroundColor:'#D85A30',
                  color:'#ffffff', fontSize:15, fontWeight:500, cursor:'pointer' }}>
                Показать поваров
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
