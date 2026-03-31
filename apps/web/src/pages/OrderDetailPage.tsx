import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getOrder, createInvoice, completeOrder } from '../api/orders'
import { createReview } from '../api/reviews'
import { createDispute, getDisputeByOrder } from '../api/disputes'
import { useAuth } from '../context/AuthContext'
import type { Order, OrderStatus } from '../types'

type ReviewStep = 'none' | 'form' | 'done'

const QUALITY_TAGS = ['вкус', 'порции', 'подача', 'пунктуальность', 'коммуникация']

const CUSTOMER_REASONS = [
  { code: 'chef_no_show',   label: 'Повар не пришёл' },
  { code: 'late_delivery',  label: 'Сильное опоздание' },
  { code: 'wrong_menu',     label: 'Приготовлено не то блюдо' },
  { code: 'bad_quality',    label: 'Плохое качество еды' },
  { code: 'other',          label: 'Другое' },
]

const CHEF_REASONS = [
  { code: 'customer_no_show',  label: 'Заказчик не открыл дверь' },
  { code: 'wrong_address',     label: 'Неверный адрес' },
  { code: 'false_complaint',   label: 'Ложная жалоба' },
  { code: 'other',             label: 'Другое' },
]

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: apiUser } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Review form state
  const [reviewStep, setReviewStep] = useState<ReviewStep>('none')
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewTags, setReviewTags] = useState<string[]>([])
  const [reviewText, setReviewText] = useState('')

  // Dispute form state
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeDesc, setDisputeDesc] = useState('')
  const [disputeId, setDisputeId] = useState<number | null>(null)

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
      const updated = await completeOrder(Number(id))
      setOrder(updated)
      setReviewStep('form')
    } catch (e: unknown) {
      WebApp.showAlert(e instanceof Error ? e.message : 'Не удалось завершить заказ')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSubmitReview() {
    if (reviewRating === 0) {
      WebApp.showAlert('Пожалуйста, выберите оценку')
      return
    }
    setActionLoading(true)
    try {
      await createReview({
        orderId: Number(id),
        rating: reviewRating,
        tagsQuality: reviewTags,
        text: reviewText || undefined,
      })
      setReviewStep('done')
    } catch (e: unknown) {
      WebApp.showAlert(e instanceof Error ? e.message : 'Не удалось отправить отзыв')
    } finally {
      setActionLoading(false)
    }
  }

  function toggleTag(tag: string) {
    setReviewTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    )
  }

  function handleDispute() {
    setDisputeReason('')
    setDisputeDesc('')
    setShowDisputeModal(true)
  }

  async function handleSubmitDispute() {
    if (!disputeReason) {
      WebApp.showAlert('Пожалуйста, выберите причину спора')
      return
    }
    if (!disputeDesc.trim()) {
      WebApp.showAlert('Пожалуйста, опишите проблему')
      return
    }
    setActionLoading(true)
    try {
      const dispute = await createDispute({
        orderId: Number(id),
        reasonCode: disputeReason,
        description: disputeDesc.trim(),
      })
      setDisputeId(dispute.id)
      setShowDisputeModal(false)
      // Refresh order to reflect dispute_pending status
      const updated = await getOrder(Number(id))
      setOrder(updated)
    } catch (e: unknown) {
      WebApp.showAlert(e instanceof Error ? e.message : 'Не удалось открыть спор')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleGoToDispute() {
    if (disputeId) {
      navigate(`/disputes/${disputeId}`)
      return
    }
    // Dispute was opened in a previous session — fetch by orderId
    try {
      const d = await getDisputeByOrder(Number(id))
      navigate(`/disputes/${d.id}`)
    } catch {
      WebApp.showAlert('Спор не найден')
    }
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>Ошибка: {error}</div>
  if (!order) return null

  const scheduledPassed = new Date(order.scheduledAt) < new Date()
  const showPayButton = order.status === 'awaiting_payment'
  const showOutcomeButtons =
    reviewStep === 'none' &&
    ((order.status === 'paid' && scheduledPassed) || order.status === 'in_progress')
  const isCustomer = apiUser?.id === order.customerId
  const disputeReasons = isCustomer ? CUSTOMER_REASONS : CHEF_REASONS

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

      {/* ── Inline review form ───────────────────────────────── */}
      {reviewStep === 'form' && (
        <div style={{ marginTop: 24, paddingBottom: 16 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Оставьте отзыв</h3>

          {/* Star rating */}
          <div style={{ marginBottom: 20 }}>
            <div style={fieldLabelStyle}>Оценка</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setReviewRating(n)}
                  style={{
                    fontSize: 32,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: n <= reviewRating ? 1 : 0.3,
                    padding: 0,
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Quality tags */}
          <div style={{ marginBottom: 20 }}>
            <div style={fieldLabelStyle}>Что понравилось</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {QUALITY_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: '1px solid var(--tg-theme-hint-color)',
                    cursor: 'pointer',
                    fontSize: 13,
                    background: reviewTags.includes(tag)
                      ? 'var(--tg-theme-button-color)'
                      : 'transparent',
                    color: reviewTags.includes(tag)
                      ? 'var(--tg-theme-button-text-color)'
                      : 'var(--tg-theme-text-color)',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div style={{ marginBottom: 20 }}>
            <div style={fieldLabelStyle}>Комментарий (необязательно)</div>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder='Расскажите подробнее…'
              maxLength={2000}
              rows={3}
              style={textareaStyle}
            />
          </div>

          <button
            style={{ ...primaryBtn, opacity: actionLoading ? 0.6 : 1 }}
            disabled={actionLoading}
            onClick={handleSubmitReview}
          >
            {actionLoading ? 'Отправка…' : 'Отправить отзыв'}
          </button>
        </div>
      )}

      {reviewStep === 'done' && (
        <div style={successStyle}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Спасибо за отзыв!</div>
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)', marginTop: 4 }}>
            Ваша оценка поможет другим заказчикам
          </div>
        </div>
      )}

      {/* ── Dispute opened status ────────────────────────────── */}
      {order.status === 'dispute_pending' && (
        <div style={disputeStatusStyle}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Спор открыт</div>
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)', marginBottom: 16 }}>
            Ожидается рассмотрение службой поддержки
          </div>
          <button style={secondaryBtn} onClick={handleGoToDispute}>
            Открыть детали спора
          </button>
        </div>
      )}

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
              <button
                style={primaryBtn}
                disabled={actionLoading}
                onClick={handleComplete}
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

      {/* ── Dispute modal ────────────────────────────────────── */}
      {showDisputeModal && (
        <div style={modalOverlayStyle} onClick={() => setShowDisputeModal(false)}>
          <div style={modalCardStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>Открыть спор</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
              Спор будет рассмотрен службой поддержки в течение 24–48 часов
            </p>

            {/* Reason selector */}
            <div style={{ marginBottom: 20 }}>
              <div style={fieldLabelStyle}>Причина</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {disputeReasons.map(r => (
                  <label key={r.code} style={reasonOptionStyle}>
                    <input
                      type='radio'
                      name='dispute-reason'
                      value={r.code}
                      checked={disputeReason === r.code}
                      onChange={() => setDisputeReason(r.code)}
                      style={{ marginRight: 10, accentColor: 'var(--tg-theme-button-color)' }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <div style={fieldLabelStyle}>Опишите проблему</div>
              <textarea
                value={disputeDesc}
                onChange={e => setDisputeDesc(e.target.value)}
                placeholder='Подробно опишите, что произошло…'
                maxLength={5000}
                rows={4}
                style={textareaStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...secondaryBtn, flex: 1 }}
                onClick={() => setShowDisputeModal(false)}
                disabled={actionLoading}
              >
                Отмена
              </button>
              <button
                style={{ ...primaryBtn, flex: 2, opacity: actionLoading ? 0.6 : 1 }}
                onClick={handleSubmitDispute}
                disabled={actionLoading}
              >
                {actionLoading ? 'Открываем…' : 'Открыть спор'}
              </button>
            </div>
          </div>
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

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--tg-theme-hint-color)',
  marginBottom: 8,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  resize: 'vertical',
  boxSizing: 'border-box',
  outline: 'none',
}

const successStyle: React.CSSProperties = {
  marginTop: 24,
  padding: '32px 16px',
  textAlign: 'center',
  background: 'var(--tg-theme-secondary-bg-color)',
  borderRadius: 16,
}

const disputeStatusStyle: React.CSSProperties = {
  marginTop: 24,
  padding: '24px 16px',
  textAlign: 'center',
  background: '#ff3b3011',
  border: '1px solid #ff3b3033',
  borderRadius: 16,
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'flex-end',
}

const modalCardStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--tg-theme-bg-color)',
  borderRadius: '20px 20px 0 0',
  padding: '24px 16px max(24px, env(safe-area-inset-bottom))',
  maxHeight: '90vh',
  overflowY: 'auto',
}

const reasonOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--tg-theme-secondary-bg-color)',
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
