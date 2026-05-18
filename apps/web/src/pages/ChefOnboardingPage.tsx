import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { useAuth } from '../components/AuthProvider'
import { apiFetch } from '../api/client'

const CITIES = ['Тбилиси', 'Батуми', 'Другой']
const CUISINES = ['Грузинская', 'Русская', 'Итальянская', 'Азиатская', 'Средиземноморская', 'Веганская', 'Другая']
const FORMATS = ['На дому', 'Доставка', 'Кейтеринг']

type Step = 1 | 2 | 3 | 4

export default function ChefOnboardingPage() {
  const navigate = useNavigate()
  const { user: tgUser } = useTelegram()
  const { user: apiUser, setUser } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Step 1
  const [name, setName] = useState(tgUser?.first_name || '')
  const [city, setCity] = useState('')

  // Step 2
  const [bio, setBio] = useState('')
  const [cuisines, setCuisines] = useState<string[]>([])

  // Step 3
  const [formats, setFormats] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState('')

  const toggleCuisine = (cuisine: string) => {
    setCuisines(prev =>
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    )
  }

  const toggleFormat = (format: string) => {
    setFormats(prev =>
      prev.includes(format) ? prev.filter(f => f !== format) : [...prev, format]
    )
  }

  const canGoNext = () => {
    if (step === 1) return name && city
    if (step === 2) return bio && cuisines.length > 0
    if (step === 3) return formats.length > 0 && minPrice
    return true
  }

  const handleNext = () => {
    if (!canGoNext()) return
    if (step < 4) {
      setStep((step + 1) as Step)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')

      // Create/update chef profile
      await apiFetch('/chefs/me', {
        method: 'PATCH',
        body: JSON.stringify({
          bio,
          cuisineTags: cuisines,
          workFormats: formats.map(f => (f === 'На дому' ? 'home_visit' : 'delivery')),
          districts: city === 'Другой' ? [] : [city],
          avgPrice: minPrice ? Number(minPrice) : undefined,
          isActive: true,
        }),
      })

      // Update local user state
      if (apiUser) {
        setUser({ ...apiUser, onboardingDone: true })
      }

      navigate('/profile', { replace: true })
    } catch (err) {
      console.error('Onboarding failed:', err)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 20px 40px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1917', margin: '0 0 8px' }}>
          Стань поваром
        </h1>
        <p style={{ fontSize: 14, color: '#6B6966', margin: 0 }}>
          Шаг {step} из 3
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 8,
        }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? '#D85A30' : '#E8E6E1',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, marginBottom: 32 }}>
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#6B6966', fontWeight: 500, marginBottom: 8 }}>
                Ваше имя
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #E8E6E1',
                  fontSize: 15,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#6B6966', fontWeight: 500, marginBottom: 8 }}>
                Город
              </label>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #E8E6E1',
                  fontSize: 15,
                  boxSizing: 'border-box',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="">Выберите город</option>
                {CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#6B6966', fontWeight: 500, marginBottom: 8 }}>
                О себе ({bio.length}/300)
              </label>
              <textarea
                value={bio}
                onChange={e => bio.length <= 300 && setBio(e.target.value)}
                placeholder="Расскажите о вашем кулинарном стиле и опыте"
                style={{
                  width: '100%',
                  minHeight: 120,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #E8E6E1',
                  fontSize: 15,
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#6B6966', fontWeight: 500, marginBottom: 12 }}>
                Специализация
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CUISINES.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCuisine(c)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: `2px solid ${cuisines.includes(c) ? '#D85A30' : '#E8E6E1'}`,
                      backgroundColor: cuisines.includes(c) ? '#FEF0EB' : '#ffffff',
                      color: cuisines.includes(c) ? '#D85A30' : '#1A1917',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                  >
                    {cuisines.includes(c) ? '✓ ' : ''}{c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#6B6966', fontWeight: 500, marginBottom: 12 }}>
                Формат работы
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FORMATS.map(f => (
                  <button
                    key={f}
                    onClick={() => toggleFormat(f)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: `2px solid ${formats.includes(f) ? '#D85A30' : '#E8E6E1'}`,
                      backgroundColor: formats.includes(f) ? '#FEF0EB' : '#ffffff',
                      color: formats.includes(f) ? '#D85A30' : '#1A1917',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                  >
                    {formats.includes(f) ? '✓ ' : ''}{f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#6B6966', fontWeight: 500, marginBottom: 8 }}>
                Минимальная сумма заказа (₾)
              </label>
              <input
                type="number"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                placeholder="100"
                min="0"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #E8E6E1',
                  fontSize: 15,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{
            backgroundColor: '#F7F6F3',
            borderRadius: 16,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1917', margin: '0 0 16px' }}>
                Ваш профиль повара
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, color: '#6B6966', margin: '0 0 4px' }}>Имя</p>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: 0 }}>{name}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#6B6966', margin: '0 0 4px' }}>Город</p>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: 0 }}>{city}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#6B6966', margin: '0 0 4px' }}>О себе</p>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: 0 }}>{bio}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#6B6966', margin: '0 0 4px' }}>Специализация</p>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: 0 }}>
                    {cuisines.join(', ')}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#6B6966', margin: '0 0 4px' }}>Форматы</p>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: 0 }}>
                    {formats.join(', ')}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#6B6966', margin: '0 0 4px' }}>Минимальный заказ</p>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1917', margin: 0 }}>
                    {minPrice} ₾
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12 }}>
        {step > 1 && (
          <button
            onClick={() => setStep((step - 1) as Step)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid #D85A30',
              backgroundColor: '#ffffff',
              color: '#D85A30',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            ← Назад
          </button>
        )}

        <button
          onClick={handleNext}
          disabled={!canGoNext() || loading}
          style={{
            flex: 1,
            padding: '14px 16px',
            borderRadius: 12,
            backgroundColor: canGoNext() ? '#D85A30' : '#ccc',
            color: '#ffffff',
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            cursor: canGoNext() ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Загрузка...' : step === 3 ? 'Начать работу 🎉' : 'Далее →'}
        </button>
      </div>
    </div>
  )
}
