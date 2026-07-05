import api from './api'

export const SESSION_DURATION_MS = 5 * 60 * 60 * 1000 // 5 horas

export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password })
  localStorage.setItem('token', data.token)
  localStorage.setItem('loginAt', Date.now().toString())
  localStorage.setItem('user', JSON.stringify({
    id: data.id,
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    nickname: data.nickname ?? null,
  }))
  return data
}

export const checkEmail      = (email)                    => api.get(`/auth/check-email?email=${encodeURIComponent(email)}`)
export const forgotPassword  = (email)                    => api.post('/auth/forgot-password', { email })
export const resetPassword   = (email, pin, newPassword)  => api.post('/auth/reset-password', { email, pin, newPassword })
export const sendPin    = (email) => api.post('/auth/send-pin', { email })

export const register = async (body) => {
  const { data } = await api.post('/auth/register', body)
  localStorage.setItem('token', data.token)
  localStorage.setItem('loginAt', Date.now().toString())
  localStorage.setItem('user', JSON.stringify({
    id: data.userId ?? data.id,
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    nickname: data.nickname ?? null,
  }))
  return { id: data.userId ?? data.id, email: data.email, fullName: data.fullName, role: data.role, nickname: data.nickname ?? null }
}

export const logout = async () => {
  try { await api.post('/auth/logout') } catch {}
  const theme = localStorage.getItem('theme')
  localStorage.clear()
  if (theme) localStorage.setItem('theme', theme)
  window.location.href = '/login'
}

export const getLidersByCountry = (country) => api.get(`/auth/liders?country=${country}`)

export const heartbeat = () => api.post('/auth/heartbeat').catch(() => {})

const VALID_ROLES = ['ADMIN', 'LIDER', 'COORDINATOR', 'FARMER_MASS']

export const getCurrentUser = () => {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  let user
  try { user = JSON.parse(raw) } catch { user = null }
  // Sesión de una versión incompatible de la app (rol desconocido) — limpiar para evitar loops de redirección
  if (!user || !VALID_ROLES.includes(user.role)) {
    localStorage.clear()
    return null
  }
  return user
}
