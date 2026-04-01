import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../api/orders'
import { StatusBadge } from '../components/StatusBadge'
import { OrderCardSkeleton } from '../components/LoadingSkeleton'
import type { Order, OrderStatus } from '../types'

const ACTIVE_STATUSES: OrderStatus[] = ['draft', 'awaiting_payment', 'paid', 'in_progress', 'dispute_pending']
const DONE_STATUSES:   OrderStatus[] = ['completed', 'refunded', 'cancelled']

export default function OrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<'active' | 'done'>('active')

  useEffect(() => {
    getOrders()
      .then(res => setOrders(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status))
  const done   = orders.filter(o => DONE_STATUSES.includes(o.status))
  const shown  = tab === 'active' ? active : done

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700 }}>Мои заказы</h2>

        {/* Tabs */}
        <div className='tabs'>
          <button
            className={`tab${tab === 'active' ? ' active' : ''}`}
            onClick={() => setTab('active')}
          >
            Активные {active.length > 0 && !loading && (
              <span style={{
                marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11,
                background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)',
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
            Завершённые
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && Array.from({ length: 3 }, (_, i) => <OrderCardSkeleton key={i} />)}

        {!loading && error && (
          <div style={{ color: 'var(--color-danger)', fontSize: 14, padding: '8px 0' }}>Ошибка: {error}</div>
        )}

        {!loading && !error && shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{tab === 'active' ? '📋' : '✅'}</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {tab === 'active' ? 'Активных заказов нет' : 'Завершённых заказов нет'}
            </div>
            {tab === 'active' && (
              <p style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14, margin: 0 }}>
                Перейдите в каталог, чтобы найти повара
              </p>
            )}
          </div>
        )}

        {!loading && shown.map(order => (
          <OrderCard key={order.id} order={order} onClick={() => navigate(`/orders/${order.id}`)} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const date = new Date(order.scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div onClick={onClick} className='card' style={{ cursor: 'pointer' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {order.chefName ?? `Повар #${order.chefId}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
            Заказ #{order.id}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--tg-theme-hint-color)', flexWrap: 'wrap' }}>
        <span>📅 {date}</span>
        <span>👥 {order.persons} чел.</span>
        <span>{order.type === 'home_visit' ? '🏠 На дом' : '🚚 Доставка'}</span>
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
