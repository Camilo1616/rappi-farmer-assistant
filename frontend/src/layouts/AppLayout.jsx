import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../hooks/useRealtime'
import { logout, heartbeat } from '../services/authService'
import { clearStores } from '../services/importService'
import { getUnreadCount, getNotifications, markAllNotifRead } from '../services/dashboardService'
import ConfirmModal from '../components/ConfirmModal'
import FollowUpModal from '../components/FollowUpModal'
import { DashboardProvider } from '../context/DashboardContext'
import styles from './AppLayout.module.css'

const NAV_TO_PATH = {
  dashboard: '',
  stores: 'stores',
  bases: 'bases',
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
  { icon: <IC d="M9 11l3 3L22 4" d2="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />, color: '#F59E0B', bg: 'rgba(245,158,11,0.13)',  label: 'Gestiones', key: 'management' },
  { icon: <IC d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,                 color: '#22C55E', bg: 'rgba(34,197,94,0.13)',   label: 'Mensajes',  key: 'whatsapp'   },
  { icon: <IC d="M18 20V10M12 20V4M6 20v-6" />,                                                       color: '#06B6D4', bg: 'rgba(6,182,212,0.13)',   label: 'Reportes',  key: 'reports'    },
  { icon: <IC d="M12 8v4l3 3" d2="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />,                       color: '#7C3AED', bg: 'rgba(124,58,237,0.13)',  label: 'Gestión AGM-IA', key: 'agm'   },
  { icon: <IC d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" d2="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />, color: '#94A3B8', bg: 'rgba(148,163,184,0.13)', label: 'Perfil',    key: 'profile'    },
]

function getTodayLabel() {
  return new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
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

  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpStore, setFollowUpStore] = useState(null)

  const [unread, setUnread] = useState(0)
  const [notifs, setNotifs] = useState([])
  const [agmAlert, setAgmAlert] = useState(null)

  const profileRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const h = e => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

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
        } catch {
          alert('Error al borrar la cartera. Intenta de nuevo.')
        }
      }
    })
  }

  useEffect(() => { loadUnread() }, [])
  useRealtime(
    () => { loadUnread() },
    (msg) => {
      if (msg?.type === 'AGM_NEW_TASKS' && msg.agente?.toLowerCase() === user?.email?.toLowerCase()) {
        setAgmAlert({ count: msg.count })
      }
    }
  )

  useEffect(() => {
    heartbeat()
    const iv = setInterval(heartbeat, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const firstName = user?.nickname?.trim() || user?.fullName?.split(' ')[0] || 'Farmer'

  const BOTTOM_NAV = NAV_ITEMS.filter(n => ['dashboard', 'stores', 'management', 'agm'].includes(n.key))

  const openFollowUp = (store) => { setFollowUpStore(store ?? null); setFollowUpOpen(true) }

  const ctxValue = { firstName, openFollowUp, goTo }

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
            {NAV_ITEMS.map(item => (
              <button
                key={item.key}
                className={`${styles.navItem} ${activeNav === item.key ? styles.active : ''}`}
                onClick={() => goTo(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className={styles.navIconWrap} style={{ background: item.bg, borderColor: item.color + '33', color: item.color }}>{item.icon}</span>
                {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
              </button>
            ))}
          </nav>

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

          {agmAlert && (
            <div className={styles.agmAlertBanner} role="alert">
              <span>🔔 {agmAlert.count} tarea{agmAlert.count === 1 ? '' : 's'} nueva{agmAlert.count === 1 ? '' : 's'} en Gestión AGM-IA</span>
              <div>
                <button onClick={() => { setAgmAlert(null); goTo('agm') }}>Ver ahora</button>
                <button onClick={() => setAgmAlert(null)}>Cerrar</button>
              </div>
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
          {BOTTOM_NAV.map(item => (
            <button
              key={item.key}
              className={`${styles.bottomNavItem} ${activeNav === item.key ? styles.active : ''}`}
              onClick={() => { goTo(item.key); setSidebarMobileOpen(false) }}
            >
              <span className={styles.bottomNavIcon} style={{ color: item.color }}>{item.icon}</span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        {followUpOpen && (
          <FollowUpModal
            initialStore={followUpStore}
            onClose={() => { setFollowUpOpen(false); setFollowUpStore(null) }}
            onSaved={() => { setFollowUpOpen(false); setFollowUpStore(null) }}
          />
        )}
      </div>
    </DashboardProvider>
  )
}
