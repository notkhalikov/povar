import { useEffect, useState } from 'react'
import { getDisputes, resolveDispute, type AdminDispute } from '../api'

const DISPUTE_STATUSES = ['', 'open', 'awaiting_other_party', 'support_review', 'resolved']

export default function DisputesPage() {
  const [disputes, setDisputes]   = useState<AdminDispute[]>([])
  const [status, setStatus]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [selected, setSelected]   = useState<AdminDispute | null>(null)

  function load() {
    setLoading(true)
    const params: Record<string, string> = {}
    if (status) params.status = status
    getDisputes(params)
      .then(res => { setDisputes(res.data); setError(null) })
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status])

  function onResolved(updated: AdminDispute) {
    setDisputes(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
    setSelected(null)
  }

  const statusColor: Record<string, string> = {
    open: 'orange', support_review: 'blue',
    awaiting_other_party: 'blue', resolved: 'green',
  }

  return (
    <div>
      <h2>Споры</h2>

      <div className='filters'>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          {DISPUTE_STATUSES.map(s => <option key={s} value={s}>{s || 'Все'}</option>)}
        </select>
        <button onClick={load}>Обновить</button>
      </div>

      {error   && <div className='error-msg'>{error}</div>}
      {loading && <div className='loading'>Загрузка…</div>}

      {!loading && (
        <div className='table-wrap'>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Заказ</th>
                <th>Открыл</th>
                <th>Причина</th>
                <th>Заказчик</th>
                <th>Повар</th>
                <th>Статус</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {disputes.map(d => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>#{d.orderId}</td>
                  <td>{d.openedBy}</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.reasonCode}
                  </td>
                  <td>{d.customerName}</td>
                  <td>{d.chefName}</td>
                  <td><span className={`badge ${statusColor[d.status] ?? 'grey'}`}>{d.status}</span></td>
                  <td>{new Date(d.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td>
                    {d.status !== 'resolved' && (
                      <button className='btn-primary' onClick={() => setSelected(d)}>
                        Рассмотреть
                      </button>
                    )}
                    {d.status === 'resolved' && (
                      <span style={{ color: '#888', fontSize: 13 }}>{d.resolutionType}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {disputes.length === 0 && <div className='empty'>Нет споров</div>}
        </div>
      )}

      {selected && (
        <ResolveModal
          dispute={selected}
          onClose={() => setSelected(null)}
          onResolved={onResolved}
        />
      )}
    </div>
  )
}

// ─── Resolve modal ────────────────────────────────────────────────────────────

function ResolveModal({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: AdminDispute
  onClose: () => void
  onResolved: (d: AdminDispute) => void
}) {
  const [resolutionType, setResolutionType] = useState('full_refund')
  const [comment, setComment]               = useState('')
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await resolveDispute(dispute.id, {
        resolutionType,
        resolutionComment: comment || undefined,
      })
      onResolved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='modal-overlay' onClick={onClose}>
      <div className='modal' onClick={e => e.stopPropagation()}>
        <h3>Спор #{dispute.id} — Заказ #{dispute.orderId}</h3>

        <div className='modal-section'>
          <div><b>Открыл:</b> {dispute.openedBy === 'customer' ? dispute.customerName : dispute.chefName}</div>
          <div><b>Причина:</b> {dispute.reasonCode}</div>
          {dispute.description && <div className='modal-desc'>{dispute.description}</div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 14 }}>
            <span>Заказчик: {dispute.customerName}</span>
            <span>Повар: {dispute.chefName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className='field'>
            <label>Решение</label>
            <div className='radio-group'>
              {[
                ['full_refund',    'Полный возврат'],
                ['partial_refund', 'Частичный возврат'],
                ['no_refund',      'Отказ в возврате'],
              ].map(([val, lbl]) => (
                <label key={val} className='radio-label'>
                  <input
                    type='radio'
                    name='resolution'
                    value={val}
                    checked={resolutionType === val}
                    onChange={() => setResolutionType(val)}
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          <div className='field'>
            <label>Комментарий</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder='Объяснение решения (опционально)'
            />
          </div>

          {error && <div className='error-msg'>{error}</div>}

          <div className='modal-actions'>
            <button type='button' onClick={onClose} disabled={saving}>Отмена</button>
            <button type='submit' className='btn-primary' disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить решение'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
