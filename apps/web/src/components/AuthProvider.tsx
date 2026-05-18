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
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, token: null })
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, token }}>
      {children}
    </AuthContext.Provider>
  )
}
