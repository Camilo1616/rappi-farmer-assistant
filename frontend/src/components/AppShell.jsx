import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/authService'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/whatsapp', label: 'WhatsApp' },
  { to: '/perfil', label: 'Perfil' },
]

export default function AppShell() {
  const { user } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page, #0B0F1A)' }}>
      <nav style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--border, #1F2937)',
        padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary, #F9FAFB)', marginBottom: 20, padding: '0 8px' }}>
          Rappi Assistant
        </div>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
              color: isActive ? '#FF441F' : 'var(--text-secondary, #9CA3AF)',
              background: isActive ? 'rgba(255,68,31,0.12)' : 'transparent',
            })}
          >
            {item.label}
          </NavLink>
        ))}
        <div style={{ marginTop: 'auto', padding: '0 8px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #9CA3AF)', marginBottom: 8 }}>
            {user?.nickname || user?.fullName}
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 8, border: '1.5px solid #DC2626',
              background: 'transparent', color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
