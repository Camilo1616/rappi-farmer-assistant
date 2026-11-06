import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
const ManagementPage        = lazy(() => import('./pages/ManagementPage'))
const WhatsappDisabledPage  = lazy(() => import('./pages/WhatsappDisabledPage'))
const ReportsPage           = lazy(() => import('./pages/ReportsPage'))
const GestionAgmPage        = lazy(() => import('./pages/GestionAgmPage'))
const ProfilePage           = lazy(() => import('./pages/ProfilePage'))
const LiderDashboardPage    = lazy(() => import('./pages/LiderDashboardPage'))
const DespachoPage          = lazy(() => import('./pages/DespachoPage'))
const ClienteFichaPage      = lazy(() => import('./pages/ClienteFichaPage'))
const CambiarClavePage      = lazy(() => import('./pages/CambiarClavePage'))

function RouteFallback() {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando…</div>
}

function Lazy({ children }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function homeFor(role) {
  if (role === 'LIDER') return '/lider'
  if (role === 'DUENA' || role === 'ASISTENTE') return '/despacho'
  return '/dashboard'
}

function RoleRoute({ allowed, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return children
}

function IndexRedirect() {
  const { user } = useAuth()
  return <Navigate to={homeFor(user?.role)} replace />
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  // Entró con la contraseña temporal del correo: no avanza hasta crear una propia
  if (user.mustChangePassword && location.pathname !== '/cambiar-clave') return <Navigate to="/cambiar-clave" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/calendar-callback" element={<CalendarCallbackPage />} />
      <Route path="/cambiar-clave" element={<PrivateRoute><Lazy><CambiarClavePage /></Lazy></PrivateRoute>} />
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
      <Route
        path="/despacho"
        element={
          <PrivateRoute>
            <RoleRoute allowed={['DUENA', 'ASISTENTE', 'ADMIN']}>
              <Lazy><DespachoPage /></Lazy>
            </RoleRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/despacho/cliente/:id"
        element={
          <PrivateRoute>
            <RoleRoute allowed={['DUENA', 'ASISTENTE', 'ADMIN']}>
              <Lazy><ClienteFichaPage /></Lazy>
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
