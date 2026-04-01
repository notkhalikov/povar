import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import CatalogPage from './pages/CatalogPage'
import ChefPage from './pages/ChefPage'
import OrdersPage from './pages/OrdersPage'
import OrderNewPage from './pages/OrderNewPage'
import OrderDetailPage from './pages/OrderDetailPage'
import ProfilePage from './pages/ProfilePage'
import ChefOnboardingPage from './pages/ChefOnboardingPage'
import DisputePage from './pages/DisputePage'
import RequestsPage from './pages/RequestsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import ChefRequestsPage from './pages/ChefRequestsPage'

// ─── Deep link redirect ───────────────────────────────────────────────────────

function DeepLinkRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const param = WebApp.initDataUnsafe?.start_param
    if (!param) return

    if (param.startsWith('order_')) {
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
      📵 Нет соединения
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <DeepLinkRedirect />
          <OfflineToast />
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <main style={{ flex: 1, paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
              <Routes>
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
              </Routes>
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

  return (
    <nav style={navStyle}>
      <NavItem to='/'        label='Повара'  icon='🍽️' />
      <NavItem
        to={isChef ? '/chef/requests' : '/requests'}
        label='Запросы'
        icon='📩'
      />
      <NavItem to='/orders'  label='Заказы'  icon='📋' />
      <NavItem to='/profile' label='Профиль' icon='👤' />
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
