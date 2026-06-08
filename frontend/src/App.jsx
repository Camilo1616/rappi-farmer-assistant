import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import CalendarCallbackPage from './pages/CalendarCallbackPage'
import DashboardPage from './pages/DashboardPage'
import LiderDashboardPage from './pages/LiderDashboardPage'

function RoleRoute({ allowed, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) return <Navigate to={user.role === 'LIDER' ? '/lider' : '/dashboard'} replace />
  return children
}

function IndexRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'LIDER' ? '/lider' : '/dashboard'} replace />
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/calendar-callback" element={<CalendarCallbackPage />} />
      <Route path="/" element={<PrivateRoute><IndexRedirect /></PrivateRoute>} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <RoleRoute allowed={['FARMER_MASS', 'ADMIN', 'COORDINATOR']}>
              <DashboardPage />
            </RoleRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/lider"
        element={
          <PrivateRoute>
            <RoleRoute allowed={['LIDER', 'ADMIN']}>
              <LiderDashboardPage />
            </RoleRoute>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
