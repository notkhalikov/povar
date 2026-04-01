import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { createOrder } from '../api/orders'
import { getChef } from '../api/chefs'

const STEPS = 4

export default function OrderNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const chefProfileId = Number(searchParams.get('chefId'))

  const [chefCity, setChefCity]       = useState<string>('')
  const [chefName, setChefName]       = useState<string>('')
  const [type, setType]               = useState<'home_visit' | 'delivery'>('home_visit')
  const [scheduledAt, setScheduledAt] = useState('')
  const [persons, setPersons]         = useState(2)
  const [address, setAddress]         = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [step, setStep]               = useState(1)

  // Use ref so MainButton handler never goes stale
  const handleNextRef = useRef<() => void>(() => {})

  const goBack = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(goBack)
    return () => { WebApp.BackButton.hide(); WebApp.BackButton.offClick(goBack) }
  }, [goBack])

  useEffect(() => {
    if (chefProfileId) {
      getChef(chefProfileId)
        .then(c => { setChefCity(c.city ?? 'Tbilisi'); setChefName(c.name) })
        .catch(() => setChefCity('Tbilisi'))
    }
  }, [chefProfileId])

  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(12, 0, 0, 0)
    setScheduledAt(tomorrow.toISOString().slice(0, 16))
  }, [])

  // Wire up MainButton once
  useEffect(() => {
    const handler = () => handleNextRef.current()
    WebApp.MainButton.show()
    WebApp.MainButton.onClick(handler)
    return () => { WebApp.MainButton.offClick(handler); WebApp.MainButton.hide() }
  }, [])

  // Update MainButton text + state whenever step/submitting change
  useEffect(() => {
    WebApp.MainButton.setText(step < STEPS ? 'Далее' : 'Оформить заказ')
    if (submitting) {
      WebApp.MainButton.showProgress(false)
      WebApp.MainButton.disable()
    } else {
      WebApp.MainButton.hideProgress()
      WebApp.MainButton.enable()
    }
  }, [step, submitting])

  // Keep ref current
  useEffect(() => {
    handleNextRef.current = handleNext
  })

  async function doSubmit() {
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
      setStep(4)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    if (step < STEPS) {
      setStep(s => s + 1)
    } else {
      doSubmit()
    }
  }

  if (!chefProfileId) {
    return <div style={{ padding: 24, color: 'var(--color-danger)' }}>Некорректный ID повара</div>
  }

  return (
    <div style={{ padding: '16px 16px 24px', minHeight: '100vh' }}>

      {/* ── Stepper ───────────────────────────────────────────────── */}
      <div className='stepper' style={{ marginBottom: 24 }}>
        {Array.from({ length: STEPS }, (_, i) => {
          const n = i + 1
          const cls = n < step ? 'done' : n === step ? 'current' : 'todo'
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              {n > 1 && <div className={`stepper-line${n <= step ? ' done' : ''}`} />}
              <div className={`stepper-dot ${cls}`}>{n < step ? '✓' : n}</div>
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Type ──────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Выберите формат</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['home_visit', 'delivery'] as const).map(f => {
              const active = type === f
              return (
                <button
                  key={f}
                  type='button'
                  onClick={() => setType(f)}
                  style={{
                    padding: '20px 16px',
                    borderRadius: 16,
                    border: `2px solid ${active ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)'}`,
                    background: active ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
                    color: active ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: 40 }}>{f === 'home_visit' ? '🏠' : '🚚'}</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                      {f === 'home_visit' ? 'Повар на дом' : 'Доставка'}
                    </div>
                    <div style={{ fontSize: 13, opacity: .75 }}>
                      {f === 'home_visit'
                        ? 'Повар приедет к вам и приготовит блюда на месте'
                        : 'Готовые блюда доставят по вашему адресу'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Date, address ─────────────────────────────────── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Дата и адрес</h3>

          <div>
            <div className='section-label'>Дата и время</div>
            <input
              type='datetime-local'
              className='field-input'
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              required
            />
          </div>

          <div>
            <div className='section-label'>
              {type === 'home_visit' ? 'Адрес (ваш)' : 'Адрес доставки'}
            </div>
            <input
              type='text'
              className='field-input'
              placeholder='Ул. Руставели 1, кв. 5'
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Step 3: Persons + description ────────────────────────── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Детали</h3>

          <div>
            <div className='section-label'>Количество человек</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <button
                type='button'
                onClick={() => setPersons(p => Math.max(1, p - 1))}
                style={counterBtnStyle}
              >
                −
              </button>
              <span style={{
                width: 64, textAlign: 'center', fontSize: 24, fontWeight: 700,
              }}>
                {persons}
              </span>
              <button
                type='button'
                onClick={() => setPersons(p => Math.min(50, p + 1))}
                style={counterBtnStyle}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <div className='section-label'>Комментарий (необязательно)</div>
            <textarea
              className='field-input'
              placeholder='Пожелания по меню, аллергии…'
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      )}

      {/* ── Step 4: Confirmation ──────────────────────────────────── */}
      {step === 4 && (
        <div>
          <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>Подтверждение</h3>

          <div className='card'>
            <div className='detail-row'>
              <span className='detail-row__label'>Повар</span>
              <span className='detail-row__value'>{chefName || `#${chefProfileId}`}</span>
            </div>
            <div className='detail-row'>
              <span className='detail-row__label'>Формат</span>
              <span className='detail-row__value'>{type === 'home_visit' ? '🏠 На дом' : '🚚 Доставка'}</span>
            </div>
            <div className='detail-row'>
              <span className='detail-row__label'>Дата и время</span>
              <span className='detail-row__value'>
                {scheduledAt
                  ? new Date(scheduledAt).toLocaleString('ru-RU', {
                      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
            <div className='detail-row'>
              <span className='detail-row__label'>Людей</span>
              <span className='detail-row__value'>{persons}</span>
            </div>
            {address && (
              <div className='detail-row'>
                <span className='detail-row__label'>Адрес</span>
                <span className='detail-row__value'>{address}</span>
              </div>
            )}
            {description && (
              <div className='detail-row'>
                <span className='detail-row__label'>Комментарий</span>
                <span className='detail-row__value'>{description}</span>
              </div>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 14, lineHeight: 1.5 }}>
            После создания заказа повар сможет уточнить детали и предложить цену.
            Оплата производится после согласования.
          </p>

          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--color-danger)' + '18',
              color: 'var(--color-danger)',
              fontSize: 14, marginTop: 12,
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* In-page back (steps 2-4) */}
      {step > 1 && (
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={submitting}
          style={{
            marginTop: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--tg-theme-hint-color)', fontSize: 14,
            padding: '8px 0', minHeight: 44, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Назад
        </button>
      )}
    </div>
  )
}

const counterBtnStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 24,
  border: '1.5px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 24,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}
