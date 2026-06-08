import api from './api'

export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password })
  localStorage.setItem('token', data.token)
  localStorage.setItem('user', JSON.stringify({
    id: data.id,
    email: data.email,
    fullName: data.fullName,
    role: data.role,
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
  localStorage.setItem('user', JSON.stringify({
    id: data.userId ?? data.id,
    email: data.email,
    fullName: data.fullName,
    role: data.role,
  }))
  return { id: data.userId ?? data.id, email: data.email, fullName: data.fullName, role: data.role }
}

export const logout = () => {
  const theme = localStorage.getItem('theme')
  localStorage.clear()
  if (theme) localStorage.setItem('theme', theme)
  window.location.href = '/login'
}

export const getCurrentUser = () => {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}
