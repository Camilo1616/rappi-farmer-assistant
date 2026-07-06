import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../hooks/useRealtime'
import { logout, heartbeat } from '../services/authService'
import { clearStores, getImportStatus } from '../services/importService'
import { getDashboard, getUnreadCount, getNotifications, markAllNotifRead } from '../services/dashboardService'
import ConfirmModal from '../components/ConfirmModal'
import FollowUpModal from '../components/FollowUpModal'
import { DashboardProvider } from '../context/DashboardContext'
import styles from './AppLayout.module.css'

const NAV_TO_PATH = {
  dashboard: '',
  stores: 'stores',
  bases: 'bases',
  excel: 'excel',
  management: 'gestiones',
  whatsapp: 'whatsapp',
  reports: 'reportes',
  agm: 'agm-ia',
  profile: 'perfil',
}
const PATH_TO_NAV = Object.fromEntries(
  Object.entries(NAV_TO_PATH).map(([k, v]) => [v, k])
)

const IC = ({ d, d2 }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
)

const NAV_ITEMS = [
  { icon: <IC d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" />,              color: '#FF441F', bg: 'rgba(255,68,31,0.13)',   label: 'Inicio',    key: 'dashboard'  },
  { icon: <IC d="M3 9h18M3 15h18M9 3v18M15 3v18" />,                                                  color: '#3B82F6', bg: 'rgba(59,130,246,0.13)',  label: 'Cartera',   key: 'stores'     },
  { icon: <IC d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" d2="M14 2v6h6" />,     color: '#8B5CF6', bg: 'rgba(139,92,246,0.13)',  label: 'Bases',     key: 'bases'      },
  { icon: <IC d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" d2="M17 8l-5-5-5 5M12 3v12" />,         color: '#10B981', bg: 'rgba(16,185,129,0.13)',  label: 'Importar',  key: 'excel'      },
  { icon: <IC d="M9 11l3 3L22 4" d2="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />, color: '#F59E0B', bg: 'rgba(245,158,11,0.13)',  label: 'Gestiones', key: 'management' },
  { icon: <IC d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,                 color: '#22C55E', bg: 'rgba(34,197,94,0.13)',   label: 'Mensajes',  key: 'whatsapp'   },
  { icon: <IC d="M18 20V10M12 20V4M6 20v-6" />,                                                       color: '#06B6D4', bg: 'rgba(6,182,212,0.13)',   label: 'Reportes',  key: 'reports'    },
  { icon: <IC d="M12 8v4l3 3" d2="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />,                       color: '#7C3AED', bg: 'rgba(124,58,237,0.13)',  label: 'Gestión AGM-IA', key: 'agm'   },
  { icon: <IC d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" d2="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />, color: '#94A3B8', bg: 'rgba(148,163,184,0.13)', label: 'Perfil',    key: 'profile'    },
]

const SIDEBAR_SEGMENT_FILTERS = [
  { key: 'Todos',       label: 'Todos',       color: '#8B93A8' },
  { key: 'Onboarding',  label: 'Onboarding',  color: '#3B82F6' },
  { key: 'Churn',       label: 'Churn',       color: '#EF4444' },
  { key: 'AVA',         label: 'AVA Bajando',  color: '#F59E0B' },
  { key: 'Saludable',   label: 'Saludable',   color: '#22C55E' },
]

function getTodayLabel() {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function RefreshBanner({ lastImportDate, onRefresh }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const lastText = lastImportDate
    ? `Última carga: ${new Date(lastImportDate + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}`
    : 'No hay cartera cargada para hoy'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'linear-gradient(90deg, rgba(255,68,31,0.12), rgba(255,68,31,0.06))',
      border: '1px solid rgba(255,68,31,0.3)',
      borderRadius: 12, padding: '12px 18px', marginBottom: 20, gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '1.4rem' }}>📋</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: '#F0F2F8', fontSize: '0.9rem' }}>
            Tu cartera es del día anterior
          </p>
          <p style={{ margin: 0, color: '#9CA3AF', fontSize: '0.78rem' }}>{lastText}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onRefresh} style={{
          padding: '7px 16px', borderRadius: 8, border: 'none',
          background: '#FF441F', color: '#fff', fontWeight: 700,
          fontSize: '0.82rem', cursor: 'pointer',
        }}>
          📥 Cargar Excel
        </button>
        <button onClick={() => setDismissed(true)} style={{
          padding: '7px 10px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)', color: '#9CA3AF',
          fontSize: '0.82rem', cursor: 'pointer',
        }}>
          ✕
        </button>
      </div>
    </div>
  )
}

/**
 * Chrome compartido de /dashboard/*: sidebar, topbar, notificaciones,
 * banner de carga obligatoria y bottom nav. El contenido de cada módulo
 * (Inicio, Cartera, Bases, Gestiones, AGM-IA, etc.) vive en su propia
 * ruta/componente y se renderiza vía <Outlet/> — ya no dependen de un
 * estado local gigante ni de un switch manual sobre "activeNav".
 */
export default function AppLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const activeNav = (() => {
    const segment = location.pathname.replace(/^\/dashboard\/?/, '')
    return PATH_TO_NAV[segment] ?? 'dashboard'
  })()

  const goTo = (key) => {
    const path = NAV_TO_PATH[key]
    navigate('/dashboard' + (path ? '/' + path : ''))
  }

  const [importedToday, setImportedToday] = useState(null) // null = cargando
  const [hasStores, setHasStores] = useState(true) // optimista mientras carga
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [sidebarFiltersOpen, setSidebarFiltersOpen] = useState(false)
  const [sidebarSegment, setSidebarSegment] = useState('Todos')
  const [confirmAction, setConfirmAction] = useState(null)

  const [dash, setDash] = useState(null)
  const [dashLoading, setDashLoading] = useState(true)

  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpStore, setFollowUpStore] = useState(null)

  const [unread, setUnread] = useState(0)
  const [notifs, setNotifs] = useState([])

  const profileRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    getImportStatus()
      .then(({ data }) => {
        const stores = data.hasStores !== false
        const required = data.required === true
        setHasStores(stores)
        setImportedToday(!required)
        if (required) navigate('/dashboard/excel', { replace: true })
      })
      .catch(() => { setHasStores(true); setImportedToday(true) })
  }, []) // eslint-disable-line

  useEffect(() => {
    const h = e => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const loadDash = async () => {
    try {
      const { data } = await getDashboard()
      setDash(data)
    } finally { setDashLoading(false) }
  }

  const loadUnread = async () => {
    try { const { data } = await getUnreadCount(); setUnread(data.count ?? data) } catch {}
  }

  const openNotifs = async () => {
    setNotifOpen(o => !o)
    try {
      const { data } = await getNotifications()
      setNotifs(data)
    } catch {}
  }

  const handleMarkRead = async () => {
    try { await markAllNotifRead(); setUnread(0); loadUnread() } catch {}
  }

  const handleClearStores = () => {
    setProfileOpen(false)
    setConfirmAction({
      title: 'Borrar cartera',
      message: '¿Estás seguro de que quieres borrar toda tu cartera? Esta acción no se puede deshacer.',
      danger: true,
      confirmLabel: 'Sí, borrar todo',
      action: async () => {
        try {
          await clearStores()
          setDash(null)
          loadDash()
        } catch {
          alert('Error al borrar la cartera. Intenta de nuevo.')
        }
      }
    })
  }

  useEffect(() => { loadDash(); loadUnread() }, [])
  useRealtime(() => { loadDash(); loadUnread() })

  useEffect(() => {
    heartbeat()
    const iv = setInterval(heartbeat, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const firstName = user?.nickname?.trim() || user?.fullName?.split(' ')[0] || 'Farmer'

  const totalStores  = dash?.totalCount ?? 0
  const onboardCount = dash?.onboardingCritical?.length ?? 0
  const churnCount   = dash?.churnRisk?.length ?? 0
  const healthyCount = dash?.healthy?.length ?? 0

  const BOTTOM_NAV = NAV_ITEMS.filter(n => ['dashboard', 'stores', 'management', 'whatsapp', 'excel'].includes(n.key))

  const openFollowUp = (store) => { setFollowUpStore(store ?? null); setFollowUpOpen(true) }

  const ctxValue = {
    firstName, dash, dashLoading, loadDash,
    totalStores, onboardCount, churnCount, healthyCount,
    importedToday, hasStores, setImportedToday, setHasStores,
    sidebarSegment, setSidebarSegment,
    openFollowUp,
    goTo,
  }

  return (
    <DashboardProvider value={ctxValue}>
      <div className={styles.layout}>

        {sidebarMobileOpen && (
          <div className={styles.sidebarOverlay} onClick={() => setSidebarMobileOpen(false)} />
        )}

        <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''} ${sidebarMobileOpen ? styles.sidebarMobileOpen : ''}`}>
          <div className={styles.sidebarBrand}>
            <span className={styles.sidebarDot} />
            {!sidebarCollapsed && <span className={styles.sidebarBrandName}>Rappi Farmer</span>}
            <button
              className={styles.sidebarToggle}
              onClick={() => setSidebarCollapsed(c => !c)}
              title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
              {sidebarCollapsed ? '›' : '‹'}
            </button>
          </div>

          <nav className={styles.sidebarNav}>
            {NAV_ITEMS.map(item => {
              const blocked = importedToday === false && item.key !== 'excel' && item.key !== 'profile' && item.key !== 'agm'
              const blockMsg = !hasStores
                ? 'Carga tu base de tiendas para empezar'
                : 'Carga el Excel del día para habilitar este módulo'
              return (
                <button
                  key={item.key}
                  className={`${styles.navItem} ${activeNav === item.key ? styles.active : ''} ${blocked ? styles.navItemBlocked : ''}`}
                  onClick={() => !blocked && goTo(item.key)}
                  title={blocked ? blockMsg : sidebarCollapsed ? item.label : undefined}
                >
                  <span className={styles.navIconWrap} style={{ background: item.bg, borderColor: item.color + '33', color: item.color }}>{item.icon}</span>
                  {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                  {!sidebarCollapsed && blocked && <span className={styles.navLock}>🔒</span>}
                </button>
              )
            })}
          </nav>

          {!sidebarCollapsed && (
            <div className={styles.sidebarFilters}>
              <button
                className={styles.sidebarFiltersToggle}
                onClick={() => setSidebarFiltersOpen(o => !o)}
              >
                <span>🔽 Filtros rápidos</span>
                <span>{sidebarFiltersOpen ? '▲' : '▼'}</span>
              </button>
              {sidebarFiltersOpen && (
                <div className={styles.sidebarFilterPanel}>
                  <div className={styles.sidebarFilterLabel}>Por segmento</div>
                  {SIDEBAR_SEGMENT_FILTERS.map(f => (
                    <button
                      key={f.key}
                      className={`${styles.sidebarFilterChip} ${sidebarSegment === f.key ? styles.sidebarFilterChipActive : ''}`}
                      style={sidebarSegment === f.key ? { borderColor: f.color, color: f.color, background: f.color + '18' } : {}}
                      onClick={() => {
                        setSidebarSegment(f.key)
                        goTo('dashboard')
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.sidebarFooter} ref={profileRef}>
            {profileOpen && (
              <div className={styles.profileMenu}>
                <div className={styles.profileMenuHeader}>
                  <div className={styles.avatarLg}>{getInitials(user?.fullName)}</div>
                  <div>
                    <p className={styles.profileMenuName}>{user?.fullName}</p>
                    <p className={styles.profileMenuEmail}>{user?.email}</p>
                  </div>
                </div>
                <div className={styles.profileMenuDivider} />
                <button className={styles.profileMenuItem} onClick={() => { goTo('profile'); setProfileOpen(false) }}>
                  <span>👤</span> Mi perfil
                </button>
                <button className={styles.profileMenuItem} onClick={() => { goTo('excel'); setProfileOpen(false) }}>
                  <span>📥</span> Cargar Excel
                </button>
                <div className={styles.profileMenuDivider} />
                <button className={`${styles.profileMenuItem} ${styles.profileMenuItemDanger}`} onClick={handleClearStores}>
                  <span>🗑️</span> Borrar cartera
                </button>
                <button className={`${styles.profileMenuItem} ${styles.profileMenuItemDanger}`} onClick={() => {
                  setProfileOpen(false)
                  setConfirmAction({
                    title: 'Cerrar sesión',
                    message: '¿Deseas cerrar tu sesión actual?',
                    danger: false,
                    confirmLabel: 'Cerrar sesión',
                    action: logout
                  })
                }}>
                  <span>⏻</span> Cerrar sesión
                </button>
              </div>
            )}

            <div
              className={`${styles.userCard} ${profileOpen ? styles.userCardActive : ''}`}
              onClick={() => setProfileOpen(o => !o)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setProfileOpen(o => !o)}
            >
              <div className={styles.avatar}>{getInitials(user?.fullName)}</div>
              <div className={styles.userInfo}>
                <div className={styles.userFullName}>{user?.fullName}</div>
                <div className={styles.userRole}>{user?.role}</div>
              </div>
              <span className={styles.chevron}>{profileOpen ? '▲' : '▼'}</span>
            </div>
          </div>
        </aside>

        <div className={styles.content}>

          <div className={styles.topbar}>
            <button className={styles.hamburger} onClick={() => setSidebarMobileOpen(o => !o)} aria-label="Menú">☰</button>
            <h1 className={styles.pageTitle}>{NAV_ITEMS.find(n => n.key === activeNav)?.label}</h1>
            <div className={styles.topbarRight}>
              <button
                className={styles.btnFollowUp}
                onClick={() => openFollowUp(null)}
              >
                Follow Up
              </button>
              <span className={styles.liveIndicator}><span className={styles.liveDot} /> En vivo</span>
              <span className={styles.date}>{getTodayLabel()}</span>

              <div className={styles.notifWrap} ref={notifRef}>
                <button className={styles.notifBtn} onClick={openNotifs}>
                  🔔
                  {unread > 0 && <span className={styles.notifBadge}>{unread}</span>}
                </button>
                {notifOpen && (
                  <div className={styles.notifDropdown}>
                    <div className={styles.notifHeader}>
                      <span>Notificaciones</span>
                      {unread > 0 && (
                        <button className={styles.markReadBtn} onClick={handleMarkRead}>
                          Marcar todo como leído
                        </button>
                      )}
                    </div>
                    {notifs.length === 0
                      ? <p className={styles.notifEmpty}>Sin notificaciones</p>
                      : notifs.slice(0, 8).map(n => (
                        <div key={n.id} className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}>
                          <span className={styles.notifMsg}>{n.title}</span>
                          {n.body && <span className={styles.notifBody}>{n.body}</span>}
                          <span className={styles.notifTime}>{new Date(n.createdAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {importedToday === false && activeNav !== 'excel' && activeNav !== 'profile' && activeNav !== 'agm' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'linear-gradient(90deg, rgba(255,68,31,0.12), rgba(255,68,31,0.06))',
              border: '1px solid rgba(255,68,31,0.35)',
              borderRadius: 0, padding: '14px 28px',
              borderBottom: '1px solid rgba(255,68,31,0.2)',
            }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#FF441F' }}>
                  {!hasStores ? 'Bienvenido — carga tu base de tiendas para comenzar' : 'Debes cargar el Excel antes de empezar el turno'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8B93A8' }}>
                  {!hasStores
                    ? 'Ningún módulo estará disponible hasta que cargues tu primera base de tiendas.'
                    : 'Ningún módulo estará disponible hasta que cargues el reporte diario de Rappi.'}
                </p>
              </div>
              <button
                onClick={() => goTo('excel')}
                style={{
                  padding: '9px 18px', background: '#FF441F', color: '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >
                Cargar Excel ahora →
              </button>
            </div>
          )}

          <main className={styles.main}>
            <Outlet />
          </main>
        </div>

        {confirmAction && (
          <ConfirmModal
            title={confirmAction.title}
            message={confirmAction.message}
            danger={confirmAction.danger}
            confirmLabel={confirmAction.confirmLabel}
            onConfirm={() => { confirmAction.action(); setConfirmAction(null) }}
            onCancel={() => setConfirmAction(null)}
          />
        )}

        <nav className={styles.bottomNav}>
          {BOTTOM_NAV.map(item => {
            const blocked = importedToday === false && item.key !== 'excel' && item.key !== 'profile'
            return (
              <button
                key={item.key}
                className={`${styles.bottomNavItem} ${activeNav === item.key ? styles.active : ''}`}
                onClick={() => { if (!blocked) { goTo(item.key); setSidebarMobileOpen(false) } }}
                style={{ opacity: blocked ? 0.4 : 1 }}
              >
                <span className={styles.bottomNavIcon} style={{ color: item.color }}>{item.icon}</span>
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {followUpOpen && (
          <FollowUpModal
            initialStore={followUpStore}
            onClose={() => { setFollowUpOpen(false); setFollowUpStore(null) }}
            onSaved={() => { loadDash(); setFollowUpOpen(false); setFollowUpStore(null) }}
          />
        )}
      </div>
    </DashboardProvider>
  )
}

export { RefreshBanner }
