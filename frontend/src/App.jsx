import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import CalendarCallbackPage from './pages/CalendarCallbackPage'
import AppLayout from './layouts/AppLayout'
import DashboardHomePage from './pages/DashboardHomePage'

// Cada módulo de /dashboard/* se descarga solo cuando el usuario navega a él,
// en vez de ir todo en el bundle inicial (AGM-IA, Reportes, Perfil, etc. son
// independientes entre sí, así que no hay razón para cargarlos de una).
const StoresPage           = lazy(() => import('./pages/StoresPage'))
const BasesPage             = lazy(() => import('./pages/BasesPage'))
const ExcelUploadPage       = lazy(() => import('./pages/ExcelUploadPage'))
const ManagementPage        = lazy(() => import('./pages/ManagementPage'))
const WhatsappDisabledPage  = lazy(() => import('./pages/WhatsappDisabledPage'))
const ReportsPage           = lazy(() => import('./pages/ReportsPage'))
const GestionAgmPage        = lazy(() => import('./pages/GestionAgmPage'))
const ProfilePage           = lazy(() => import('./pages/ProfilePage'))
const LiderDashboardPage    = lazy(() => import('./pages/LiderDashboardPage'))

function RouteFallback() {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando…</div>
}

function Lazy({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

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
              <AppLayout />
            </RoleRoute>
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardHomePage />} />
        <Route path="stores" element={<Lazy><StoresPage /></Lazy>} />
        <Route path="bases" element={<Lazy><BasesPage /></Lazy>} />
        <Route path="excel" element={<Lazy><ExcelUploadPage /></Lazy>} />
        <Route path="gestiones" element={<Lazy><ManagementPage /></Lazy>} />
        <Route path="whatsapp" element={<Lazy><WhatsappDisabledPage /></Lazy>} />
        <Route path="reportes" element={<Lazy><ReportsPage /></Lazy>} />
        <Route path="agm-ia" element={<Lazy><GestionAgmPage /></Lazy>} />
        <Route path="perfil" element={<Lazy><ProfilePage /></Lazy>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route
        path="/lider"
        element={
          <PrivateRoute>
            <RoleRoute allowed={['LIDER', 'ADMIN']}>
              <Lazy><LiderDashboardPage /></Lazy>
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
