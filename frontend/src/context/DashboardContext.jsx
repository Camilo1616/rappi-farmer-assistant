import { createContext, useContext } from 'react'

/**
 * Estado y acciones compartidas por el "chrome" del dashboard (sidebar/topbar)
 * y por las páginas que cuelgan de /dashboard/*. Cada página consume solo lo
 * que necesita — no todas dependen de todo el estado (a diferencia del
 * DashboardPage monolítico anterior).
 */
const DashboardContext = createContext(null)

export function DashboardProvider({ value, children }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard debe usarse dentro de <AppLayout>')
  return ctx
}
