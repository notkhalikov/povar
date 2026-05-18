import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../api/orders'
import { OrderCardSkeleton } from '../components/LoadingSkeleton'
import { ErrorScreen } from '../components/ErrorScreen'
import { EmptyState } from '../components/EmptyState'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../components/AuthProvider'
import type { Order, OrderStatus } from '../types'
import { useT } from '../i18n'

const ACTIVE_STATUSES: OrderStatus[] = ['draft', 'awaiting_payment', 'paid', 'in_progress', 'dispute_pending']
const DONE_STATUSES:   OrderStatus[] = ['completed', 'refunded', 'cancelled']

export default function OrdersPage() {
  const t = useT()
  const navigate = useNavigate()
  const { user } = useAuth()
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

  const statusMap: Record<OrderStatus, { bg: string; color: string; label: string }> = {
    draft:           { bg: '#FAEEDA', color: '#854F0B', label: 'Черновик' },
    awaiting_payment:{ bg: '#FAEEDA', color: '#854F0B', label: 'Ожидание оплаты' },
    paid:            { bg: '#B5D4F4', color: '#185FA5', label: 'Оплачен' },
    in_progress:     { bg: '#B5D4F4', color: '#185FA5', label: 'В работе' },
    dispute_pending: { bg: '#FFA500', color: '#ffffff', label: 'Спор' },
    completed:       { bg: '#C0DD97', color: '#3B6D11', label: 'Завершён' },
    refunded:        { bg: '#F7C1C1', color: '#A32D2D', label: 'Возврат' },
    cancelled:       { bg: '#F7C1C1', color: '#A32D2D', label: 'Отменён' },
  }

  return (
    <div style={{ backgroundColor: '#F7F6F3', minHeight: '100%' }}>

      {/* ШАПКА */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
        padding: '14px 16px',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1A1917', margin: 0 }}>
          {t.order.myOrders}
        </h1>
      </div>

      {/* ТАБЫ */}
      <div style={{
        display: 'flex',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
      }}>
        {[
          { key: 'active' as const, label: t.order.active, count: active.length },
          { key: 'done' as const, label: t.order.done, count: done.length },
        ].map(t_item => {
          const isActive = tab === t_item.key
          return (
            <button
              key={t_item.key}
              onClick={() => setTab(t_item.key)}
              style={{
                flex: 1, padding: '12px 0',
                background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid #D85A30' : '2px solid transparent',
                color: isActive ? '#D85A30' : '#6B6966',
                fontSize: 14, fontWeight: isActive ? 500 : 400,
                cursor: 'pointer',
              }}
            >
              {t_item.label} {t_item.count > 0 && !loading && (
                <span style={{
                  marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11,
                  background: isActive ? '#D85A30' : '#E8E6E1',
                  color: isActive ? '#ffffff' : '#6B6966',
                  fontWeight: 700,
                }}>
                  {t_item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* СПИСОК ЗАКАЗОВ */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && Array.from({ length: 3 }, (_, i) => <OrderCardSkeleton key={i} />)}

        {!loading && error && (
          <ErrorScreen message={error} onRetry={() => load()} />
        )}

        {!loading && !error && shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#aaa' }}>
            <p style={{ fontSize: 40, margin: 0 }}>
              {tab === 'active' ? '📭' : '✅'}
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#666', margin: '12px 0 6px' }}>
              {tab === 'active' ? t.order.noneActive : t.order.noneDone}
            </p>
            {tab === 'active' && (
              <p style={{ fontSize: 14, color: '#999' }}>
                {user?.role === 'chef' ? 'Новые заказы появятся здесь' : 'Найдите повара в каталоге'}
              </p>
            )}
          </div>
        )}

        {!loading && shown.map(order => {
          const status = statusMap[order.status]
          const dateStr = new Date(order.scheduledAt).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short',
          })
          const otherParty = user?.id === order.chefId
            ? { name: order.customerName, avatarUrl: order.customerAvatarUrl }
            : { name: order.chefName, avatarUrl: order.chefAvatarUrl }

          return (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              style={{
                padding: '16px', backgroundColor: '#fff', borderRadius: 16,
                marginBottom: 12, border: '1.5px solid #f0f0f0', cursor: 'pointer',
              }}
            >
              {/* Header with avatar and status */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Avatar src={otherParty.avatarUrl} name={otherParty.name ?? '?'} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1A1917' }}>
                      {otherParty.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                      {dateStr}
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 8,
                  backgroundColor: status.bg, color: status.color, flexShrink: 0, marginLeft: 8,
                }}>
                  {status.label}
                </span>
              </div>

              {/* Description if available */}
              {order.description && (
                <p style={{
                  margin: 0, fontSize: 14, color: '#555',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: 8,
                }}>
                  {order.description}
                </p>
              )}

              {/* Price and persons */}
              {order.agreedPrice && (
                <p style={{
                  margin: 0, fontSize: 13, color: '#D85A30', fontWeight: 600,
                }}>
                  {order.agreedPrice} ₾ · {order.persons} гостей
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
