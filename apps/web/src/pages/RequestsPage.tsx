import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRequests, createRequest } from '../api/requests'
import { useAuth } from '../context/AuthContext'
import type { RequestItem } from '../types'

const CITIES = ['Тбилиси', 'Батуми']

type FormState = {
  city: string
  district: string
  scheduledAt: string
  format: 'home_visit' | 'delivery'
  persons: string
  description: string
  budget: string
}

const BLANK_FORM: FormState = {
  city: CITIES[0],
  district: '',
  scheduledAt: '',
  format: 'home_visit',
  persons: '2',
  description: '',
  budget: '',
}

export default function RequestsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [items, setItems] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getRequests()
      .then(res => setItems(res.data))
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createRequest({
        city:        form.city,
        district:    form.district || undefined,
        scheduledAt: form.scheduledAt,
        format:      form.format,
        persons:     Number(form.persons),
        description: form.description || undefined,
        budget:      form.budget ? Number(form.budget) : undefined,
      })
      setItems(prev => [{ ...created, responseCount: 0 }, ...prev])
      setShowForm(false)
      setForm(BLANK_FORM)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  }

  return (
    <div style={{ padding: '12px 16px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Запросы</h2>
        {user?.role !== 'chef' && (
          <button style={createBtnStyle} onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Отмена' : '+ Создать'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} style={formCardStyle}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Новый запрос</div>

          <Field label='Город'>
            <select value={form.city} onChange={e => set('city', e.target.value)} style={inputStyle}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label='Район (необязательно)'>
            <input
              value={form.district}
              onChange={e => set('district', e.target.value)}
              placeholder='Ваке, Сабуртало…'
              style={inputStyle}
            />
          </Field>

          <Field label='Дата и время'>
            <input
              type='datetime-local'
              value={form.scheduledAt}
              onChange={e => set('scheduledAt', e.target.value)}
              required
              style={inputStyle}
            />
          </Field>

          <Field label='Формат'>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['home_visit', 'delivery'] as const).map(f => (
                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 15 }}>
                  <input
                    type='radio'
                    name='format'
                    checked={form.format === f}
                    onChange={() => set('format', f)}
                  />
                  {f === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'}
                </label>
              ))}
            </div>
          </Field>

          <Field label='Количество человек'>
            <input
              type='number'
              value={form.persons}
              onChange={e => set('persons', e.target.value)}
              min={1} max={50} required
              style={inputStyle}
            />
          </Field>

          <Field label='Описание (кухня, пожелания)'>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder='Хотим грузинскую кухню, без острого…'
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          <Field label='Бюджет GEL (необязательно)'>
            <input
              type='number'
              value={form.budget}
              onChange={e => set('budget', e.target.value)}
              min={0}
              placeholder='200'
              style={inputStyle}
            />
          </Field>

          <button type='submit' disabled={saving} style={{ ...submitBtnStyle, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Создаём…' : 'Создать запрос'}
          </button>
        </form>
      )}

      {/* List */}
      {items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📩</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Запросов пока нет</div>
          <div style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>
            Создайте запрос и повара сами предложат цену
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <RequestCard key={item.id} item={item} onClick={() => navigate(`/requests/${item.id}`)} />
        ))}
      </div>
    </div>
  )
}

function RequestCard({ item, onClick }: { item: RequestItem; onClick: () => void }) {
  const date = new Date(item.scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div onClick={onClick} style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {item.city}{item.district ? `, ${item.district}` : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginTop: 2 }}>
            {item.format === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'} · 👥 {item.persons} чел.
          </div>
        </div>
        <span style={{ ...statusBadge, background: item.status === 'open' ? '#34c75922' : '#88888822', color: item.status === 'open' ? '#34c759' : '#888' }}>
          {item.status === 'open' ? 'Открыт' : 'Закрыт'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
        <span>📅 {date}</span>
        {item.budget && <span>💰 до {item.budget} ₾</span>}
        <span>💬 {item.responseCount} {plural(item.responseCount, 'отклик', 'отклика', 'откликов')}</span>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

const cardStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  background: 'var(--tg-theme-secondary-bg-color)',
  cursor: 'pointer',
}

const formCardStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: 14,
  background: 'var(--tg-theme-secondary-bg-color)',
  marginBottom: 20,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 10,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'var(--tg-theme-bg-color)',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  boxSizing: 'border-box',
  outline: 'none',
}

const createBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const submitBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 4,
}

const statusBadge: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  flexShrink: 0,
}
