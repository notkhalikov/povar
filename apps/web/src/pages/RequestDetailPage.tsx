import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getRequest, acceptResponse, closeRequest } from '../api/requests'
import { useAuth } from '../context/AuthContext'
import { ChatBox } from '../components/ChatBox'
import type { RequestDetail, ChefResponseItem } from '../types'
import { useT } from '../i18n'

export default function RequestDetailPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [req, setReq] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!id) return
    getRequest(Number(id))
      .then(setReq)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleAccept(responseId: number) {
    if (!id) return
    setAccepting(responseId)
    try {
      const { orderId } = await acceptResponse(Number(id), responseId)
      navigate(`/orders/${orderId}`)
    } catch (e: unknown) {
      WebApp.showAlert(e instanceof Error ? e.message : t.errors.acceptFail)
    } finally {
      setAccepting(null)
    }
  }

  async function handleClose() {
    if (!id) return
    setClosing(true)
    try {
      const updated = await closeRequest(Number(id))
      setReq(prev => prev ? { ...prev, status: updated.status } : prev)
    } catch (e: unknown) {
      WebApp.showAlert(e instanceof Error ? e.message : t.errors.closeFail)
    } finally {
      setClosing(false)
    }
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B6966' }}>{t.common.loading}</div>
  if (error)   return <div style={{ padding: 24, color: '#E24B4A' }}>{t.common.error}: {error}</div>
  if (!req)    return null

  const isOwner = user?.id === req.customerId
  const date = new Date(req.scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    open:   { bg: '#C0DD9722', color: '#3B6D11',  label: t.requests.open },
    closed: { bg: '#D3D1C722', color: '#5F5E5A',  label: t.requests.closed },
  }

  return (
    <div style={{ backgroundColor: '#F7F6F3', minHeight: '100%' }}>

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
          {t.requests.title} #{req.id}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6,
          backgroundColor: statusStyles[req.status]?.bg ?? '#E8E6E1',
          color: statusStyles[req.status]?.color ?? '#6B6966',
        }}>
          {statusStyles[req.status]?.label ?? req.status}
        </span>
      </div>

      <div style={{ padding: '12px 16px' }}>

        {/* ДЕТАЛИ ЗАПРОСА */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 12, border: '1px solid #E8E6E1',
          padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#1A1917' }}>
            {t.requests.details.city}
          </div>
          {[
            { label: t.requests.details.city, value: `${req.city}${req.district ? `, ${req.district}` : ''}` },
            { label: t.requests.details.date, value: date },
            { label: t.requests.details.format, value: req.format === 'home_visit' ? t.chef.homeVisitFull : t.chef.deliveryFull },
            { label: t.requests.details.persons, value: req.persons },
            ...(req.budget ? [{ label: t.requests.details.budget, value: `${req.budget} ${t.common.currency}` }] : []),
            ...(req.description ? [{ label: t.requests.details.desc, value: req.description }] : []),
          ].map((row, idx, arr) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', padding: '9px 0',
              borderBottom: idx < arr.length - 1 ? '1px solid #E8E6E1' : 'none', fontSize: 14,
            }}>
              <span style={{ color: '#6B6966' }}>{row.label}</span>
              <span style={{
                color: '#1A1917', fontWeight: 500,
                maxWidth: '60%', textAlign: 'right',
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* ОТВЕТЫ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#1A1917' }}>
            {t.requests.responses} ({req.responses.length})
          </div>

          {req.responses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #E8E6E1', color: '#9E9B97', fontSize: 14 }}>
              {t.requests.noResponses}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {req.responses.map(r => (
              <ResponseCard
                key={r.id}
                response={r}
                isOwner={isOwner}
                isOpen={req.status === 'open'}
                accepting={accepting === r.id}
                onAccept={() => handleAccept(r.id)}
              />
            ))}
          </div>
        </div>

        {/* ЧАТ */}
        {isOwner && req.responses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <CustomerChatTabs req={req} />
          </div>
        )}
        {!isOwner && user && req.responses.some(r => r.chefId === user.id) && (
          <div style={{ marginBottom: 16 }}>
            <ChatBox requestId={req.id} chefId={user.id} />
          </div>
        )}

        {/* КНОПКА ОТМЕНЫ */}
        {isOwner && req.status === 'open' && (
          <button
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 12,
              border: '1px solid #E8E6E1', backgroundColor: '#ffffff',
              color: '#6B6966', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              opacity: closing ? 0.6 : 1,
            }}
            disabled={closing}
            onClick={handleClose}
          >
            {closing ? t.requests.closing : t.requests.closeBtn}
          </button>
        )}
      </div>
    </div>
  )
}

function ResponseCard({
  response, isOwner, isOpen, accepting, onAccept,
}: {
  response: ChefResponseItem
  isOwner: boolean
  isOpen: boolean
  accepting: boolean
  onAccept: () => void
}) {
  const t = useT()
  const rating = Number(response.ratingCache)
  const statusColor =
    response.status === 'accepted' ? '#3B6D11' :
    response.status === 'rejected' ? '#5F5E5A' : '#6B6966'

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      backgroundColor: '#ffffff', border: '1px solid #E8E6E1',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <Link
            to={`/chefs/${response.chefProfileId}`}
            style={{ fontWeight: 600, fontSize: 15, color: '#1A1917', textDecoration: 'none' }}
          >
            {response.chefName} →
          </Link>
          <div style={{ fontSize: 13, color: '#BA7517', marginTop: 2 }}>
            {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
            <span style={{ color: '#6B6966', marginLeft: 4 }}>
              {rating > 0 ? rating.toFixed(1) : '—'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>

          {response.proposedPrice && (
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1A1917' }}>{response.proposedPrice} ₾</span>
          )}
          {response.status !== 'new' && (
            <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>
              {response.status === 'accepted' ? t.requests.accepted : t.requests.rejected}
            </span>
          )}
        </div>
      </div>

      {response.comment && (
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: '#1A1917' }}>
          {response.comment}
        </p>
      )}

      {isOwner && isOpen && response.status === 'new' && (
        <button
          style={{
            width: '100%', padding: '11px 16px', borderRadius: 10,
            border: 'none', backgroundColor: '#D85A30',
            color: '#ffffff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            opacity: accepting ? 0.6 : 1,
          }}
          disabled={accepting}
          onClick={onAccept}
        >
          {accepting ? t.requests.accepting : t.requests.acceptBtn}
        </button>
      )}
    </div>
  )
}

function CustomerChatTabs({ req }: { req: RequestDetail }) {
  const [selectedChefId, setSelectedChefId] = useState<number>(
    req.responses[0]?.chefId,
  )

  const selected = req.responses.find(r => r.chefId === selectedChefId)
    ?? req.responses[0]

  return (
    <>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8, scrollbarWidth: 'none' }}>
        {req.responses.map(r => {
          const active = r.chefId === selected.chefId
          return (
            <button
              key={r.chefId}
              onClick={() => setSelectedChefId(r.chefId)}
              style={{
                flex: '0 0 auto',
                padding: '8px 14px',
                borderRadius: 20,
                border: active ? 'none' : '1px solid #E8E6E1',
                background: active ? '#D85A30' : '#ffffff',
                color: active ? '#ffffff' : '#1A1917',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {r.chefName}
            </button>
          )
        })}
      </div>
      <ChatBox key={selected.chefId} requestId={req.id} chefId={selected.chefId} />
    </>
  )
}

