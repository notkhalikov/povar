import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../api/orders'
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

        {!loading && shown.map(order => {
          const status = statusMap[order.status]
          const date = new Date(order.scheduledAt).toLocaleString('ru-RU', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })
          const unread = order.unreadCount ?? 0

          return (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              style={{
                backgroundColor: ['completed', 'refunded', 'cancelled'].includes(order.status) ? '#F7F6F3' : '#ffffff',
                border: '1px solid #E8E6E1',
                borderRadius: 16,
                padding: 14,
                cursor: 'pointer',
              }}
            >
              {/* Верхняя строка */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8,
              }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: '0 0 2px' }}>
                    Заказ #{order.id}
                  </p>
                  <p style={{ fontSize: 13, color: '#6B6966', margin: 0 }}>
                    {order.chefName ?? `Повар #${order.chefId}`}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    padding: '3px 9px', borderRadius: 6,
                    backgroundColor: status.bg, color: status.color,
                  }}>
                    {status.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#9E9B97' }}>
                    {date}
                  </span>
                </div>
              </div>

              {/* Нижняя строка */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 8,
                borderTop: '1px solid #E8E6E1',
              }}>
                <p style={{
                  fontSize: 13, color: '#9E9B97', margin: 0,
                  flex: 1, overflow: 'hidden',
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  paddingRight: 8,
                }}>
                  {order.agreedPrice ? `${order.agreedPrice} ₾` : `${order.persons} ${t.common.persons}`}
                </p>

                {/* Бейдж непрочитанных */}
                {unread > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 11L2.5 9H13V2H1V11Z"
                        stroke="#9E9B97" strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                    <div style={{
                      minWidth: 18, height: 18, borderRadius: 9, padding: '0 4px',
                      backgroundColor: '#E24B4A', color: '#ffffff',
                      fontSize: 10, fontWeight: 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {unread >= 10 ? '9+' : unread}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
