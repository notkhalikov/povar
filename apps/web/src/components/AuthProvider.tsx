import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface AuthUser {
  id: number
  name: string
  telegramId: string
  isChef: boolean
  avatarUrl?: string | null
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  token: string | null
  authError: 'no_telegram' | 'fetch_failed' | null
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, token: null, authError: null })
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<'no_telegram' | 'fetch_failed' | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    tg?.ready()
    tg?.expand()

    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      setLoading(false)
      return
    }

    if (!tg?.initData) {
      setAuthError('no_telegram')
      setLoading(false)
      return
    }

    fetch(`${import.meta.env.VITE_API_URL}/auth/telegram-miniapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    })
      .then(r => r.json())
      .then(({ token, user }) => {
        if (token && user) {
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(user))
          setToken(token)
          setUser(user)
          // New user (no role yet) → onboarding, existing → catalog/profile
          if (!user.isChef && !user.onboardingDone) {
            navigate('/onboarding', { replace: true })
          } else {
            navigate(user.isChef ? '/profile' : '/catalog', { replace: true })
          }
        } else {
          setAuthError('fetch_failed')
        }
      })
      .catch(() => setAuthError('fetch_failed'))
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, loading, token, authError }}>
      {children}
    </AuthContext.Provider>
  )
}
