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

// ─── UTM helpers ──────────────────────────────────────────────────────────────

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
type UtmKey = typeof UTM_KEYS[number]

interface UtmParams {
  utmSource?:   string
  utmMedium?:   string
  utmCampaign?: string
  utmContent?:  string
  utmTerm?:     string
}

function readUtm(): UtmParams {
  // 1. Try URL query string (standard web referral)
  const search = new URLSearchParams(window.location.search)
  const fromUrl: Partial<Record<UtmKey, string>> = {}
  for (const k of UTM_KEYS) {
    const v = search.get(k)
    if (v) fromUrl[k] = v
  }

  // 2. Try Telegram start_param (e.g. ?startapp=utm_source%3Dtg_post)
  const startParam = WebApp.initDataUnsafe?.start_param ?? ''
  const fromStart: Partial<Record<UtmKey, string>> = {}
  if (startParam) {
    try {
      const decoded = new URLSearchParams(decodeURIComponent(startParam))
      for (const k of UTM_KEYS) {
        const v = decoded.get(k)
        if (v) fromStart[k] = v
      }
    } catch {
      // start_param may not be URL-encoded UTM — ignore
    }
  }

  // 3. Merge: URL params > start_param > previously saved
  const saved: Partial<Record<UtmKey, string>> = {}
  for (const k of UTM_KEYS) {
    const v = localStorage.getItem(k)
    if (v) saved[k] = v
  }

  const merged = { ...saved, ...fromStart, ...fromUrl }

  // Persist merged UTMs so they survive SPA navigation and Telegram reloads
  for (const k of UTM_KEYS) {
    if (merged[k]) localStorage.setItem(k, merged[k]!)
  }

  return {
    utmSource:   merged.utm_source,
    utmMedium:   merged.utm_medium,
    utmCampaign: merged.utm_campaign,
    utmContent:  merged.utm_content,
    utmTerm:     merged.utm_term,
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null
  user: ApiUser | null
}

interface AuthContextValue extends AuthState {
  setUser: (user: ApiUser) => void
  needsOnboarding: boolean
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  user: null,
  setUser: () => {},
  needsOnboarding: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token: sessionStorage.getItem('jwt'),
    user: null,
  }))
  const [loading, setLoading] = useState(!state.token)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    // Already have a token from sessionStorage — skip auth request
    if (state.token) return

    const initData = WebApp.initData
    if (!initData) {
      // Outside Telegram (browser dev mode) — skip auth
      setLoading(false)
      return
    }

    const utm = readUtm()

    apiFetch<{ token: string; user: ApiUser }>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData, ...utm }),
    })
      .then(({ token, user }) => {
        sessionStorage.setItem('jwt', token)
        setState({ token, user })
        if (!localStorage.getItem('onboarding_done')) {
          setNeedsOnboarding(true)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function setUser(user: ApiUser) {
    setState(prev => ({ ...prev, user }))
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>
    )
  }

  return (
    <AuthContext.Provider value={{ ...state, setUser, needsOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}
