import { useEffect, useState } from 'react'
import { getStats, exportUrl, type AdminStats, type StatsFilter } from '../api'

// ─── Preset periods ───────────────────────────────────────────────────────────

type Preset = '7d' | '30d' | '90d' | 'custom'

function presetToDates(preset: Preset): { from: string; to: string } {
  const to  = new Date()
  const from = new Date()
  if (preset === '7d')  from.setDate(to.getDate() - 7)
  if (preset === '30d') from.setDate(to.getDate() - 30)
  if (preset === '90d') from.setDate(to.getDate() - 90)
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  // Filters
  const [preset, setPreset]       = useState<Preset>('30d')
  const [from, setFrom]           = useState(() => presetToDates('30d').from)
  const [to, setTo]               = useState(() => presetToDates('30d').to)
  const [city, setCity]           = useState('')
  const [utmSource, setUtmSource] = useState('')

  function applyPreset(p: Preset) {
    setPreset(p)
    if (p !== 'custom') {
      const { from: f, to: t } = presetToDates(p)
      setFrom(f)
      setTo(t)
    }
  }

  function load() {
    setLoading(true)
    const filter: StatsFilter = { from, to }
    if (city)      filter.city      = city
    if (utmSource) filter.utmSource = utmSource
    getStats(filter)
      .then(s => { setStats(s); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [from, to, city, utmSource])

  if (error && !stats) return <div className='error-msg'>{error}</div>

  const cards = stats ? [
    { label: 'Всего заказов',       value: stats.totalOrders },
    { label: 'Выручка',             value: `${stats.totalRevenue.toLocaleString('ru-RU')} ₾` },
    { label: 'Выезд на дом',        value: stats.ordersByType.home_visit, sub: 'заказов' },
    { label: 'Доставка',            value: stats.ordersByType.delivery,   sub: 'заказов' },
    { label: 'Споров всего',        value: stats.totalDisputes },
    { label: 'Открытых споров',     value: stats.openDisputes },
    { label: 'Одобренных поваров',  value: stats.approvedChefs },
    { label: 'Пользователей',       value: stats.totalUsers },
  ] : []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Статистика</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={exportUrl('orders')} download className='btn-export'>⬇ Заказы CSV</a>
          <a href={exportUrl('users')}  download className='btn-export'>⬇ Пользователи CSV</a>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className='filters' style={{ marginBottom: 24 }}>
        {(['7d', '30d', '90d', 'custom'] as Preset[]).map(p => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={preset === p ? 'btn-primary' : ''}
          >
            {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : p === '90d' ? '90 дней' : 'Свой период'}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type='date' value={from} onChange={e => setFrom(e.target.value)} />
            <span>—</span>
            <input type='date' value={to}   onChange={e => setTo(e.target.value)} />
          </>
        )}
        <input
          placeholder='Город'
          value={city}
          onChange={e => setCity(e.target.value)}
          style={{ width: 110 }}
        />
        <input
          placeholder='UTM source'
          value={utmSource}
          onChange={e => setUtmSource(e.target.value)}
          style={{ width: 130 }}
        />
        <button onClick={load}>Применить</button>
      </div>

      {loading && <div className='loading'>Загрузка…</div>}
      {error   && <div className='error-msg'>{error}</div>}

      {stats && (
        <>
          {/* ── KPI cards ── */}
          <div className='stats-grid' style={{ marginBottom: 32 }}>
            {cards.map(c => (
              <div key={c.label} className='stat-card'>
                <div className='stat-value'>{c.value}</div>
                <div className='stat-label'>{c.label}</div>
                {c.sub && <div className='stat-sub'>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Funnel ── */}
          <section style={{ marginBottom: 32 }}>
            <h3>Воронка</h3>
            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
              {[
                { label: 'Зарегистрировалось', n: stats.funnel.registered },
                { label: 'Создали заказ',       n: stats.funnel.createdOrder },
                { label: 'Оплатили заказ',       n: stats.funnel.paidOrder },
              ].map((step, i, arr) => {
                const pct = i === 0 ? 100 : arr[0].n ? Math.round(step.n / arr[0].n * 100) : 0
                return (
                  <div key={step.label} style={{ flex: '1 1 160px', padding: '16px 20px', background: '#fff', borderRadius: 10, margin: '0 4px 8px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 700 }}>{step.n}</div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{step.label}</div>
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{pct}%</div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Orders by city ── */}
          {stats.ordersByCity.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h3>По городам</h3>
              <div className='table-wrap'>
                <table>
                  <thead>
                    <tr>
                      <th>Город</th>
                      <th>Заказов</th>
                      <th>Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.ordersByCity.map(r => (
                      <tr key={r.city}>
                        <td>{r.city}</td>
                        <td>{r.count}</td>
                        <td>{r.revenue.toLocaleString('ru-RU')} ₾</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Orders by UTM ── */}
          {stats.ordersByUtm.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h3>По UTM источникам</h3>
              <div className='table-wrap'>
                <table>
                  <thead>
                    <tr>
                      <th>UTM Source</th>
                      <th>Заказов</th>
                      <th>Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.ordersByUtm.map(r => (
                      <tr key={r.utmSource}>
                        <td>{r.utmSource}</td>
                        <td>{r.count}</td>
                        <td>{r.revenue.toLocaleString('ru-RU')} ₾</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
