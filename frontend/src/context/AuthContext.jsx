import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser, logout, SESSION_DURATION_MS } from '../services/authService'

const AuthContext = createContext(null)

function isSessionExpired() {
  const loginAt = localStorage.getItem('loginAt')
  if (!loginAt) return false
  return Date.now() - parseInt(loginAt, 10) > SESSION_DURATION_MS
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isSessionExpired()) {
      logout() // redirige a /login internamente
      return   // loading queda true — la redirección desmonta el árbol
    }
    setUser(getCurrentUser())
    setLoading(false)
  }, [])

  // Verifica expiración cada minuto mientras la app está abierta
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && isSessionExpired()) {
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
