import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getCurrentUser())
    setLoading(false)
  }, [])

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
