import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getOrder, createInvoice, completeOrder } from '../api/orders'
import { ApiError } from '../api/client'
import { createReview } from '../api/reviews'
import { createDispute, getDisputeByOrder } from '../api/disputes'
import { useAuth } from '../context/AuthContext'
import { StatusBadge, STATUS_COLORS, STATUS_LABELS } from '../components/StatusBadge'
import { StarRating } from '../components/StarRating'
import { BottomSheet } from '../components/BottomSheet'
import type { Order, OrderStatus } from '../types'

// Re-export for backward compatibility
export { StatusBadge, STATUS_COLORS, STATUS_LABELS }

type ReviewStep = 'none' | 'form' | 'done'

const QUALITY_TAGS = ['вкус', 'порции', 'подача', 'пунктуальность', 'коммуникация']

const CUSTOMER_REASONS = [
  { code: 'chef_no_show',  label: 'Повар не пришёл' },
  { code: 'late_delivery', label: 'Сильное опоздание' },
  { code: 'wrong_menu',    label: 'Приготовлено не то блюдо' },
  { code: 'bad_quality',   label: 'Плохое качество еды' },
  { code: 'other',         label: 'Другое' },
]

const CHEF_REASONS = [
  { code: 'customer_no_show', label: 'Заказчик не открыл дверь' },
  { code: 'wrong_address',    label: 'Неверный адрес' },
  { code: 'false_complaint',  label: 'Ложная жалоба' },
  { code: 'other',            label: 'Другое' },
]

// Timeline: statuses in logical order for display
const TIMELINE_STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'awaiting_payment', label: 'Ожидает оплаты', icon: '💳' },
  { status: 'paid',             label: 'Оплачен',        icon: '✅' },
  { status: 'in_progress',      label: 'В процессе',     icon: '👨‍🍳' },
  { status: 'completed',        label: 'Завершён',       icon: '🎉' },
]

const STATUS_ICON: Partial<Record<OrderStatus, string>> = {
  draft:            '📝',
  awaiting_payment: '💳',
  paid:             '✅',
  in_progress:      '👨‍🍳',
  completed:        '🎉',
  dispute_pending:  '⚠️',
  refunded:         '↩️',
  cancelled:        '❌',
}

function timelineIndex(status: OrderStatus): number {
  return TIMELINE_STEPS.findIndex(s => s.status === status)
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: apiUser } = useAuth()
  const [order, setOrder]           = useState<Order | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [reviewStep, setReviewStep]     = useState<ReviewStep>('none')
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewTags, setReviewTags]     = useState<string[]>([])
  const [reviewText, setReviewText]     = useState('')

  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason]       = useState('')
  const [disputeDesc, setDisputeDesc]           = useState('')
  const [disputeId, setDisputeId]               = useState<number | null>(null)

  const goBack = useCallback(() => navigate('/orders'), [navigate])

  useEffect(() => {
    try {
      WebApp.BackButton.show()
      WebApp.BackButton.onClick(goBack)
    } catch { /* not in Telegram */ }
    return () => {
      try {
        WebApp.BackButton.hide()
        WebApp.BackButton.offClick(goBack)
      } catch { /* not in Telegram */ }
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
      .catch(e => {
        if (e instanceof ApiError && e.status === 404) {
          navigate('/orders', { replace: true })
        } else {
          setError(e.message)
        }
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

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

  function tgAlert(msg: string) {
    try { WebApp.showAlert(msg) } catch { alert(msg) }
  }

  async function handlePay() {
    setActionLoading(true)
    try {
      const { invoiceUrl } = await createInvoice(Number(id))
      try {
        WebApp.openInvoice(invoiceUrl, (status) => {
          if (status === 'paid') pollUntilStatus('paid')
        })
      } catch {
        // Fallback for browser dev mode
        window.open(invoiceUrl, '_blank')
      }
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : 'Не удалось создать счёт')
    } finally { setActionLoading(false) }
  }

  async function handleComplete() {
    setActionLoading(true)
    try {
      const updated = await completeOrder(Number(id))
      setOrder(updated)
      setReviewStep('form')
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : 'Не удалось завершить заказ')
    } finally { setActionLoading(false) }
  }

  async function handleSubmitReview() {
    if (reviewRating === 0) { tgAlert('Пожалуйста, выберите оценку'); return }
    setActionLoading(true)
    try {
      await createReview({ orderId: Number(id), rating: reviewRating, tagsQuality: reviewTags, text: reviewText || undefined })
      setReviewStep('done')
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : 'Не удалось отправить отзыв')
    } finally { setActionLoading(false) }
  }

  function toggleTag(tag: string) {
    setReviewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function handleSubmitDispute() {
    if (!disputeReason) { tgAlert('Пожалуйста, выберите причину'); return }
    if (!disputeDesc.trim()) { tgAlert('Пожалуйста, опишите проблему'); return }
    setActionLoading(true)
    try {
      const dispute = await createDispute({ orderId: Number(id), reasonCode: disputeReason, description: disputeDesc.trim() })
      setDisputeId(dispute.id)
      setShowDisputeModal(false)
      const updated = await getOrder(Number(id))
      setOrder(updated)
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : 'Не удалось открыть спор')
    } finally { setActionLoading(false) }
  }

  async function handleGoToDispute() {
    if (disputeId) { navigate(`/disputes/${disputeId}`); return }
    try {
      const d = await getDisputeByOrder(Number(id))
      navigate(`/disputes/${d.id}`)
    } catch { tgAlert('Спор не найден') }
  }

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className='sk' style={{ height: 80, borderRadius: 16 }} />
      <div className='sk' style={{ height: 120, borderRadius: 12 }} />
      <div className='sk' style={{ height: 180, borderRadius: 12 }} />
    </div>
  )
  if (error) return <div style={{ padding: 24, color: 'var(--color-danger)' }}>Ошибка: {error}</div>
  if (!order) return null

  const scheduledPassed = new Date(order.scheduledAt) < new Date()
  const showPayButton    = order.status === 'awaiting_payment'
  const showOutcomeButtons =
    reviewStep === 'none' &&
    ((order.status === 'paid' && scheduledPassed) || order.status === 'in_progress')
  const isCustomer    = apiUser?.id === order.customerId
  const disputeReasons = isCustomer ? CUSTOMER_REASONS : CHEF_REASONS
  const statusColor   = STATUS_COLORS[order.status]
  const curTimelineIdx = timelineIndex(order.status)

  return (
    <div style={{ padding: '0 0 100px' }}>

      {/* ── Status hero ───────────────────────────────────────────── */}
      <div style={{
        padding: '28px 16px 20px',
        background: statusColor + '14',
        borderBottom: `1px solid ${statusColor}30`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8, lineHeight: 1 }}>
          {STATUS_ICON[order.status] ?? '📋'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginBottom: 6 }}>
          Заказ #{order.id}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: statusColor, marginBottom: 8 }}>
          {STATUS_LABELS[order.status]}
        </div>
        {order.agreedPrice && (
          <div style={{ fontSize: 28, fontWeight: 700 }}>{order.agreedPrice} ₾</div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* ── Timeline ──────────────────────────────────────────────── */}
        {!['cancelled', 'refunded', 'dispute_pending'].includes(order.status) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            gap: 0, marginBottom: 20,
          }}>
            {TIMELINE_STEPS.map((ts, i) => {
              const done    = curTimelineIdx > i || order.status === 'completed'
              const current = curTimelineIdx === i
              const dot_color = done || current ? ts.status === 'completed' ? '#34c759' : STATUS_COLORS[ts.status] : 'var(--tg-theme-secondary-bg-color)'
              return (
                <div key={ts.status} style={{ display: 'flex', alignItems: 'center', flex: i < TIMELINE_STEPS.length - 1 ? '1 1 auto' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16,
                      background: done || current ? dot_color : 'var(--tg-theme-secondary-bg-color)',
                      color: done || current ? '#fff' : 'var(--tg-theme-hint-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: done ? 14 : 16,
                      fontWeight: 700,
                      boxShadow: current ? `0 0 0 3px ${dot_color}44` : 'none',
                      transition: 'all .2s',
                    }}>
                      {done ? '✓' : ts.icon}
                    </div>
                    <div style={{
                      fontSize: 10, marginTop: 4, textAlign: 'center',
                      color: current ? statusColor : done ? 'var(--tg-theme-text-color)' : 'var(--tg-theme-hint-color)',
                      fontWeight: current ? 600 : 400,
                      lineHeight: 1.2,
                    }}>
                      {ts.label}
                    </div>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: 2, marginBottom: 18,
                      background: done ? dot_color : 'var(--tg-theme-secondary-bg-color)',
                      transition: 'background .2s',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Chef card ─────────────────────────────────────────────── */}
        <div className='card' style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: 'var(--tg-theme-button-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--tg-theme-button-text-color)', fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}>
            👨‍🍳
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--tg-theme-hint-color)', marginBottom: 2 }}>Повар</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{order.chefName ?? `#${order.chefId}`}</div>
          </div>
        </div>

        {/* ── Order details ─────────────────────────────────────────── */}
        <div className='card' style={{ marginBottom: 16 }}>
          <div className='detail-row'>
            <span className='detail-row__label'>Формат</span>
            <span className='detail-row__value'>{order.type === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'}</span>
          </div>
          <div className='detail-row'>
            <span className='detail-row__label'>Дата и время</span>
            <span className='detail-row__value'>
              {new Date(order.scheduledAt).toLocaleString('ru-RU', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <div className='detail-row'>
            <span className='detail-row__label'>Людей</span>
            <span className='detail-row__value'>{order.persons}</span>
          </div>
          {order.city && (
            <div className='detail-row'>
              <span className='detail-row__label'>Город</span>
              <span className='detail-row__value'>{order.city}</span>
            </div>
          )}
          {order.address && (
            <div className='detail-row'>
              <span className='detail-row__label'>Адрес</span>
              <span className='detail-row__value'>{order.address}</span>
            </div>
          )}
          {order.description && (
            <div className='detail-row'>
              <span className='detail-row__label'>Комментарий</span>
              <span className='detail-row__value'>{order.description}</span>
            </div>
          )}
          {order.agreedPrice && (
            <div className='detail-row'>
              <span className='detail-row__label'>Сумма</span>
              <span className='detail-row__value' style={{ fontWeight: 700 }}>{order.agreedPrice} ₾</span>
            </div>
          )}
          {order.productsBuyer && (
            <div className='detail-row'>
              <span className='detail-row__label'>Продукты</span>
              <span className='detail-row__value'>{order.productsBuyer === 'customer' ? 'Клиент' : 'Повар'}</span>
            </div>
          )}
        </div>

        {/* ── Review form ───────────────────────────────────────────── */}
        {reviewStep === 'form' && (
          <div className='card' style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Оставьте отзыв</div>

            <div style={{ marginBottom: 20 }}>
              <div className='section-label'>Оценка</div>
              <StarRating value={reviewRating} interactive onChange={setReviewRating} size={36} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className='section-label'>Что понравилось</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUALITY_TAGS.map(tag => (
                  <button
                    key={tag}
                    type='button'
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 20,
                      border: '1px solid var(--tg-theme-hint-color)',
                      cursor: 'pointer',
                      fontSize: 13,
                      minHeight: 44,
                      background: reviewTags.includes(tag) ? 'var(--tg-theme-button-color)' : 'transparent',
                      color: reviewTags.includes(tag) ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className='section-label'>Комментарий</div>
              <textarea
                className='field-input'
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder='Расскажите подробнее…'
                maxLength={2000}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              className='btn-primary'
              style={{ opacity: actionLoading ? .6 : 1 }}
              disabled={actionLoading}
              onClick={handleSubmitReview}
            >
              {actionLoading ? 'Отправка…' : 'Отправить отзыв'}
            </button>
          </div>
        )}

        {reviewStep === 'done' && (
          <div className='card' style={{ textAlign: 'center', padding: '32px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>⭐</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Спасибо за отзыв!</div>
            <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>
              Ваша оценка поможет другим заказчикам
            </div>
          </div>
        )}

        {/* ── Dispute status ────────────────────────────────────────── */}
        {order.status === 'dispute_pending' && (
          <div style={{
            padding: '24px 16px', borderRadius: 16,
            background: 'var(--color-danger)' + '12',
            border: '1px solid var(--color-danger)' + '30',
            textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, color: 'var(--color-danger)' }}>
              Спор открыт
            </div>
            <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)', marginBottom: 16, lineHeight: 1.5 }}>
              Рассматривается службой поддержки в течение 24–48 часов
            </div>
            <button className='btn-secondary' style={{ maxWidth: 240, margin: '0 auto' }} onClick={handleGoToDispute}>
              Детали спора →
            </button>
          </div>
        )}

      </div>

      {/* ── Action panel ──────────────────────────────────────────── */}
      {(showPayButton || showOutcomeButtons) && (
        <div className='action-bar'>
          {showPayButton && (
            <>
              {!order.agreedPrice && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--tg-theme-hint-color)', textAlign: 'center' }}>
                  Повар ещё не установил цену. Оплата будет доступна после согласования.
                </p>
              )}
              <button
                className='btn-primary'
                style={{ opacity: actionLoading || !order.agreedPrice ? .55 : 1 }}
                disabled={actionLoading || !order.agreedPrice}
                onClick={handlePay}
              >
                {actionLoading
                  ? 'Открываем счёт…'
                  : order.agreedPrice ? `Оплатить ${order.agreedPrice} ₾` : 'Оплатить'}
              </button>
            </>
          )}
          {showOutcomeButtons && (
            <>
              <button
                className='btn-primary'
                style={{ opacity: actionLoading ? .6 : 1 }}
                disabled={actionLoading}
                onClick={handleComplete}
              >
                {actionLoading ? 'Сохраняем…' : '✓ Всё прошло хорошо'}
              </button>
              <button
                className='btn-secondary'
                disabled={actionLoading}
                onClick={() => { setDisputeReason(''); setDisputeDesc(''); setShowDisputeModal(true) }}
              >
                Есть проблема
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Dispute bottom sheet ───────────────────────────────────── */}
      <BottomSheet
        open={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title='Открыть спор'
      >
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
          Спор рассматривается поддержкой в течение 24–48 часов
        </p>

        <div style={{ marginBottom: 20 }}>
          <div className='section-label'>Причина</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {disputeReasons.map(r => (
              <label key={r.code} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: disputeReason === r.code
                  ? 'var(--tg-theme-button-color)' + '18'
                  : 'var(--tg-theme-secondary-bg-color)',
                border: `1.5px solid ${disputeReason === r.code ? 'var(--tg-theme-button-color)' : 'transparent'}`,
                fontSize: 14, minHeight: 48,
              }}>
                <input
                  type='radio'
                  name='dispute-reason'
                  value={r.code}
                  checked={disputeReason === r.code}
                  onChange={() => setDisputeReason(r.code)}
                  style={{ accentColor: 'var(--tg-theme-button-color)', width: 18, height: 18 }}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className='section-label'>Описание</div>
          <textarea
            className='field-input'
            value={disputeDesc}
            onChange={e => setDisputeDesc(e.target.value)}
            placeholder='Подробно опишите, что произошло…'
            maxLength={5000}
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className='btn-secondary'
            style={{ flex: 1 }}
            onClick={() => setShowDisputeModal(false)}
            disabled={actionLoading}
          >
            Отмена
          </button>
          <button
            className='btn-primary'
            style={{ flex: 2, opacity: actionLoading ? .6 : 1 }}
            onClick={handleSubmitDispute}
            disabled={actionLoading}
          >
            {actionLoading ? 'Открываем…' : 'Открыть спор'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
