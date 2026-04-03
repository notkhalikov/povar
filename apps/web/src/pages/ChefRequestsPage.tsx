import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getRequests, respondToRequest } from '../api/requests'
import type { RequestItem } from '../types'
import { useT } from '../i18n'

export default function ChefRequestsPage() {
  const t = useT()
  const navigate = useNavigate()
  const [items, setItems] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState<number | null>(null)
  const [price, setPrice] = useState('')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getRequests()
      .then(res => setItems(res.data))
      .finally(() => setLoading(false))
  }, [])

  function openRespondForm(id: number) {
    setRespondingTo(id)
    setPrice('')
    setComment('')
  }

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault()
    if (!respondingTo) return
    setSending(true)
    try {
      await respondToRequest(respondingTo, {
        proposedPrice: price ? Number(price) : undefined,
        comment:       comment || undefined,
      })
      // Mark locally that chef responded
      setItems(prev => prev.map(r =>
        r.id === respondingTo ? { ...r, responseCount: r.responseCount + 1 } : r,
      ))
      setRespondingTo(null)
      WebApp.showAlert(t.requests.respondSuccess)
    } catch (err: unknown) {
      WebApp.showAlert(err instanceof Error ? err.message : t.errors.respondFail)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>{t.common.loading}</div>
  }

  return (
    <div style={{ padding: '12px 16px 80px' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{t.requests.incoming}</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--tg-theme-hint-color)', fontSize: 13 }}>
        {t.requests.incomingHint}
      </p>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.requests.noIncoming}</div>
          <div style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
            {t.requests.noIncomingHint}
          </div>
          <button
            style={linkBtnStyle}
            onClick={() => navigate('/chef/onboarding')}
          >
            {t.requests.editProfile}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.id}>
            <RequestCard
              item={item}
              onRespond={() => openRespondForm(item.id)}
              isResponding={respondingTo === item.id}
            />

            {/* Inline respond form */}
            {respondingTo === item.id && !item.hasResponded && (
              <form onSubmit={handleRespond} style={respondFormStyle}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>{t.requests.respondTitle}</div>

                <div style={{ marginBottom: 14 }}>
                  <div style={labelStyle}>{t.requests.priceLabel}</div>
                  <input
                    type='number'
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder='150'
                    min={0}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={labelStyle}>{t.requests.commentLabel}</div>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={t.requests.commentPlaceholder}
                    rows={3}
                    maxLength={1000}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type='button'
                    style={{ ...cancelBtnStyle, flex: 1 }}
                    onClick={() => setRespondingTo(null)}
                    disabled={sending}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type='submit'
                    style={{ ...submitBtnStyle, flex: 2, opacity: sending ? 0.6 : 1 }}
                    disabled={sending}
                  >
                    {sending ? t.requests.sending : t.requests.respond}
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RequestCard({
  item, onRespond, isResponding,
}: {
  item: RequestItem
  onRespond: () => void
  isResponding: boolean
}) {
  const t = useT()
  const date = new Date(item.scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {item.city}{item.district ? `, ${item.district}` : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
            {item.format === 'home_visit' ? t.chef.homeVisitFull : t.chef.deliveryFull} · 👥 {item.persons} {t.common.persons}
          </div>
        </div>
        {item.budget && (
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t.common.upTo} {item.budget} {t.common.currency}</span>
        )}
      </div>

      {item.description && (
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: 'var(--tg-theme-text-color)' }}>
          {item.description}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>📅 {date}</span>
        {item.hasResponded ? (
          <span style={respondedBadgeStyle}>{t.requests.respondSent}</span>
        ) : (
          <button
            style={{ ...respondBtnStyle, opacity: isResponding ? 0.5 : 1 }}
            onClick={onRespond}
            disabled={isResponding}
          >
            {t.requests.respond}
          </button>
        )}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  background: 'var(--tg-theme-secondary-bg-color)',
}

const respondFormStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: '0 0 14px 14px',
  background: 'var(--tg-theme-bg-color)',
  border: '1px solid var(--tg-theme-hint-color)44',
  borderTop: 'none',
  marginTop: -4,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--tg-theme-hint-color)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  boxSizing: 'border-box',
  outline: 'none',
}

const respondBtnStyle: React.CSSProperties = {
  padding: '7px 16px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const submitBtnStyle: React.CSSProperties = {
  padding: '11px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '11px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'transparent',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  cursor: 'pointer',
}

const linkBtnStyle: React.CSSProperties = {
  marginTop: 16,
  padding: '10px 20px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'transparent',
  color: 'var(--tg-theme-text-color)',
  fontSize: 14,
  cursor: 'pointer',
}

const respondedBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 12px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  background: '#34c75922',
  color: '#34c759',
}
