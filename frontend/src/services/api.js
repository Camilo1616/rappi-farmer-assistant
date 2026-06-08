import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
  timeout: 15000,
})

// Adjunta el token JWT en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirige al login si el token expiró
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const theme = localStorage.getItem('theme')
      localStorage.clear()
      if (theme) localStorage.setItem('theme', theme)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
