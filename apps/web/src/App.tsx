import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import CatalogPage from './pages/CatalogPage'
import ChefPage from './pages/ChefPage'
import OrdersPage from './pages/OrdersPage'
import OrderNewPage from './pages/OrderNewPage'
import OrderDetailPage from './pages/OrderDetailPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <main style={{ flex: 1, paddingBottom: 60 }}>
            <Routes>
              <Route path='/'           element={<CatalogPage />} />
              <Route path='/chefs/:id'  element={<ChefPage />} />
              <Route path='/orders'     element={<OrdersPage />} />
              <Route path='/orders/new' element={<OrderNewPage />} />
              <Route path='/orders/:id' element={<OrderDetailPage />} />
              <Route path='/profile'    element={<ProfilePage />} />
            </Routes>
          </main>

          <nav style={navStyle}>
            <NavItem to='/'        label='Повара'   icon='🍽️' />
            <NavItem to='/orders'  label='Заказы'   icon='📋' />
            <NavItem to='/profile' label='Профиль'  icon='👤' />
          </nav>
        </div>
      </BrowserRouter>
    </AuthProvider>
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
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 11 }}>{label}</span>
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
  borderTop: '1px solid var(--tg-theme-hint-color)',
  padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
}

const navItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  textDecoration: 'none',
  minWidth: 60,
}
