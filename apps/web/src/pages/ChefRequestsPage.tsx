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
    return <div style={{ padding: 24, textAlign: 'center', color: '#6B6966' }}>{t.common.loading}</div>
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
          {t.requests.incoming}
        </h1>
        <p style={{ margin: '8px 0 0', color: '#6B6966', fontSize: 13 }}>
          {t.requests.incomingHint}
        </p>
      </div>

      <div style={{ padding: '12px 16px' }}>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9E9B97', fontSize: 15 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#1A1917' }}>{t.requests.noIncoming}</div>
          <div style={{ color: '#6B6966', fontSize: 14, marginBottom: 16 }}>
            {t.requests.noIncomingHint}
          </div>
          <button
            style={{
              marginTop: 16, padding: '10px 20px', borderRadius: 10,
              border: '1px solid #E8E6E1', backgroundColor: '#ffffff',
              color: '#1A1917', fontSize: 14, cursor: 'pointer', fontWeight: 500,
            }}
            onClick={() => navigate('/chef/onboarding')}
          >
            {t.requests.editProfile}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <div key={item.id}>
            <RequestCard
              item={item}
              onRespond={() => openRespondForm(item.id)}
              isResponding={respondingTo === item.id}
            />

            {/* Inline respond form */}
            {respondingTo === item.id && !item.hasResponded && (
              <form onSubmit={handleRespond} style={{
                padding: '14px 16px', borderRadius: '0 0 12px 12px',
                backgroundColor: '#F7F6F3', border: '1px solid #E8E6E144',
                borderTop: 'none', marginTop: -4,
              }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#1A1917' }}>{t.requests.respondTitle}</div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: '#6B6966', marginBottom: 6, fontWeight: 500 }}>{t.requests.priceLabel}</div>
                  <input
                    type='number'
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder='150'
                    min={0}
                    style={{
                      width: '100%', padding: '11px 13px', borderRadius: 10,
                      border: '1px solid #E8E6E1', backgroundColor: '#ffffff',
                      color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: '#6B6966', marginBottom: 6, fontWeight: 500 }}>{t.requests.commentLabel}</div>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={t.requests.commentPlaceholder}
                    rows={3}
                    maxLength={1000}
                    style={{
                      width: '100%', padding: '11px 13px', borderRadius: 10,
                      border: '1px solid #E8E6E1', backgroundColor: '#ffffff',
                      color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none',
                      fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type='button'
                    style={{
                      flex: 1, padding: '11px', borderRadius: 10,
                      border: '1px solid #E8E6E1', backgroundColor: '#ffffff',
                      color: '#1A1917', fontSize: 15, cursor: 'pointer', fontWeight: 500,
                    }}
                    onClick={() => setRespondingTo(null)}
                    disabled={sending}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type='submit'
                    style={{
                      flex: 2, padding: '11px', borderRadius: 10,
                      border: 'none', backgroundColor: '#D85A30',
                      color: '#ffffff', fontSize: 15, cursor: 'pointer', fontWeight: 500,
                      opacity: sending ? 0.6 : 1,
                    }}
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
    <div style={{
      padding: '14px 16px', borderRadius: 12, backgroundColor: '#ffffff',
      border: '1px solid #E8E6E1',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#1A1917' }}>
            {item.city}{item.district ? `, ${item.district}` : ''}
          </div>
          <div style={{ fontSize: 13, color: '#6B6966', marginTop: 2 }}>
            {item.format === 'home_visit' ? t.chef.homeVisitFull : t.chef.deliveryFull} · 👥 {item.persons} {t.common.persons}
          </div>
        </div>
        {item.budget && (
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1917' }}>{t.common.upTo} {item.budget} {t.common.currency}</span>
        )}
      </div>

      {item.description && (
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: '#1A1917' }}>
          {item.description}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#9E9B97' }}>📅 {date}</span>
        {item.hasResponded ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '6px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            backgroundColor: '#C0DD9722', color: '#3B6D11',
          }}>{t.requests.respondSent}</span>
        ) : (
          <button
            style={{
              padding: '7px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              backgroundColor: '#D85A30', color: '#ffffff', border: 'none',
              cursor: 'pointer', opacity: isResponding ? 0.5 : 1,
            }}
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

