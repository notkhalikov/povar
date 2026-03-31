import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getRequest, acceptResponse, closeRequest } from '../api/requests'
import { useAuth } from '../context/AuthContext'
import type { RequestDetail, ChefResponseItem } from '../types'

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [req, setReq] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)

  const goBack = useCallback(() => navigate('/requests'), [navigate])

  useEffect(() => {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(goBack)
    return () => {
      WebApp.BackButton.hide()
      WebApp.BackButton.offClick(goBack)
    }
  }, [goBack])

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
      WebApp.showAlert(e instanceof Error ? e.message : 'Ошибка при принятии отклика')
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
      WebApp.showAlert(e instanceof Error ? e.message : 'Ошибка при закрытии запроса')
    } finally {
      setClosing(false)
    }
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  if (error)   return <div style={{ padding: 24, color: 'red' }}>Ошибка: {error}</div>
  if (!req)    return null

  const isOwner = user?.id === req.customerId
  const date = new Date(req.scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Запрос #{req.id}</h2>
        <span style={{
          padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600,
          background: req.status === 'open' ? '#34c75922' : '#88888822',
          color: req.status === 'open' ? '#34c759' : '#888',
        }}>
          {req.status === 'open' ? 'Открыт' : 'Закрыт'}
        </span>
      </div>

      {/* Details */}
      <div style={sectionStyle}>
        <Row label='Город'>{req.city}{req.district ? `, ${req.district}` : ''}</Row>
        <Row label='Дата'>{date}</Row>
        <Row label='Формат'>{req.format === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'}</Row>
        <Row label='Людей'>{req.persons}</Row>
        {req.budget && <Row label='Бюджет'>{req.budget} ₾</Row>}
        {req.description && <Row label='Описание'>{req.description}</Row>}
      </div>

      {/* Responses */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>
          Отклики ({req.responses.length})
        </div>

        {req.responses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
            Откликов пока нет. Повара увидят ваш запрос и предложат цену.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

      {/* Close button — owner, open request, no accepted response yet */}
      {isOwner && req.status === 'open' && (
        <div style={{ marginTop: 24 }}>
          <button
            style={closeBtnStyle}
            disabled={closing}
            onClick={handleClose}
          >
            {closing ? 'Закрываем…' : 'Закрыть запрос'}
          </button>
        </div>
      )}
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
  const rating = Number(response.ratingCache)
  const statusColor =
    response.status === 'accepted' ? '#34c759' :
    response.status === 'rejected' ? '#888' : 'var(--tg-theme-hint-color)'

  return (
    <div style={responseCardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{response.chefName}</div>
          <div style={{ fontSize: 13, color: '#f5a623', marginTop: 2 }}>
            {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
            <span style={{ color: 'var(--tg-theme-hint-color)', marginLeft: 4 }}>
              {rating > 0 ? rating.toFixed(1) : '—'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {response.proposedPrice && (
            <span style={{ fontWeight: 700, fontSize: 16 }}>{response.proposedPrice} ₾</span>
          )}
          {response.status !== 'new' && (
            <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>
              {response.status === 'accepted' ? 'Принят' : 'Отклонён'}
            </span>
          )}
        </div>
      </div>

      {response.comment && (
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: 'var(--tg-theme-text-color)' }}>
          {response.comment}
        </p>
      )}

      {isOwner && isOpen && response.status === 'new' && (
        <button
          style={{ ...acceptBtnStyle, opacity: accepting ? 0.6 : 1 }}
          disabled={accepting}
          onClick={onAccept}
        >
          {accepting ? 'Принимаем…' : 'Принять и создать заказ'}
        </button>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--tg-theme-hint-color)22' }}>
      <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14, textAlign: 'right', maxWidth: '60%' }}>{children}</span>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--tg-theme-secondary-bg-color)',
  borderRadius: 12,
  padding: '0 16px',
}

const responseCardStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 12,
  background: 'var(--tg-theme-secondary-bg-color)',
}

const acceptBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

const closeBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  borderRadius: 12,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'transparent',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  cursor: 'pointer',
}
