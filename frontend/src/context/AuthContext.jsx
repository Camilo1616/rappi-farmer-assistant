import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentUser, logout, SESSION_DURATION_MS } from '../services/authService'

const AuthContext = createContext(null)

const INACTIVITY_MS = 60 * 60 * 1000 // 1 hora sin actividad
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

function isSessionExpired() {
  const loginAt = localStorage.getItem('loginAt')
  if (!loginAt) return false
  return Date.now() - parseInt(loginAt, 10) > SESSION_DURATION_MS
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastActivityRef = useRef(Date.now())

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (isSessionExpired()) {
      logout()
      return
    }
    setUser(getCurrentUser())
    setLoading(false)
  }, [])

  // Escucha actividad del usuario y actualiza el timestamp
  useEffect(() => {
    if (!user) return
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetActivity))
    }
  }, [user, resetActivity])

  // Verifica cada minuto: inactividad de 1h o sesión de 5h
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      if (isSessionExpired()) {
        logout()
        return
      }
      if (Date.now() - lastActivityRef.current > INACTIVITY_MS) {
        logout()
      }
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  const updateUser = (data) => {
    setUser(data)
    localStorage.setItem('user', JSON.stringify(data))
  }

  return (
    <AuthContext.Provider value={{ user, setUser: updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
