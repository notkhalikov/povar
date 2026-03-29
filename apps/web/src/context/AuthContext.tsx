import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import WebApp from '@twa-dev/sdk'
import { apiFetch } from '../api/client'
import type { ApiUser } from '../types'

interface AuthState {
  token: string | null
  user: ApiUser | null
}

const AuthContext = createContext<AuthState>({ token: null, user: null })

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token: sessionStorage.getItem('jwt'),
    user: null,
  }))
  const [loading, setLoading] = useState(!state.token)

  useEffect(() => {
    // Already have a token from sessionStorage — skip auth request
    if (state.token) return

    const initData = WebApp.initData
    if (!initData) {
      // Outside Telegram (browser dev mode) — skip auth
      setLoading(false)
      return
    }

    apiFetch<{ token: string; user: ApiUser }>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    })
      .then(({ token, user }) => {
        sessionStorage.setItem('jwt', token)
        setState({ token, user })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>
    )
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
