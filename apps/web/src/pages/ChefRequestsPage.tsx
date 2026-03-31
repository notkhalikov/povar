import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getRequests, respondToRequest } from '../api/requests'
import type { RequestItem } from '../types'

export default function ChefRequestsPage() {
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
      WebApp.showAlert('Отклик отправлен! Заказчик получит уведомление.')
    } catch (err: unknown) {
      WebApp.showAlert(err instanceof Error ? err.message : 'Ошибка при отправке отклика')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  }

  return (
    <div style={{ padding: '12px 16px 80px' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Входящие запросы</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--tg-theme-hint-color)', fontSize: 13 }}>
        Запросы заказчиков, совпадающие с вашим городом и форматом работы
      </p>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Новых запросов нет</div>
          <div style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
            Убедитесь, что в анкете указаны город и форматы работы
          </div>
          <button
            style={linkBtnStyle}
            onClick={() => navigate('/chef/onboarding')}
          >
            Редактировать анкету
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
            {respondingTo === item.id && (
              <form onSubmit={handleRespond} style={respondFormStyle}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Ваш отклик</div>

                <div style={{ marginBottom: 14 }}>
                  <div style={labelStyle}>Предлагаемая цена GEL (необязательно)</div>
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
                  <div style={labelStyle}>Комментарий</div>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder='Расскажите о себе, меню, условиях…'
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
                    Отмена
                  </button>
                  <button
                    type='submit'
                    style={{ ...submitBtnStyle, flex: 2, opacity: sending ? 0.6 : 1 }}
                    disabled={sending}
                  >
                    {sending ? 'Отправляем…' : 'Откликнуться'}
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
            {item.format === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'} · 👥 {item.persons} чел.
          </div>
        </div>
        {item.budget && (
          <span style={{ fontSize: 14, fontWeight: 600 }}>до {item.budget} ₾</span>
        )}
      </div>

      {item.description && (
        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: 'var(--tg-theme-text-color)' }}>
          {item.description}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>📅 {date}</span>
        <button
          style={{ ...respondBtnStyle, opacity: isResponding ? 0.5 : 1 }}
          onClick={onRespond}
          disabled={isResponding}
        >
          Откликнуться
        </button>
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
