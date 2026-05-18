import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface AuthUser {
  id: number
  name: string
  telegramId: string
  isChef: boolean
  role?: string | null
  avatarUrl?: string | null
  onboardingDone?: boolean
  portfolioPhotos?: string[]
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  token: string | null
  authError: 'no_telegram' | 'fetch_failed' | null
  setUser: (user: AuthUser) => void
  completeOnboarding: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  authError: null,
  setUser: () => {},
  completeOnboarding: () => {},
})
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<'no_telegram' | 'fetch_failed' | null>(null)
  const navigate = useNavigate()

  function setUser(newUser: AuthUser) {
    setUserState(newUser)
    localStorage.setItem('user', JSON.stringify(newUser))
  }

  function completeOnboarding() {
    if (user) {
      const updated = { ...user, onboardingDone: true }
      setUser(updated)
    }
  }

  useEffect(() => {
    console.log('[Auth] VITE_API_URL:', import.meta.env.VITE_API_URL)
    console.log('[Auth] Telegram WebApp:', !!(window as any).Telegram?.WebApp)
    console.log('[Auth] initData length:', (window as any).Telegram?.WebApp?.initData?.length ?? 0)
    console.log('[Auth] saved token:', !!localStorage.getItem('token'))

    const tg = (window as any).Telegram?.WebApp
    tg?.ready()
    tg?.expand()

    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      console.log('[Auth] using saved token, fetching fresh user data')
      setToken(savedToken)
      const cachedUser = JSON.parse(savedUser)

      // Fetch fresh user data to ensure role and avatar are current
      fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then(r => {
          console.log('[Auth] /users/me response status:', r.status)
          if (!r.ok) throw new Error(`Failed to fetch user: ${r.status}`)
          return r.json()
        })
        .then(freshUser => {
          console.log('[Auth] fresh user data loaded:', {
            id: freshUser.id,
            role: freshUser.role,
            isChef: freshUser.isChef,
            hasAvatar: !!freshUser.avatarUrl,
          })
          setUserState(freshUser)
          localStorage.setItem('user', JSON.stringify(freshUser))
        })
        .catch(err => {
          console.error('[Auth] failed to fetch fresh user, using cached:', err.message)
          console.log('[Auth] cached user has:', {
            id: cachedUser.id,
            role: cachedUser.role,
            hasAvatar: !!cachedUser.avatarUrl,
          })
          setUserState(cachedUser)
        })
        .finally(() => setLoading(false))
      return
    }

    if (!tg?.initData) {
      console.log('[Auth] no initData, not in Telegram')
      setAuthError('no_telegram')
      setLoading(false)
      return
    }

    const url = `${import.meta.env.VITE_API_URL}/auth/telegram-miniapp`
    console.log('[Auth] fetching:', url)
    console.log('[Auth] initData length:', tg.initData.length)

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    })
      .then(r => {
        console.log('[Auth] fetch response status:', r.status)
        return r.json()
      })
      .then(({ token, user }) => {
        console.log('[Auth] auth response received, token:', !!token, 'user:', !!user)
        if (token && user) {
          console.log('[Auth] token and user present, saving to localStorage')
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(user))
          setToken(token)
          setUserState(user)
          // Redirect based on isChef flag
          const destination = user.isChef ? '/profile' : '/catalog'
          console.log('[Auth] navigating to:', destination)
          navigate(destination, { replace: true })
        } else {
          console.error('[Auth] invalid response: missing token or user')
          setAuthError('fetch_failed')
        }
      })
      .catch((e) => {
        console.error('[Auth] fetch error:', e)
        setAuthError('fetch_failed')
      })
      .finally(() => {
        console.log('[Auth] auth attempt finished, loading=false')
        setLoading(false)
      })
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, loading, token, authError, setUser, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}
