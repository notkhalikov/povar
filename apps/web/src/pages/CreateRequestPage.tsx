import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { apiFetch } from '../api/client'

export default function CreateRequestPage() {
  const navigate = useNavigate()
  const { chefId } = useParams()
  const location = useLocation()
  const chefName = location.state?.chefName ?? 'повару'

  const [form, setForm] = useState({
    description: '',
    guestCount: 2,
    date: '',
    budget: '',
    address: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!form.description || !form.date) return
    setLoading(true)
    setError(null)

    try {
      const body = {
        description: form.description,
        guestCount: Number(form.guestCount),
        date: new Date(form.date).toISOString(),
        budget: form.budget ? Number(form.budget) : undefined,
        address: form.address || undefined,
        chefId: Number(chefId),
      }

      const data = await apiFetch<{ id: number }>('/requests', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (data.id) {
        navigate(`/requests/${data.id}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки запроса')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #eee',
    fontSize: 15,
    outline: 'none' as const,
    boxSizing: 'border-box' as const,
    marginBottom: 16,
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#fff' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px 12px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
        >
          ←
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Новый запрос</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Для: {chefName}</p>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <label style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>ЧТО ПРИГОТОВИТЬ *</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Опишите что хотите заказать, кухню, особые пожелания..."
          style={{ ...inputStyle, minHeight: 100, resize: 'none', marginTop: 6 }}
        />

        <label style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>ДАТА И ВРЕМЯ *</label>
        <input
          type="datetime-local"
          value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          style={{ ...inputStyle, marginTop: 6 }}
        />

        <label style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>КОЛИЧЕСТВО ГОСТЕЙ</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 16 }}>
          {[1, 2, 4, 6, 8, 10].map(n => (
            <button
              key={n}
              onClick={() => setForm(f => ({ ...f, guestCount: n }))}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                border: form.guestCount === n ? '2px solid #D85A30' : '2px solid #eee',
                backgroundColor: form.guestCount === n ? '#FEF0EB' : '#fff',
                color: form.guestCount === n ? '#D85A30' : '#666',
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>БЮДЖЕТ (GEL)</label>
        <input
          type="number"
          value={form.budget}
          onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
          placeholder="Например: 150"
          style={{ ...inputStyle, marginTop: 6 }}
        />

        <label style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>АДРЕС</label>
        <input
          type="text"
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="Улица, дом"
          style={{ ...inputStyle, marginTop: 6 }}
        />

        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#FFF5F2',
              borderRadius: 8,
              borderLeft: '3px solid #D85A30',
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 12, color: '#D85A30', margin: 0 }}>⚠️ {error}</p>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!form.description || !form.date || loading}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: !form.description || !form.date ? '#ccc' : '#D85A30',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            cursor: !form.description || !form.date ? 'not-allowed' : 'pointer',
            marginTop: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Отправка...' : 'Отправить запрос →'}
        </button>
      </div>
    </div>
  )
}
