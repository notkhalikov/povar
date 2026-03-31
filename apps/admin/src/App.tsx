import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { authTelegram, type AuthUser } from './api'
import UsersPage from './pages/UsersPage'
import OrdersPage from './pages/OrdersPage'
import DisputesPage from './pages/DisputesPage'
import StatsPage from './pages/StatsPage'

// ─── Auth context ─────────────────────────────────────────────────────────────

interface AuthCtx {
  user: AuthUser | null
  logout: () => void
}

const AuthContext = createContext<AuthCtx>({ user: null, logout: () => {} })
export const useAdminAuth = () => useContext(AuthContext)

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem('admin_user')
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  })

  function logout() {
    localStorage.removeItem('admin_jwt')
    localStorage.removeItem('admin_user')
    setUser(null)
  }

  function onLogin(token: string, u: AuthUser) {
    localStorage.setItem('admin_jwt', token)
    localStorage.setItem('admin_user', JSON.stringify(u))
    setUser(u)
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <BrowserRouter>
        {!user ? (
          <LoginPage onLogin={onLogin} />
        ) : !isAllowed(user.role) ? (
          <div className='denied'>
            <h2>Доступ запрещён</h2>
            <p>Эта панель доступна только администраторам и поддержке.</p>
            <button onClick={logout}>Выйти</button>
          </div>
        ) : (
          <Shell>
            <Routes>
              <Route path='/'          element={<Navigate to='/stats' replace />} />
              <Route path='/stats'     element={<StatsPage />} />
              <Route path='/users'     element={<UsersPage />} />
              <Route path='/orders'    element={<OrdersPage />} />
              <Route path='/disputes'  element={<DisputesPage />} />
            </Routes>
          </Shell>
        )}
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

function isAllowed(role: string) {
  return role === 'admin' || role === 'support'
}

// ─── Login page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (token: string, user: AuthUser) => void }) {
  const [initData, setInitData] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  // Auto-fill if running inside Telegram
  useEffect(() => {
    const tgData = (window as Window & { Telegram?: { WebApp?: { initData?: string } } })
      .Telegram?.WebApp?.initData
    if (tgData) setInitData(tgData)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await authTelegram(initData.trim())
      onLogin(token, user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='login-wrap'>
      <div className='login-card'>
        <h1>Повар — Админка</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Telegram initData
            <textarea
              value={initData}
              onChange={e => setInitData(e.target.value)}
              rows={5}
              placeholder='Вставьте initData из Telegram.WebApp.initData'
              required
            />
          </label>
          {error && <div className='error-msg'>{error}</div>}
          <button type='submit' disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Shell with sidebar ───────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAdminAuth()

  return (
    <div className='shell'>
      <aside className='sidebar'>
        <div className='sidebar-title'>Повар</div>
        <nav>
          <NavLink to='/stats'    className={navCls}>📊 Статистика</NavLink>
          <NavLink to='/users'    className={navCls}>👥 Пользователи</NavLink>
          <NavLink to='/orders'   className={navCls}>📋 Заказы</NavLink>
          <NavLink to='/disputes' className={navCls}>⚖️ Споры</NavLink>
        </nav>
        <div className='sidebar-footer'>
          <span>{user?.name}</span>
          <button onClick={logout}>Выйти</button>
        </div>
      </aside>
      <main className='content'>{children}</main>
    </div>
  )
}

function navCls({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link active' : 'nav-link'
}
