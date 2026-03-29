import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { createOrder } from '../api/orders'
import { getChef } from '../api/chefs'

export default function OrderNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const chefProfileId = Number(searchParams.get('chefId'))

  const [chefCity, setChefCity] = useState<string>('')
  const [type, setType] = useState<'home_visit' | 'delivery'>('home_visit')
  const [scheduledAt, setScheduledAt] = useState('')
  const [persons, setPersons] = useState(2)
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(goBack)
    return () => {
      WebApp.BackButton.hide()
      WebApp.BackButton.offClick(goBack)
    }
  }, [goBack])

  useEffect(() => {
    if (chefProfileId) {
      getChef(chefProfileId).then(c => setChefCity(c.city ?? 'Tbilisi')).catch(() => setChefCity('Tbilisi'))
    }
  }, [chefProfileId])

  // Default scheduledAt to tomorrow at noon
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(12, 0, 0, 0)
    setScheduledAt(tomorrow.toISOString().slice(0, 16))
  }, [])

  if (!chefProfileId) {
    return <div style={{ padding: 24, color: 'red' }}>Некорректный ID повара</div>
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const order = await createOrder({
        chefProfileId,
        type,
        city: chefCity || 'Tbilisi',
        scheduledAt: new Date(scheduledAt).toISOString(),
        persons,
        address: address || undefined,
        description: description || undefined,
      })
      navigate(`/orders/${order.id}`, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось создать заказ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>Новый заказ</h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Format */}
        <div>
          <FieldLabel>Формат</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['home_visit', 'delivery'] as const).map(f => (
              <button
                key={f}
                type='button'
                onClick={() => setType(f)}
                style={toggleStyle(type === f)}
              >
                {f === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'}
              </button>
            ))}
          </div>
        </div>

        {/* Date & time */}
        <div>
          <FieldLabel>Дата и время</FieldLabel>
          <input
            type='datetime-local'
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        {/* Persons */}
        <div>
          <FieldLabel>Количество человек</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type='button' onClick={() => setPersons(p => Math.max(1, p - 1))} style={counterBtn}>−</button>
            <span style={{ fontSize: 20, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{persons}</span>
            <button type='button' onClick={() => setPersons(p => Math.min(50, p + 1))} style={counterBtn}>+</button>
          </div>
        </div>

        {/* Address */}
        <div>
          <FieldLabel>Адрес {type === 'home_visit' ? '' : '(куда доставить)'}</FieldLabel>
          <input
            type='text'
            placeholder='Ул. Руставели 1, кв. 5'
            value={address}
            onChange={e => setAddress(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Comment */}
        <div>
          <FieldLabel>Комментарий (необязательно)</FieldLabel>
          <textarea
            placeholder='Пожелания по меню, аллергии…'
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {error && (
          <div style={{ color: 'red', fontSize: 14 }}>{error}</div>
        )}

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'var(--tg-theme-bg-color)', borderTop: '1px solid var(--tg-theme-hint-color)' }}>
          <button type='submit' disabled={submitting} style={submitStyle}>
            {submitting ? 'Оформляем…' : 'Оформить заказ'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  boxSizing: 'border-box',
}

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '10px 8px',
    borderRadius: 10,
    border: active ? '2px solid var(--tg-theme-button-color)' : '1px solid var(--tg-theme-hint-color)',
    background: active ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
    color: active ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }
}

const counterBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 22,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const submitStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  opacity: 1,
}
