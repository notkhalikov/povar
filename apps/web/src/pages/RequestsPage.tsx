import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRequests, createRequest } from '../api/requests'
import { useAuth } from '../components/AuthProvider'
import { Avatar } from '../components/Avatar'
import type { RequestItem } from '../types'
import { useT } from '../i18n'

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
  const t = useT()
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1A1917', margin: 0 }}>
          {t.requests.title}
        </h1>
        {user?.role !== 'chef' && (
          <button onClick={() => setShowForm(v => !v)}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              backgroundColor: showForm ? '#ffffff' : '#D85A30',
              color: showForm ? '#D85A30' : '#ffffff',
              border: showForm ? '1px solid #D85A30' : 'none',
              cursor: 'pointer',
            }}
          >
            {showForm ? t.common.cancel : t.requests.create}
          </button>
        )}
      </div>

      <div style={{ padding: '12px 16px' }}>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{
          padding: '16px', borderRadius: 12, backgroundColor: '#ffffff',
          border: '1px solid #E8E6E1', marginBottom: 16,
        }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, color: '#1A1917' }}>{t.requests.newRequest}</div>

          <Field label={t.requests.cityLabel}>
            <select value={form.city} onChange={e => set('city', e.target.value)} style={{
              width: '100%', padding: '11px 13px', borderRadius: 10,
              border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
              color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
            }}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label={t.requests.districtLabel}>
            <input
              value={form.district}
              onChange={e => set('district', e.target.value)}
              placeholder={t.requests.districtPlaceholder}
              style={{
                width: '100%', padding: '11px 13px', borderRadius: 10,
                border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
                color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </Field>

          <Field label={t.requests.dateLabel}>
            <input
              type='datetime-local'
              value={form.scheduledAt}
              onChange={e => set('scheduledAt', e.target.value)}
              required
              style={{
                width: '100%', padding: '11px 13px', borderRadius: 10,
                border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
                color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </Field>

          <Field label={t.requests.formatLabel}>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['home_visit', 'delivery'] as const).map(f => (
                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 15, color: '#1A1917' }}>
                  <input
                    type='radio'
                    name='format'
                    checked={form.format === f}
                    onChange={() => set('format', f)}
                    style={{ accentColor: '#D85A30', cursor: 'pointer' }}
                  />
                  {f === 'home_visit' ? t.chef.homeVisitFull : t.chef.deliveryFull}
                </label>
              ))}
            </div>
          </Field>

          <Field label={t.requests.personsLabel}>
            <input
              type='number'
              value={form.persons}
              onChange={e => set('persons', e.target.value)}
              min={1} max={50} required
              style={{
                width: '100%', padding: '11px 13px', borderRadius: 10,
                border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
                color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </Field>

          <Field label={t.requests.descLabel}>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={t.requests.descPlaceholder}
              rows={3}
              style={{
                width: '100%', padding: '11px 13px', borderRadius: 10,
                border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
                color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none',
                fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </Field>

          <Field label={t.requests.budgetLabel}>
            <input
              type='number'
              value={form.budget}
              onChange={e => set('budget', e.target.value)}
              min={0}
              placeholder='200'
              style={{
                width: '100%', padding: '11px 13px', borderRadius: 10,
                border: '1px solid #E8E6E1', backgroundColor: '#F7F6F3',
                color: '#1A1917', fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
              }}
            />
          </Field>

          <button type='submit' disabled={saving} style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            backgroundColor: '#D85A30', color: '#ffffff', fontSize: 14, fontWeight: 500,
            border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1, marginTop: 4,
          }}>
            {saving ? t.requests.creating : t.requests.submitCreate}
          </button>
        </form>
      )}

      {/* Empty state for customers */}
      {user?.role !== 'chef' && items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <p style={{ fontSize: 40, margin: 0 }}>📋</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#666', marginBottom: 8 }}>
            Нет запросов
          </p>
          <p style={{ fontSize: 14, color: '#aaa', marginBottom: 24 }}>
            Найдите повара и отправьте запрос
          </p>
          <button onClick={() => navigate('/catalog')}
            style={{
              padding: '12px 28px', borderRadius: 12,
              backgroundColor: '#D85A30', color: '#fff',
              border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Найти повара
          </button>
        </div>
      )}

      {/* List of requests */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          user?.role === 'chef' ? (
            // Chef view: open requests to respond to
            <RequestCard key={item.id} item={item} onClick={() => navigate(`/requests/${item.id}`)} />
          ) : (
            // Customer view: their own requests
            <CustomerRequestCard key={item.id} req={item} onClick={() => navigate(`/requests/${item.id}`)} />
          )
        ))}
      </div>
      </div>
    </div>
  )
}

function RequestCard({ item, onClick }: { item: RequestItem; onClick: () => void }) {
  const t = useT()
  const date = new Date(item.scheduledAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div onClick={onClick} style={{
      padding: '14px 16px', borderRadius: 12, backgroundColor: '#ffffff',
      border: '1px solid #E8E6E1', cursor: 'pointer',
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
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, flexShrink: 0,
          backgroundColor: item.status === 'open' ? '#C0DD9722' : '#D3D1C722',
          color: item.status === 'open' ? '#3B6D11' : '#5F5E5A',
        }}>
          {item.status === 'open' ? t.requests.open : t.requests.closed}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#9E9B97' }}>
        <span>📅 {date}</span>
        {item.budget && <span>💰 {t.common.upTo} {item.budget} {t.common.currency}</span>}
        <span>💬 {item.responseCount} {plural(item.responseCount, t.requests.responseCount.one, t.requests.responseCount.few, t.requests.responseCount.many)}</span>
      </div>
    </div>
  )
}

function CustomerRequestCard({ req, onClick }: { req: RequestItem; onClick: () => void }) {
  const t = useT()
  const dateStr = new Date(req.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short',
  })

  const isDirectRequest = (req as any).chefId !== null && (req as any).chefId !== undefined
  const chef = (req as any).chef

  return (
    <div onClick={onClick}
      style={{
        padding: '16px', backgroundColor: '#fff',
        borderRadius: 16, marginBottom: 12,
        border: '1.5px solid #f0f0f0', cursor: 'pointer',
      }}
    >
      {isDirectRequest && chef ? (
        // Direct request - show chef info
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <Avatar src={chef.avatarUrl} name={chef.name ?? '?'} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1A1917' }}>{chef.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{dateStr}</p>
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 8,
              backgroundColor: req.status === 'open' ? '#B5D4F4' : '#C0DD97',
              color: req.status === 'open' ? '#185FA5' : '#3B6D11',
              flexShrink: 0, marginLeft: 8,
            }}>
              {req.status === 'open' ? 'Ожидание' : 'Принят'}
            </span>
          </div>

          {req.description && (
            <p style={{
              margin: 0, fontSize: 14, color: '#555',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 8,
            }}>
              {req.description}
            </p>
          )}

          {req.status === 'open' && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              backgroundColor: '#fffbeb', borderRadius: 10,
              fontSize: 13, color: '#d97706', fontWeight: 500,
            }}>
              ⏳ Ожидаем ответа повара
            </div>
          )}

          {req.status === 'closed' && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              backgroundColor: '#f0fdf4', borderRadius: 10,
              fontSize: 13, color: '#16a34a', fontWeight: 600,
            }}>
              ✓ Запрос принят
            </div>
          )}
        </>
      ) : (
        // Open request - show location and response count
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1A1917' }}>
                {req.city}{req.district ? `, ${req.district}` : ''}
              </div>
              <div style={{ fontSize: 13, color: '#6B6966', marginTop: 2 }}>
                {req.format === 'home_visit' ? t.chef.homeVisitFull : t.chef.deliveryFull} · 👥 {req.persons}
              </div>
            </div>
            <span style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, flexShrink: 0,
              backgroundColor: req.status === 'open' ? '#C0DD9722' : '#D3D1C722',
              color: req.status === 'open' ? '#3B6D11' : '#5F5E5A',
            }}>
              {req.status === 'open' ? t.requests.open : t.requests.closed}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#9E9B97' }}>
            <span>📅 {dateStr}</span>
            {req.budget && <span>💰 {t.common.upTo} {req.budget} {t.common.currency}</span>}
            <span>💬 {req.responseCount}</span>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: '#6B6966', marginBottom: 6, fontWeight: 500 }}>{label}</div>
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

