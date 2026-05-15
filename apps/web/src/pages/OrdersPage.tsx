import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../api/orders'
import { StatusBadge } from '../components/StatusBadge'
import { OrderCardSkeleton } from '../components/LoadingSkeleton'
import { ErrorScreen } from '../components/ErrorScreen'
import { EmptyState } from '../components/EmptyState'
import type { Order, OrderStatus } from '../types'
import { useT } from '../i18n'

const ACTIVE_STATUSES: OrderStatus[] = ['draft', 'awaiting_payment', 'paid', 'in_progress', 'dispute_pending']
const DONE_STATUSES:   OrderStatus[] = ['completed', 'refunded', 'cancelled']

export default function OrdersPage() {
  const t = useT()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<'active' | 'done'>('active')

  function load(silent = false) {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    getOrders()
      .then(res => setOrders(res.data))
      .catch(e => { if (!silent) setError(e.message) })
      .finally(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const timer = setInterval(() => load(true), 30_000)
    return () => clearInterval(timer)
  }, [])

  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const done   = orders.filter(o => DONE_STATUSES.includes(o.status))
  const shown  = tab === 'active' ? active : done

  return (
    <div style={{ paddingBottom: 'var(--page-padding-bottom)' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700 }}>{t.order.myOrders}</h2>

        {/* Tabs */}
        <div className='tabs'>
          <button
            className={`tab${tab === 'active' ? ' active' : ''}`}
            onClick={() => setTab('active')}
          >
            {t.order.active} {active.length > 0 && !loading && (
              <span style={{
                marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11,
                background: 'var(--accent)', color: '#ffffff',
                fontWeight: 700,
              }}>
                {active.length}
              </span>
            )}
          </button>
          <button
            className={`tab${tab === 'done' ? ' active' : ''}`}
            onClick={() => setTab('done')}
          >
            {t.order.done}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && Array.from({ length: 3 }, (_, i) => <OrderCardSkeleton key={i} />)}

        {!loading && error && (
          <ErrorScreen message={error} onRetry={load} />
        )}

        {!loading && !error && shown.length === 0 && (
          tab === 'active' ? (
            <EmptyState
              title={t.order.noneActive}
              subtitle={t.order.noneActiveHint}
              illustration={<div style={{ fontSize: 64 }}>📋</div>}
            />
          ) : (
            <EmptyState
              title={t.order.noneDone}
              illustration={<div style={{ fontSize: 64 }}>✅</div>}
            />
          )
        )}

        {!loading && shown.map(order => (
          <OrderCard key={order.id} order={order} onClick={() => navigate(`/orders/${order.id}`)} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const t = useT()
  const date = new Date(order.scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const unread = order.unreadCount ?? 0

  return (
    <div onClick={onClick} className='card' style={{ cursor: 'pointer', position: 'relative' }}>
      {unread > 0 && (
        <div style={{
          position: 'absolute',
          top: -6,
          left: -6,
          backgroundColor: 'var(--accent)',
          color: '#fff',
          borderRadius: '50%',
          minWidth: 18,
          height: 18,
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          fontWeight: 700,
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}>
          {unread >= 10 ? '9+' : unread}
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {order.chefName ?? `Повар #${order.chefId}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {t.order.orderNum} #{order.id}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
        <span>📅 {date}</span>
        <span>👥 {order.persons} {t.common.persons}</span>
        <span>{order.type === 'home_visit' ? t.order.homeVisit : t.order.delivery}</span>
      </div>

      {/* Price */}
      {order.agreedPrice && (
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 18 }}>
          {order.agreedPrice} ₾
        </div>
      )}
    </div>
  )
}
