import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import { useT } from './i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import CatalogPage from './pages/CatalogPage'
import OnboardingPage from './pages/OnboardingPage'

const ChefPage           = lazy(() => import('./pages/ChefPage'))
const OrdersPage         = lazy(() => import('./pages/OrdersPage'))
const OrderNewPage       = lazy(() => import('./pages/OrderNewPage'))
const OrderDetailPage    = lazy(() => import('./pages/OrderDetailPage'))
const ProfilePage        = lazy(() => import('./pages/ProfilePage'))
const ChefOnboardingPage = lazy(() => import('./pages/ChefOnboardingPage'))
const DisputePage        = lazy(() => import('./pages/DisputePage'))
const RequestsPage       = lazy(() => import('./pages/RequestsPage'))
const RequestDetailPage  = lazy(() => import('./pages/RequestDetailPage'))
const ChefRequestsPage   = lazy(() => import('./pages/ChefRequestsPage'))

function PageFallback() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className='sk' style={{ height: 80, borderRadius: 16 }} />
      <div className='sk' style={{ height: 120, borderRadius: 12 }} />
      <div className='sk' style={{ height: 180, borderRadius: 12 }} />
    </div>
  )
}

// ─── Telegram BackButton manager ─────────────────────────────────────────────

function BackButtonManager() {
  const location = useLocation()
  const navigate  = useNavigate()

  useEffect(() => {
    const isRoot = location.pathname === '/'
    try {
      if (isRoot) {
        WebApp.BackButton.hide()
      } else {
        WebApp.BackButton.show()
        const handler = () => navigate(-1)
        WebApp.BackButton.onClick(handler)
        return () => { WebApp.BackButton.offClick(handler) }
      }
    } catch { /* running outside Telegram */ }
  }, [location.pathname, navigate])

  return null
}

// ─── Animated route wrapper ───────────────────────────────────────────────────

function AnimatedRoutes() {
  const location = useLocation()
  const [animClass, setAnimClass] = useState('')
  const historyStack = useRef<string[]>([location.key])
  const prevKey      = useRef<string>(location.key)

  useEffect(() => {
    if (location.key === prevKey.current) return
    const stack = historyStack.current
    const idx   = stack.indexOf(location.key)
    if (idx !== -1) {
      // navigating back — key already in stack
      historyStack.current = stack.slice(0, idx + 1)
      setAnimClass('page-slide-back')
    } else {
      // navigating forward — new key
      historyStack.current = [...stack, location.key]
      setAnimClass('page-slide-forward')
    }
    prevKey.current = location.key
  }, [location.key])

  return (
    <div key={location.key} className={animClass} style={{ flex: 1 }}>
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route path='/'                element={<CatalogPage />} />
          <Route path='/chefs/:id'       element={<ChefPage />} />
          <Route path='/orders'          element={<OrdersPage />} />
          <Route path='/orders/new'      element={<OrderNewPage />} />
          <Route path='/orders/:id'      element={<OrderDetailPage />} />
          <Route path='/profile'         element={<ProfilePage />} />
          <Route path='/chef/onboarding' element={<ChefOnboardingPage />} />
          <Route path='/chef/requests'   element={<ChefRequestsPage />} />
          <Route path='/disputes/:id'    element={<DisputePage />} />
          <Route path='/requests'        element={<RequestsPage />} />
          <Route path='/requests/:id'    element={<RequestDetailPage />} />
          <Route path='/onboarding'      element={<OnboardingPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}

// ─── Onboarding gate ─────────────────────────────────────────────────────────

function OnboardingGate() {
  const { needsOnboarding } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  useEffect(() => {
    if (needsOnboarding && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    }
  }, [needsOnboarding, location.pathname, navigate])

  return null
}

// ─── Deep link redirect ───────────────────────────────────────────────────────

function DeepLinkRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const param = WebApp.initDataUnsafe?.start_param
    if (!param) return

    if (param.startsWith('review_')) {
      navigate(`/orders/${param.slice('review_'.length)}?openReview=true`, { replace: true })
    } else if (param.startsWith('order_')) {
      navigate(`/orders/${param.slice('order_'.length)}`, { replace: true })
    } else if (param.startsWith('request_')) {
      navigate(`/requests/${param.slice('request_'.length)}`, { replace: true })
    } else if (param.startsWith('dispute_')) {
      navigate(`/disputes/${param.slice('dispute_'.length)}`, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

// ─── Offline toast ────────────────────────────────────────────────────────────

function OfflineToast() {
  const t = useT()
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const onOffline = () => setOffline(true)
    const onOnline  = () => setOffline(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1c1c1e',
      color: '#fff',
      padding: '10px 18px',
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 500,
      zIndex: 9999,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      whiteSpace: 'nowrap',
    }}>
      📵 {t.errors.network}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <BackButtonManager />
          <OnboardingGate />
          <DeepLinkRedirect />
          <OfflineToast />
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <main style={{ flex: 1, paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
              <AnimatedRoutes />
            </main>
            <BottomNav />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

// ─── Role-aware bottom navigation ────────────────────────────────────────────

function BottomNav() {
  const { user } = useAuth()
  const isChef = user?.role === 'chef'
  const location = useLocation()
  const t = useT()

  if (location.pathname === '/onboarding') return null

  return (
    <nav style={navStyle}>
      <NavItem to='/'        label={t.nav.chefs}    icon='🍽️' />
      <NavItem
        to={isChef ? '/chef/requests' : '/requests'}
        label={t.nav.requests}
        icon='📩'
      />
      <NavItem to='/orders'  label={t.nav.orders}   icon='📋' />
      <NavItem to='/profile' label={t.nav.profile}  icon='👤' />
    </nav>
  )
}

function NavItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        ...navItemStyle,
        color: isActive
          ? 'var(--tg-theme-button-color)'
          : 'var(--tg-theme-hint-color)',
      })}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </NavLink>
  )
}

const navStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'space-around',
  background: 'var(--tg-theme-bg-color)',
  borderTop: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 25%, transparent)',
  padding: '6px 0 max(10px, env(safe-area-inset-bottom))',
  zIndex: 100,
}

const navItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  textDecoration: 'none',
  minWidth: 60,
  minHeight: 44,
  justifyContent: 'center',
}
