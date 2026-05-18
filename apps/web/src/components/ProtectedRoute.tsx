import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'

export function ProtectedRoute() {
  const { token } = useAuth()
  if (!token) return <Navigate to='/login' replace />
  return <Outlet />
}
