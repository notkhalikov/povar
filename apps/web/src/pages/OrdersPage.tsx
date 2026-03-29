import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../api/orders'
import { StatusBadge } from './OrderDetailPage'
import type { Order } from '../types'

export default function OrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOrders()
      .then(res => setOrders(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  }

  if (error) {
    return <div style={{ padding: 24, color: 'red' }}>Ошибка: {error}</div>
  }

  if (orders.length === 0) {
    return (
      <div style={{ padding: '48px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <h3 style={{ margin: '0 0 8px' }}>Заказов пока нет</h3>
        <p style={{ color: 'var(--tg-theme-hint-color)', margin: 0, fontSize: 14 }}>
          Перейдите в каталог, чтобы найти повара
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px 80px' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Мои заказы</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map(order => (
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
    <div onClick={onClick} style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {order.chefName ?? `Повар #${order.chefId}`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
            Заказ #{order.id}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
        <span>📅 {date}</span>
        <span>👥 {order.persons} чел.</span>
        {order.agreedPrice && <span>💰 {order.agreedPrice} ₾</span>}
      </div>

      <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 4 }}>
        {order.type === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'} · {order.city}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  background: 'var(--tg-theme-secondary-bg-color)',
  cursor: 'pointer',
  border: '1px solid transparent',
}

