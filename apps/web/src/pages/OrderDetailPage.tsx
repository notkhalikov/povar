import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { useHaptic } from '../hooks/useHaptic'
import { useT } from '../i18n'
import { getOrder, createInvoice, completeOrder, setOrderPrice, patchOrderStatus } from '../api/orders'
import { ApiError } from '../api/client'
import { createReview } from '../api/reviews'
import { createDispute, getDisputeByOrder } from '../api/disputes'
import { useAuth } from '../context/AuthContext'
import { StarRating } from '../components/StarRating'
import { BottomSheet } from '../components/BottomSheet'
import { ChatBox } from '../components/ChatBox'
import type { Order, OrderStatus } from '../types'

type ReviewStep = 'none' | 'form' | 'done'

// Timeline icons (labels come from translations)
const TIMELINE_ICONS: Partial<Record<OrderStatus, string>> = {
  awaiting_payment: '💳',
  paid:             '✅',
  in_progress:      '👨‍🍳',
  completed:        '🎉',
}
const TIMELINE_STATUSES: OrderStatus[] = ['awaiting_payment', 'paid', 'in_progress', 'completed']

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
  return TIMELINE_STATUSES.indexOf(status)
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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

  const [priceInput, setPriceInput] = useState('')
  const [priceSaving, setPriceSaving] = useState(false)

  const [isChatOpen, setIsChatOpen] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const haptic = useHaptic()
  const t = useT()
  const mbHandlerRef = useRef<(() => void) | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    const updated = await getOrder(Number(id))
    setOrder(updated)
    return updated
  }, [id])

  // Auto-open review form when arriving via review deep link
  useEffect(() => {
    if (searchParams.get('openReview') === 'true') {
      setReviewStep('form')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-open chat when arriving via Telegram push deep link (?chat=1)
  useEffect(() => {
    if (searchParams.get('chat') === '1') {
      setIsChatOpen(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Smooth-scroll the chat block into view when it opens
  useEffect(() => {
    if (isChatOpen && chatRef.current) {
      chatRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isChatOpen])

  // ── Telegram MainButton ──────────────────────────────────────────────────
  useEffect(() => {
    if (!order) return
    const MB = WebApp.MainButton

    // Remove stale handler from previous render
    if (mbHandlerRef.current) {
      try { MB.offClick(mbHandlerRef.current) } catch {}
      mbHandlerRef.current = null
    }

    const scheduledPassed = new Date(order.scheduledAt) < new Date()
    const isCustomerNow  = apiUser?.id === order.customerId
    const wantPay    = isCustomerNow && order.status === 'awaiting_payment'
    const wantDone   = isCustomerNow && reviewStep === 'none' && (order.status === 'in_progress' || (order.status === 'paid' && scheduledPassed))
    const wantReview = isCustomerNow && order.status === 'completed' && reviewStep === 'none'

    let handler: (() => void) | null = null
    let text = ''

    if (wantPay && order.agreedPrice && !actionLoading) {
      text = `${t.order.pay} ${order.agreedPrice} ₾`
      handler = handlePay
      try { (MB as any).color = '#34c759'; (MB as any).textColor = '#ffffff' } catch {}
    } else if (wantDone && !actionLoading) {
      text = t.order.allGood
      handler = () => { haptic.medium(); void handleComplete() }
    } else if (wantReview && !actionLoading) {
      text = t.review.submit
      handler = () => setReviewStep('form')
    }

    if (handler && text) {
      mbHandlerRef.current = handler
      try { MB.setText(text); MB.onClick(handler); MB.show() } catch {}
    } else {
      try { MB.hide() } catch {}
    }

    return () => {
      if (mbHandlerRef.current) {
        try { MB.offClick(mbHandlerRef.current) } catch {}
        mbHandlerRef.current = null
      }
      try { MB.hide() } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, reviewStep, actionLoading])

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

  async function handleChefStatus(nextStatus: OrderStatus) {
    haptic.medium()
    setActionLoading(true)
    try {
      const updated = await patchOrderStatus(Number(id), nextStatus)
      setOrder(updated)
      haptic.success()
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : t.errors.generic)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSetPrice() {
    const price = parseFloat(priceInput)
    if (!price || price <= 0) return
    setPriceSaving(true)
    try {
      const updated = await setOrderPrice(Number(id), price)
      setOrder(updated)
      setPriceInput('')
      haptic.success()
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : t.errors.generic)
    } finally { setPriceSaving(false) }
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
      tgAlert(e instanceof Error ? e.message : t.errors.invoiceFail)
    } finally { setActionLoading(false) }
  }

  async function handleComplete() {
    haptic.medium()
    setActionLoading(true)
    try {
      const updated = await completeOrder(Number(id))
      setOrder(updated)
      setReviewStep('form')
      haptic.success()
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : t.errors.completeFail)
    } finally { setActionLoading(false) }
  }

  async function handleSubmitReview() {
    if (reviewRating === 0) { tgAlert(t.review.noRating); return }
    setActionLoading(true)
    try {
      await createReview({ orderId: Number(id), rating: reviewRating, tagsQuality: reviewTags, text: reviewText || undefined })
      setReviewStep('done')
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : t.errors.reviewFail)
    } finally { setActionLoading(false) }
  }

  function toggleTag(tag: string) {
    setReviewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function handleSubmitDispute() {
    if (!disputeReason) { tgAlert(t.dispute.noReason); return }
    if (!disputeDesc.trim()) { tgAlert(t.dispute.noDesc); return }
    setActionLoading(true)
    try {
      const dispute = await createDispute({ orderId: Number(id), reasonCode: disputeReason, description: disputeDesc.trim() })
      setDisputeId(dispute.id)
      setShowDisputeModal(false)
      const updated = await getOrder(Number(id))
      setOrder(updated)
    } catch (e: unknown) {
      tgAlert(e instanceof Error ? e.message : t.errors.disputeFail)
    } finally { setActionLoading(false) }
  }

  async function handleGoToDispute() {
    if (disputeId) { navigate(`/disputes/${disputeId}`); return }
    try {
      const d = await getDisputeByOrder(Number(id))
      navigate(`/disputes/${d.id}`)
    } catch { tgAlert(t.errors.notFound) }
  }

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className='sk' style={{ height: 80, borderRadius: 16 }} />
      <div className='sk' style={{ height: 120, borderRadius: 12 }} />
      <div className='sk' style={{ height: 180, borderRadius: 12 }} />
    </div>
  )
  if (error) return <div style={{ padding: 24, color: 'var(--color-danger)' }}>{t.common.error}: {error}</div>
  if (!order) return null

  const isCustomer     = apiUser?.id === order.customerId
  const isChef         = apiUser?.id === order.chefId
  const scheduledPassed = new Date(order.scheduledAt) < new Date()
  const showPayButton    = isCustomer && order.status === 'awaiting_payment'
  const showOutcomeButtons =
    isCustomer &&
    reviewStep === 'none' &&
    ((order.status === 'paid' && scheduledPassed) || order.status === 'in_progress')
  const disputeReasonKeys = isCustomer
    ? ['chef_no_show', 'late_delivery', 'wrong_menu', 'bad_quality', 'other']
    : ['customer_no_show', 'wrong_address', 'false_complaint', 'other']
  const disputeReasons = disputeReasonKeys.map(code => ({
    code,
    label: t.dispute.reasons[code as keyof typeof t.dispute.reasons],
  }))
  const curTimelineIdx = timelineIndex(order.status)

  const statusStyles: Record<OrderStatus, { bg: string; color: string; label: string }> = {
    draft:            { bg: '#FAEEDA', color: '#854F0B',  label: t.order.statuses.draft },
    awaiting_payment: { bg: '#FAEEDA', color: '#854F0B',  label: t.order.statuses.awaiting_payment },
    paid:             { bg: '#B5D4F4', color: '#185FA5',  label: t.order.statuses.paid },
    in_progress:      { bg: '#B5D4F4', color: '#185FA5',  label: t.order.statuses.in_progress },
    dispute_pending:  { bg: '#FFA500', color: '#ffffff',  label: t.order.statuses.dispute_pending },
    completed:        { bg: '#C0DD97', color: '#3B6D11',  label: t.order.statuses.completed },
    refunded:         { bg: '#F7C1C1', color: '#A32D2D',  label: t.order.statuses.refunded },
    cancelled:        { bg: '#F7C1C1', color: '#A32D2D',  label: t.order.statuses.cancelled },
  }

  return (
    <div style={{ backgroundColor: '#F7F6F3', minHeight: '100dvh', paddingBottom: 64 }}>

      {/* ШАПКА */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#6B6966', fontSize: 15, cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 5L8 10l5 5" stroke="#6B6966" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1917' }}>
          Заказ #{order.id}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6,
          backgroundColor: statusStyles[order.status]?.bg ?? '#E8E6E1',
          color: statusStyles[order.status]?.color ?? '#6B6966',
        }}>
          {statusStyles[order.status]?.label ?? order.status}
        </span>
      </div>

      {/* ДЕТАЛИ ЗАКАЗА */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
        padding: '14px 16px',
      }}>
        {/* Повар */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          paddingBottom: 14, borderBottom: '1px solid #E8E6E1',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            backgroundColor: '#FAECE7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 500, color: '#993C1D',
          }}>
            👨‍🍳
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: 0 }}>
              {order.chefName ?? `#${order.chefId}`}
            </p>
            <p style={{ fontSize: 12, color: '#6B6966', margin: 0 }}>
              {t.order.chef}
            </p>
          </div>
        </div>

        {/* Детали */}
        {[
          { label: t.order.format, value: order.type === 'home_visit' ? t.order.homeVisit : t.order.delivery },
          { label: t.order.dateTime, value: new Date(order.scheduledAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) },
          { label: t.order.persons, value: order.persons },
          { label: t.order.city, value: order.city },
          { label: t.order.address, value: order.address },
          { label: 'Сумма', value: order.agreedPrice ? `${order.agreedPrice} ₾` : null },
        ].filter(r => r.value).map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline', padding: '9px 0',
            borderBottom: '1px solid #E8E6E1', fontSize: 14,
          }}>
            <span style={{ color: '#6B6966' }}>{row.label}</span>
            <span style={{ color: '#1A1917', fontWeight: 500, maxWidth: '60%',
              textAlign: 'right' }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* КНОПКИ ДЕЙСТВИЙ */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexDirection: 'column' }}>

        {/* ── Chat toggle ──────────────────────────────────────────── */}
        {(isCustomer || isChef) && !['cancelled', 'refunded'].includes(order.status) && (
          <>
            <button
              onClick={() => {
                if (!isChatOpen) {
                  setOrder(prev => prev ? { ...prev, unreadCount: 0 } : prev)
                }
                setIsChatOpen(v => !v)
              }}
              style={{
                position: 'relative', marginBottom: 16,
                width: '100%', padding: '12px 16px', borderRadius: 12,
                backgroundColor: '#ffffff', border: '1px solid #E8E6E1',
                fontSize: 14, color: '#6B6966', fontWeight: 500, cursor: 'pointer',
              }}
            >
              💬 {isChef ? 'Чат с заказчиком' : 'Чат с поваром'}
              {(order.unreadCount ?? 0) > 0 && (
                <div style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  backgroundColor: '#D85A30',
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
                  {(order.unreadCount ?? 0) >= 10 ? '9+' : order.unreadCount}
                </div>
              )}
            </button>
            <div ref={chatRef} style={{ display: isChatOpen ? 'block' : 'none' }}>
              <ChatBox orderId={order.id} isOpen={isChatOpen} />
            </div>
          </>
        )}

        {/* ── Timeline ──────────────────────────────────────────────── */}
        {!['cancelled', 'refunded', 'dispute_pending'].includes(order.status) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            gap: 0, marginBottom: 20, backgroundColor: '#ffffff', borderRadius: 12,
            padding: '16px', border: '1px solid #E8E6E1',
          }}>
            {TIMELINE_STATUSES.map((status, i) => {
              const statusColorMap: Record<OrderStatus, string> = {
                'awaiting_payment': '#854F0B',
                'paid': '#185FA5',
                'in_progress': '#185FA5',
                'completed': '#34c759',
                'draft': '#854F0B',
                'dispute_pending': '#ff9500',
                'refunded': '#A32D2D',
                'cancelled': '#A32D2D',
              }
              const done    = curTimelineIdx > i || order.status === 'completed'
              const current = curTimelineIdx === i
              const dot_color = done || current ? status === 'completed' ? '#34c759' : statusColorMap[status] : '#E8E6E1'
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', flex: i < TIMELINE_STATUSES.length - 1 ? '1 1 auto' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 52 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16,
                      background: done || current ? dot_color : '#F7F6F3',
                      color: done || current ? '#fff' : '#9E9B97',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: done ? 14 : 16,
                      fontWeight: 700,
                      boxShadow: current ? `0 0 0 3px ${dot_color}44` : 'none',
                      transition: 'all .2s',
                    }}>
                      {done ? '✓' : TIMELINE_ICONS[status]}
                    </div>
                    <div style={{
                      fontSize: 10, marginTop: 4, textAlign: 'center',
                      color: current ? dot_color : done ? '#1A1917' : '#9E9B97',
                      fontWeight: current ? 600 : 400,
                      lineHeight: 1.2,
                    }}>
                      {t.order.timeline[status as keyof typeof t.order.timeline]}
                    </div>
                  </div>
                  {i < TIMELINE_STATUSES.length - 1 && (
                    <div style={{
                      flex: 1, height: 2, marginBottom: 18,
                      background: done ? dot_color : '#F7F6F3',
                      transition: 'background .2s',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Chef: set price ───────────────────────────────────────── */}
        {isChef && order.status === 'awaiting_payment' && !order.agreedPrice && (
          <div style={{ marginBottom: 16, backgroundColor: '#ffffff', border: '1px solid #E8E6E1', padding: '16px', borderRadius: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#1A1917' }}>Укажите стоимость заказа</div>
            <input
              type='number'
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              placeholder='Сумма в GEL'
              min={1}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: '1px solid #E8E6E1',
                background: '#F7F6F3',
                color: '#1A1917',
                fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              style={{
                marginTop: 10, width: '100%', padding: '12px 16px', borderRadius: 10,
                backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                border: 'none', cursor: 'pointer', opacity: !priceInput || priceSaving ? .55 : 1,
              }}
              disabled={!priceInput || priceSaving}
              onClick={handleSetPrice}
            >
              {priceSaving ? 'Сохраняем...' : 'Подтвердить цену'}
            </button>
          </div>
        )}

        {/* ── Chef: status actions ──────────────────────────────────── */}
        {isChef && (order.status === 'paid' || order.status === 'in_progress') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {order.status === 'paid' && (
              <button
                disabled={actionLoading}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
                }}
                onClick={() => handleChefStatus('in_progress')}
              >
                {actionLoading ? '...' : 'Взять в работу'}
              </button>
            )}
            {order.status === 'in_progress' && (
              <button
                disabled={actionLoading}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
                }}
                onClick={() => handleChefStatus('completed')}
              >
                {actionLoading ? '...' : 'Завершить заказ'}
              </button>
            )}
            <button
              disabled={actionLoading}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                backgroundColor: '#ffffff', color: '#6B6966', fontSize: 14, fontWeight: 500,
                border: '1px solid #E8E6E1', cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
              }}
              onClick={() => handleChefStatus('cancelled')}
            >
              Отменить заказ
            </button>
          </div>
        )}

        {/* ── Order details ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 16, backgroundColor: '#ffffff', border: '1px solid #E8E6E1', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: t.order.format, value: order.type === 'home_visit' ? t.order.homeVisit : t.order.delivery },
            { label: t.order.dateTime, value: new Date(order.scheduledAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
            { label: t.order.persons, value: order.persons },
            order.city ? { label: t.order.city, value: order.city } : null,
            order.address ? { label: t.order.address, value: order.address } : null,
            order.description ? { label: t.order.comment, value: order.description } : null,
            order.agreedPrice ? { label: t.order.amount, value: `${order.agreedPrice} ₾` } : null,
            order.productsBuyer ? { label: t.order.products, value: order.productsBuyer === 'customer' ? t.order.productsCustomer : t.order.productsChef } : null,
          ].filter(Boolean).map((row, idx, arr) => (
            <div key={row!.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '14px 16px', borderBottom: idx < arr.length - 1 ? '1px solid #E8E6E1' : 'none',
            }}>
              <span style={{ color: '#6B6966', fontSize: 14 }}>{row!.label}</span>
              <span style={{ color: '#1A1917', fontWeight: row!.label === t.order.amount ? 700 : 500, maxWidth: '60%', textAlign: 'right', fontSize: 14 }}>{row!.value}</span>
            </div>
          ))}
        </div>

        {/* ── Review form ───────────────────────────────────────────── */}
        {reviewStep === 'form' && (
          <div style={{ marginBottom: 16, backgroundColor: '#ffffff', border: '1px solid #E8E6E1', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16, color: '#1A1917' }}>{t.review.title}</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#6B6966', marginBottom: 12 }}>{t.review.rating}</div>
              <StarRating value={reviewRating} interactive onChange={setReviewRating} size={36} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#6B6966', marginBottom: 12 }}>{t.review.liked}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(t.review.tags).map(([key, label]) => (
                  <button
                    key={key}
                    type='button'
                    onClick={() => toggleTag(key)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 20,
                      border: reviewTags.includes(key) ? 'none' : '1px solid #E8E6E1',
                      cursor: 'pointer',
                      fontSize: 13,
                      minHeight: 44,
                      background: reviewTags.includes(key) ? '#D85A30' : '#ffffff',
                      color: reviewTags.includes(key) ? '#ffffff' : '#1A1917',
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#6B6966', marginBottom: 12 }}>{t.order.comment}</div>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder={t.review.commentPlaceholder}
                maxLength={2000}
                rows={3}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
                  color: '#1A1917', fontSize: 14, fontFamily: 'inherit',
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                border: 'none', cursor: 'pointer', opacity: actionLoading ? .6 : 1,
              }}
              disabled={actionLoading}
              onClick={handleSubmitReview}
            >
              {actionLoading ? t.review.submitting : t.review.submit}
            </button>
          </div>
        )}

        {reviewStep === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', marginBottom: 16, backgroundColor: '#ffffff', border: '1px solid #E8E6E1', borderRadius: 12 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>⭐</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#1A1917' }}>{t.review.thanks}</div>
            <div style={{ fontSize: 14, color: '#6B6966' }}>
              {t.review.thanksHint}
            </div>
          </div>
        )}

        {/* ── Dispute status ────────────────────────────────────────── */}
        {order.status === 'dispute_pending' && (
          <div style={{
            padding: '24px 16px', borderRadius: 12,
            background: '#FFA50012',
            border: '1px solid #FFA50030',
            textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, color: '#ff9500' }}>
              {t.order.disputeTitle}
            </div>
            <div style={{ fontSize: 14, color: '#6B6966', marginBottom: 16, lineHeight: 1.5 }}>
              {t.order.disputeInfo}
            </div>
            <button style={{
              padding: '12px 16px', borderRadius: 10,
              backgroundColor: '#ffffff', border: '1px solid #E8E6E1',
              fontSize: 14, fontWeight: 500, color: '#6B6966',
              cursor: 'pointer', maxWidth: 240, margin: '0 auto', display: 'block',
            }} onClick={handleGoToDispute}>
              {t.order.disputeDetail}
            </button>
          </div>
        )}

      </div>

      {/* ── Action panel ──────────────────────────────────────────── */}
      {(showPayButton || showOutcomeButtons) && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#ffffff', borderTop: '1px solid #E8E6E1',
          padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {showPayButton && (
            <>
              {(() => {
                const hasPrice = order.agreedPrice && parseFloat(String(order.agreedPrice)) > 0
                return (
                  <>
                    {!hasPrice && (
                      <p style={{ margin: 0, fontSize: 13, color: '#6B6966', textAlign: 'center' }}>
                        {t.order.noPrice}
                      </p>
                    )}
                    <button
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: 10,
                        backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                        border: 'none', cursor: 'pointer', opacity: actionLoading || !hasPrice ? .55 : 1,
                      }}
                      disabled={actionLoading || !hasPrice}
                      onClick={handlePay}
                    >
                      {actionLoading
                        ? t.order.paying
                        : hasPrice ? `${t.order.pay} ${order.agreedPrice} ${t.common.currency}` : t.order.pay}
                    </button>
                  </>
                )
              })()}
            </>
          )}
          {showOutcomeButtons && (
            <>
              <button
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
                  border: 'none', cursor: 'pointer', opacity: actionLoading ? .6 : 1,
                }}
                disabled={actionLoading}
                onClick={handleComplete}
              >
                {actionLoading ? t.order.saving : t.order.allGood}
              </button>
              <button
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  backgroundColor: '#ffffff', color: '#6B6966', fontSize: 14, fontWeight: 500,
                  border: '1px solid #E8E6E1', cursor: 'pointer',
                }}
                disabled={actionLoading}
                onClick={() => { setDisputeReason(''); setDisputeDesc(''); setShowDisputeModal(true) }}
              >
                {t.order.problem}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Dispute bottom sheet ───────────────────────────────────── */}
      <BottomSheet
        open={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title={t.dispute.openTitle}
      >
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B6966', lineHeight: 1.5 }}>
          {t.dispute.openInfo}
        </p>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6B6966', marginBottom: 12 }}>{t.dispute.reason}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {disputeReasons.map(r => (
              <label key={r.code} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: disputeReason === r.code
                  ? '#D85A3018'
                  : '#F7F6F3',
                border: `1.5px solid ${disputeReason === r.code ? '#D85A30' : 'transparent'}`,
                fontSize: 14, minHeight: 48,
                color: '#1A1917',
              }}>
                <input
                  type='radio'
                  name='dispute-reason'
                  value={r.code}
                  checked={disputeReason === r.code}
                  onChange={() => setDisputeReason(r.code)}
                  style={{ accentColor: '#D85A30', width: 18, height: 18 }}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6B6966', marginBottom: 12 }}>{t.dispute.description}</div>
          <textarea
            value={disputeDesc}
            onChange={e => setDisputeDesc(e.target.value)}
            placeholder={t.dispute.descPlaceholder}
            maxLength={5000}
            rows={4}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
              color: '#1A1917', fontSize: 14, fontFamily: 'inherit',
              outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10,
              backgroundColor: '#ffffff', color: '#6B6966', fontSize: 14, fontWeight: 500,
              border: '1px solid #E8E6E1', cursor: 'pointer',
            }}
            onClick={() => setShowDisputeModal(false)}
            disabled={actionLoading}
          >
            {t.common.cancel}
          </button>
          <button
            style={{
              flex: 2, padding: '12px 16px', borderRadius: 10,
              backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
              border: 'none', cursor: 'pointer', opacity: actionLoading ? .6 : 1,
            }}
            onClick={handleSubmitDispute}
            disabled={actionLoading}
          >
            {actionLoading ? t.dispute.submitting : t.dispute.submit}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
