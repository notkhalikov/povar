import { useEffect, useState } from 'react'
import { getUsers, patchUserStatus, type AdminUser } from '../api'

const ROLES   = ['', 'customer', 'chef', 'support', 'admin']
const STATUSES = ['', 'active', 'banned']

export default function UsersPage() {
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [role, setRole]       = useState('')
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [acting, setActing]   = useState<number | null>(null)

  function load() {
    setLoading(true)
    const params: Record<string, string> = {}
    if (role)   params.role   = role
    if (status) params.status = status
    getUsers(params)
      .then(res => { setUsers(res.data); setError(null) })
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [role, status])

  async function toggleBan(u: AdminUser) {
    setActing(u.id)
    try {
      const updated = await patchUserStatus(u.id, u.status === 'active' ? 'banned' : 'active')
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: updated.status } : x))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      <h2>Пользователи</h2>

      <div className='filters'>
        <select value={role} onChange={e => setRole(e.target.value)}>
          {ROLES.map(r => <option key={r} value={r}>{r || 'Все роли'}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'Все статусы'}</option>)}
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
                <th>Telegram ID</th>
                <th>Имя</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Город</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.telegramId}</td>
                  <td>{u.name}</td>
                  <td><span className={`badge role-${u.role}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.status === 'banned' ? 'red' : 'green'}`}>{u.status}</span></td>
                  <td>{u.city ?? '—'}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <button
                      className={u.status === 'active' ? 'btn-danger' : 'btn-ok'}
                      disabled={acting === u.id}
                      onClick={() => toggleBan(u)}
                    >
                      {acting === u.id ? '…' : u.status === 'active' ? 'Бан' : 'Разбан'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className='empty'>Нет пользователей</div>}
        </div>
      )}
    </div>
  )
}
