import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getOrder, createInvoice, patchOrderStatus } from '../api/orders'
import type { Order, OrderStatus } from '../types'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goBack = useCallback(() => navigate('/orders'), [navigate])

  useEffect(() => {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(goBack)
    return () => {
      WebApp.BackButton.hide()
      WebApp.BackButton.offClick(goBack)
    }
  }, [goBack])

  const refresh = useCallback(async () => {
    if (!id) return
    const updated = await getOrder(Number(id))
    setOrder(updated)
    return updated
  }, [id])

  useEffect(() => {
    if (!id) return
    getOrder(Number(id))
      .then(setOrder)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  // Stop any running poll on unmount
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  // Poll until order status changes to `targetStatus`, max `maxAttempts` × 1s
  function pollUntilStatus(targetStatus: OrderStatus, maxAttempts = 12) {
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const updated = await getOrder(Number(id))
        setOrder(updated)
        if (updated.status === targetStatus || attempts >= maxAttempts) {
          clearInterval(pollRef.current!)
          pollRef.current = null
        }
      } catch {
        clearInterval(pollRef.current!)
        pollRef.current = null
      }
    }, 1000)
  }

  async function handlePay() {
    setActionLoading(true)
    try {
      const { invoiceUrl } = await createInvoice(Number(id))
      WebApp.openInvoice(invoiceUrl, (status) => {
        if (status === 'paid') {
          // Bot webhook may take a moment to mark the order paid — poll
          pollUntilStatus('paid')
        }
      })
    } catch (e: unknown) {
      WebApp.showAlert(e instanceof Error ? e.message : 'Не удалось создать счёт')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleComplete() {
    setActionLoading(true)
    try {
      const updated = await patchOrderStatus(Number(id), 'completed')
      setOrder(updated)
    } catch (e: unknown) {
      WebApp.showAlert(e instanceof Error ? e.message : 'Не удалось завершить заказ')
    } finally {
      setActionLoading(false)
    }
  }

  function handleDispute() {
    WebApp.showAlert('Форма спора появится в следующей версии. Свяжитесь с поддержкой через /help в боте.')
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>Ошибка: {error}</div>
  if (!order) return null

  const showPayButton = order.status === 'awaiting_payment'
  const showOutcomeButtons = order.status === 'paid' || order.status === 'in_progress'

  return (
    <div style={{ padding: '16px 16px 100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Заказ #{order.id}</h2>
        <StatusBadge status={order.status} />
      </div>

      {/* Chef card */}
      <div style={chefCardStyle}>
        <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)', marginBottom: 3 }}>Повар</div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{order.chefName ?? `#${order.chefId}`}</div>
      </div>

      {/* Order details */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row label='Формат'>
          {order.type === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'}
        </Row>
        <Row label='Дата и время'>
          {new Date(order.scheduledAt).toLocaleString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Row>
        <Row label='Количество человек'>{order.persons}</Row>
        {order.city && <Row label='Город'>{order.city}</Row>}
        {order.address && <Row label='Адрес'>{order.address}</Row>}
        {order.description && <Row label='Комментарий'>{order.description}</Row>}
        {order.agreedPrice && <Row label='Сумма'>{order.agreedPrice} ₾</Row>}
        {order.productsBuyer && (
          <Row label='Продукты покупает'>
            {order.productsBuyer === 'customer' ? 'Клиент' : 'Повар'}
          </Row>
        )}
        {order.productsBudget && <Row label='Бюджет на продукты'>{order.productsBudget} ₾</Row>}
        <Row label='Создан'>{new Date(order.createdAt).toLocaleString('ru-RU')}</Row>
      </div>

      {/* ── Action panel ─────────────────────────────────────── */}
      {(showPayButton || showOutcomeButtons) && (
        <div style={actionPanelStyle}>

          {showPayButton && (
            <>
              {!order.agreedPrice && (
                <p style={hintStyle}>Повар ещё не установил цену. Оплата станет доступна после согласования.</p>
              )}
              <button
                style={primaryBtn}
                disabled={actionLoading || !order.agreedPrice}
                onClick={handlePay}
              >
                {actionLoading ? 'Открываем счёт…' : `Оплатить${order.agreedPrice ? ` ${order.agreedPrice} ₾` : ''}`}
              </button>
            </>
          )}

          {showOutcomeButtons && (
            <>
              {order.status === 'paid' && (
                <p style={hintStyle}>Ожидаем, когда повар начнёт выполнение заказа.</p>
              )}
              <button
                style={primaryBtn}
                disabled={actionLoading || order.status === 'paid'}
                onClick={handleComplete}
                title={order.status === 'paid' ? 'Доступно после начала выполнения' : undefined}
              >
                {actionLoading ? 'Сохраняем…' : 'Всё прошло хорошо'}
              </button>
              <button style={secondaryBtn} disabled={actionLoading} onClick={handleDispute}>
                Есть проблема
              </button>
            </>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--tg-theme-hint-color)22' }}>
      <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15 }}>{children}</div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const chefCardStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  background: 'var(--tg-theme-secondary-bg-color)',
  marginBottom: 20,
}

const actionPanelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '12px 16px max(16px, env(safe-area-inset-bottom))',
  background: 'var(--tg-theme-bg-color)',
  borderTop: '1px solid var(--tg-theme-hint-color)44',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const hintStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 13,
  color: 'var(--tg-theme-hint-color)',
  textAlign: 'center',
}

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: 12,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'transparent',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  cursor: 'pointer',
}

// ─── Exports (used by OrdersPage) ─────────────────────────────────────────────

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:             'Черновик',
  awaiting_payment:  'Ожидает оплаты',
  paid:              'Оплачен',
  in_progress:       'В процессе',
  completed:         'Завершён',
  dispute_pending:   'Спор',
  refunded:          'Возврат',
  cancelled:         'Отменён',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft:             '#888',
  awaiting_payment:  '#e67e00',
  paid:              '#007aff',
  in_progress:       '#34c759',
  completed:         '#34c759',
  dispute_pending:   '#ff3b30',
  refunded:          '#888',
  cancelled:         '#888',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 600,
      background: STATUS_COLORS[status] + '22',
      color: STATUS_COLORS[status],
      border: `1px solid ${STATUS_COLORS[status]}44`,
    }}>
      {STATUS_LABELS[status]}
    </span>
  )
}
