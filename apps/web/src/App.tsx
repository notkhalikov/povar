import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { AuthProvider } from './components/AuthProvider'
import { useAuth } from './components/AuthProvider'
import { useT } from './i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppLayout } from './components/AppLayout'
import CatalogPage from './pages/CatalogPage'
import SplashPage from './pages/SplashPage'
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
const CreateRequestPage  = lazy(() => import('./pages/CreateRequestPage'))

function PageFallback() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className='sk' style={{ height: 80, borderRadius: 16 }} />
      <div className='sk' style={{ height: 120, borderRadius: 12 }} />
      <div className='sk' style={{ height: 180, borderRadius: 12 }} />
    </div>
  )
}

// ─── Browser notification permission ─────────────────────────────────────────

function NotificationPermissionGate() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* user dismissed */ })
    }
  }, [])
  return null
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
          <Route path='/' element={
            <AppLayout showNav={false}><SplashPage /></AppLayout>
          } />
          <Route path='/catalog' element={<AppLayout><CatalogPage /></AppLayout>} />
          <Route path='/chefs/:id' element={<AppLayout><ChefPage /></AppLayout>} />
          <Route path='/orders' element={<AppLayout><OrdersPage /></AppLayout>} />
          <Route path='/orders/new' element={<AppLayout><OrderNewPage /></AppLayout>} />
          <Route path='/orders/:id' element={<AppLayout><OrderDetailPage /></AppLayout>} />
          <Route path='/profile' element={<AppLayout><ProfilePage /></AppLayout>} />
          <Route path='/chef/onboarding' element={
            <AppLayout showNav={false}><ChefOnboardingPage /></AppLayout>
          } />
          <Route path='/chef/requests' element={<AppLayout><ChefRequestsPage /></AppLayout>} />
          <Route path='/chefs/:chefId/request' element={
            <AppLayout showNav={false}><CreateRequestPage /></AppLayout>
          } />
          <Route path='/disputes/:id' element={<AppLayout><DisputePage /></AppLayout>} />
          <Route path='/requests' element={<AppLayout><RequestsPage /></AppLayout>} />
          <Route path='/requests/:id' element={<AppLayout><RequestDetailPage /></AppLayout>} />
        </Routes>
      </Suspense>
    </div>
  )
}

// ─── Auth gate ──────────────────────────────────────────────────────────────

function AuthGate() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // If loading, stay on splash page
    if (loading) return

    // If not authenticated, redirect to splash
    if (!user) {
      if (location.pathname !== '/') {
        navigate('/', { replace: true })
      }
      return
    }

    // If on splash page and authenticated, redirect to appropriate page
    if (location.pathname === '/') {
      navigate(user.isChef ? '/profile' : '/catalog', { replace: true })
    }
  }, [user, loading, location.pathname, navigate])

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
    <div style={{
      backgroundColor: '#ffffff',
      minHeight: '100dvh',
      color: '#1A1917',
      position: 'relative',
      isolation: 'isolate',
    }}>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <NotificationPermissionGate />
            <BackButtonManager />
            <AuthGate />
            <DeepLinkRedirect />
            <OfflineToast />
            <AnimatedRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  )
}
