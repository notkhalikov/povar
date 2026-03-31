import { useEffect, useState } from 'react'
import { getOrders, type AdminOrder } from '../api'

const ORDER_STATUSES = [
  '', 'draft', 'awaiting_payment', 'paid', 'in_progress',
  'completed', 'dispute_pending', 'refunded', 'cancelled',
]

export default function OrdersPage() {
  const [orders, setOrders]   = useState<AdminOrder[]>([])
  const [status, setStatus]   = useState('')
  const [city, setCity]       = useState('')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  function load() {
    setLoading(true)
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (city)   params.city   = city
    if (from)   params.from   = from
    if (to)     params.to     = to
    getOrders(params)
      .then(res => { setOrders(res.data); setError(null) })
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status, city, from, to])

  const statusColor: Record<string, string> = {
    completed: 'green', paid: 'green', in_progress: 'blue',
    cancelled: 'grey', refunded: 'grey', dispute_pending: 'orange',
    draft: 'grey', awaiting_payment: 'blue',
  }

  return (
    <div>
      <h2>Заказы</h2>

      <div className='filters'>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s || 'Все статусы'}</option>)}
        </select>
        <input
          placeholder='Город'
          value={city}
          onChange={e => setCity(e.target.value)}
          style={{ width: 120 }}
        />
        <label>
          С&nbsp;
          <input type='date' value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          По&nbsp;
          <input type='date' value={to} onChange={e => setTo(e.target.value)} />
        </label>
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
                <th>Статус</th>
                <th>Тип</th>
                <th>Город</th>
                <th>Заказчик</th>
                <th>Повар</th>
                <th>Сумма</th>
                <th>Чел.</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td><span className={`badge ${statusColor[o.status] ?? 'grey'}`}>{o.status}</span></td>
                  <td>{o.type === 'home_visit' ? '🏠' : '🚚'}</td>
                  <td>{o.city}{o.district ? `, ${o.district}` : ''}</td>
                  <td>{o.customerName}</td>
                  <td>{o.chefName}</td>
                  <td>{o.agreedPrice ? `${o.agreedPrice} ₾` : '—'}</td>
                  <td>{o.persons}</td>
                  <td>{new Date(o.createdAt).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className='empty'>Нет заказов</div>}
        </div>
      )}
    </div>
  )
}
