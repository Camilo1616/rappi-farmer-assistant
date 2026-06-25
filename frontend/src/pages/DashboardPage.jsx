import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../hooks/useRealtime'
import { logout, heartbeat } from '../services/authService'
import { clearStores, getImportStatus } from '../services/importService'
import { getDashboard, getBasesForFarmer, updateBaseStatus,
         getUnreadCount, getNotifications, markAllNotifRead,
         registerManagement } from '../services/dashboardService'
import { createPortal } from 'react-dom'
import { getStores } from '../services/storeService'
import api from '../services/api'
import AiAssistant from '../components/AiAssistant'
import StoreSection from '../components/StoreSection'
import FollowUpModal from '../components/FollowUpModal'
import StoreTable from '../components/StoreTable'
import MetricCard from '../components/MetricCard'
import ExcelUpload from '../components/ExcelUpload'
import ProfilePage from './ProfilePage'
import ManagementPage from './ManagementPage'
import WhatsappPage from './WhatsappPage'
import ReportsPage from './ReportsPage'
import ConfirmModal from '../components/ConfirmModal'
import styles from './DashboardPage.module.css'

const NAV_TO_PATH = {
  dashboard: '',
  stores: 'stores',
  bases: 'bases',
  excel: 'excel',
  management: 'gestiones',
  whatsapp: 'whatsapp',
  reports: 'reportes',
  profile: 'perfil',
}
const PATH_TO_NAV = Object.fromEntries(
  Object.entries(NAV_TO_PATH).map(([k, v]) => [v, k])
)

const SIDEBAR_SEGMENT_FILTERS = [
  { key: 'Todos',       label: 'Todos',       color: '#8B93A8' },
  { key: 'Onboarding',  label: 'Onboarding',  color: '#3B82F6' },
  { key: 'Churn',       label: 'Churn',       color: '#EF4444' },
  { key: 'AVA',         label: 'AVA Bajando',  color: '#F59E0B' },
  { key: 'Saludable',   label: 'Saludable',   color: '#22C55E' },
]

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
  { icon: <IC d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" d2="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />, color: '#94A3B8', bg: 'rgba(148,163,184,0.13)', label: 'Perfil',    key: 'profile'    },
]

const SECTIONS = [
  { key: 'onboardingCritical', title: 'Aliados 1-7',    short: 'Aliados 1-7',  icon: '🚨', color: '#EF4444' },
  { key: 'aliados',            title: 'Tiendas 8-14',   short: 'Tiendas 8-14', icon: '🔗', color: '#F97316' },
  { key: 'churnRisk',          title: 'Riesgo Churn',   short: 'Churn',        icon: '⚠️', color: '#EF4444' },
  { key: 'ava',                title: 'AVA Bajando',    short: 'AVA',          icon: '📉', color: '#F59E0B' },
  { key: 'healthy',            title: 'Saludables',     short: 'Saludables',   icon: '✅', color: '#22C55E' },
  { key: 'selfOnboarding',     title: 'Self-Onboarding',short: 'Self',         icon: '🛒', color: '#8B5CF6' },
  { key: 'insideSales',        title: 'Gestión IS',     short: 'Gestión IS',   icon: '📋', color: '#0EA5E9' },
]

const STATUS_ORDER = ['SIN_LEER','LEIDA','EN_PROCESO','COMPLETADO']
const STATUS_NEXT  = { SIN_LEER:'LEIDA', LEIDA:'EN_PROCESO', EN_PROCESO:'COMPLETADO', COMPLETADO:null }
const STATUS_COLOR = {
  SIN_LEER:   { bg:'rgba(59,130,246,0.1)',  color:'#3B82F6' },
  LEIDA:      { bg:'rgba(249,115,22,0.1)',  color:'#F97316' },
  EN_PROCESO: { bg:'rgba(234,179,8,0.12)',  color:'#EAB308' },
  COMPLETADO: { bg:'rgba(34,197,94,0.1)',   color:'#22C55E' },
}

function getTodayLabel() {
  return new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
}

function getInitials(name='') {
  return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
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

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const activeNav = useMemo(() => {
    const segment = location.pathname.replace(/^\/dashboard\/?/, '')
    return PATH_TO_NAV[segment] ?? 'dashboard'
  }, [location.pathname])

  const goTo = (key) => {
    const path = NAV_TO_PATH[key]
    navigate('/dashboard' + (path ? '/' + path : ''))
  }

  const [importedToday, setImportedToday] = useState(null) // null = cargando
  const [hasStores, setHasStores]     = useState(true) // optimista mientras carga
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen]   = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [sidebarFiltersOpen, setSidebarFiltersOpen] = useState(false)
  const [sidebarSegment, setSidebarSegment] = useState('Todos')
  const [confirmAction, setConfirmAction] = useState(null)

  // Dashboard data
  const [dash, setDash]             = useState(null)
  const [dashLoading, setDashLoading] = useState(true)

  // Stores (vista plana)
  const [stores, setStores]         = useState([])
  const [storesLoading, setStoresLoading] = useState(false)

  // Bases
  const [bases, setBases]           = useState([])
  const [basesLoading, setBasesLoading] = useState(false)

  // Notificaciones
  const [unread, setUnread]         = useState(0)
  const [notifs, setNotifs]         = useState([])

  const profileRef = useRef(null)
  const notifRef   = useRef(null)

  // Verificar si debe cargar base obligatoriamente
  useEffect(() => {
    getImportStatus()
      .then(({ data }) => {
        const stores = data.hasStores !== false
        const required = data.required === true
        setHasStores(stores)
        setImportedToday(!required)
        if (required) navigate('/dashboard/excel', { replace: true })
        // Si no es requerido, no forzar ruta — el usuario navega libremente
      })
      .catch(() => { setHasStores(true); setImportedToday(true) })
  }, [])

  useEffect(() => {
    const h = e => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (notifRef.current   && !notifRef.current.contains(e.target))   setNotifOpen(false)
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

  const loadStores = async () => {
    setStoresLoading(true)
    try {
      const { data } = await getStores()
      setStores(data.content ?? data)
    } finally { setStoresLoading(false) }
  }

  const loadBases = async () => {
    setBasesLoading(true)
    try {
      const { data } = await getBasesForFarmer()
      setBases(data)
    } finally { setBasesLoading(false) }
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
          setStores([])
          loadDash()
        } catch {
          alert('Error al borrar la cartera. Intenta de nuevo.')
        }
      }
    })
  }

  const handleBaseStatus = async (assignmentId, nextStatus, comment) => {
    if (!nextStatus) return
    try {
      await updateBaseStatus(assignmentId, nextStatus, comment)
      await loadBases()
    } catch {}
  }

  useEffect(() => { loadDash(); loadUnread() }, [])
  useRealtime(() => { loadDash(); loadUnread() })

  // Heartbeat cada 5 minutos mientras el farmer tiene la app abierta
  useEffect(() => {
    heartbeat()
    const iv = setInterval(heartbeat, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (activeNav === 'stores')  loadStores()
    if (activeNav === 'bases')   loadBases()
  }, [activeNav])  // eslint-disable-line

  const firstName = user?.nickname?.trim() || user?.fullName?.split(' ')[0] || 'Farmer'

  // Métricas del dashboard
  const totalStores    = dash?.totalCount ?? 0
  const onboardCount   = dash?.onboardingCritical?.length ?? 0
  const churnCount     = dash?.churnRisk?.length ?? 0
  const healthyCount   = dash?.healthy?.length ?? 0

  // Ítems de la bottom nav (los más usados en mobile)
  const BOTTOM_NAV = NAV_ITEMS.filter(n => ['dashboard','stores','management','whatsapp','excel'].includes(n.key))

  return (
    <div className={styles.layout}>

      {/* ── Overlay mobile (cierra sidebar al tocar fuera) ── */}
      {sidebarMobileOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
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
            const blocked = importedToday === false && item.key !== 'excel' && item.key !== 'profile'
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

        {/* ── Filtros sidebar ── */}
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
            onKeyDown={e => e.key==='Enter' && setProfileOpen(o=>!o)}
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

      {/* ── Contenido ── */}
      <div className={styles.content}>

        {/* Topbar */}
        <div className={styles.topbar}>
          <button className={styles.hamburger} onClick={() => setSidebarMobileOpen(o => !o)} aria-label="Menú">☰</button>
          <h1 className={styles.pageTitle}>{NAV_ITEMS.find(n=>n.key===activeNav)?.label}</h1>
          <div className={styles.topbarRight}>
            <span className={styles.liveIndicator}><span className={styles.liveDot}/> En vivo</span>
            <span className={styles.date}>{getTodayLabel()}</span>

            {/* Campana notificaciones */}
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
                    : notifs.slice(0,8).map(n => (
                      <div key={n.id} className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}>
                        <span className={styles.notifMsg}>{n.title}</span>
                        {n.body && <span className={styles.notifBody}>{n.body}</span>}
                        <span className={styles.notifTime}>{new Date(n.createdAt).toLocaleString('es-CO',{hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Banner obligatorio de cargue diario ── */}
        {importedToday === false && activeNav !== 'excel' && activeNav !== 'profile' && (
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

          {/* ── Dashboard ── */}
          {activeNav === 'dashboard' && (
            <DashboardView
              firstName={firstName}
              dash={dash}
              dashLoading={dashLoading}
              totalStores={totalStores}
              onboardCount={onboardCount}
              churnCount={churnCount}
              healthyCount={healthyCount}
              onRefresh={loadDash}
              onGoToExcel={() => goTo('excel')}
              sidebarSegment={sidebarSegment}
            />
          )}

          {/* ── Tiendas (lista plana) ── */}
          {activeNav === 'stores' && (
            <div className={styles.tableSection}>
              <div className={styles.tableSectionHeader}>
                <span className={styles.tableSectionTitle}>Todas las tiendas</span>
                <span className={styles.tableCount}>{stores.length} tiendas</span>
              </div>
              {storesLoading ? (
                <div className={styles.loadingWrapper}><div className={styles.loadingSpinner}/> Cargando...</div>
              ) : (
                <StoreTable stores={stores} />
              )}
            </div>
          )}

          {/* ── Mis bases ── */}
          {activeNav === 'bases' && (
            <>
              {basesLoading ? (
                <div className={styles.loadingWrapper}><div className={styles.loadingSpinner}/> Cargando bases...</div>
              ) : bases.length === 0 ? (
                <div className={styles.comingSoon}>
                  <span className={styles.comingSoonIcon}>📦</span>
                  <p className={styles.comingSoonText}>No tienes bases asignadas</p>
                  <p className={styles.comingSoonSub}>Tu líder asignará bases próximamente</p>
                </div>
              ) : (
                <div className={styles.sections}>
                  {bases.map(base => (
                    <BaseCard key={base.assignmentId} base={base} onStatusChange={handleBaseStatus} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Cargar Excel ── */}
          {activeNav === 'excel' && (
            <ExcelUpload
              onImported={() => { setImportedToday(true); setHasStores(true); loadDash() }}
              onDashboard={() => goTo('dashboard')}
            />
          )}

          {/* ── Perfil ── */}
          {activeNav === 'profile' && <ProfilePage />}

          {activeNav === 'management' && <ManagementPage />}
          {activeNav === 'whatsapp'  && <WhatsappPage />}

          {activeNav === 'reports' && <ReportsPage />}

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

      {/* ── Bottom nav (solo mobile) ── */}
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
    </div>
  )
}

const CHURN_FILTERS = ['Todos', 'Churn', 'Prevention W1', 'Prevention W2', 'Prevention W3']
const AVA_FILTERS   = ['Todos', 'Retención', 'Bajando']

/* ── Vista principal del dashboard con tabs horizontales ── */
const SEGMENT_TO_TAB = {
  'Onboarding': 'onboardingCritical',
  'Churn':      'churnRisk',
  'AVA':        'ava',
  'Saludable':  'healthy',
}

function DashboardView({ firstName, dash, dashLoading, totalStores, onboardCount, churnCount, healthyCount, onRefresh, onGoToExcel, sidebarSegment }) {
  const [activeTab, setActiveTab]       = useState(SECTIONS[0].key)

  useEffect(() => {
    const tab = SEGMENT_TO_TAB[sidebarSegment]
    if (tab) setActiveTab(tab)
  }, [sidebarSegment])
  const [churnFilter, setChurnFilter]   = useState('Todos')
  const [avaFilter, setAvaFilter]       = useState('Todos')
  const [search, setSearch]             = useState('')
  const [hoSyncing, setHoSyncing]         = useState(false)
  const [hoResult, setHoResult]           = useState(null)
  const [hoOpen, setHoOpen]               = useState(false)
  const [hoData, setHoData]               = useState([])
  const [hoMeetConectado, setHoMeetConectado] = useState(false)
  const [followUpOpen, setFollowUpOpen]   = useState(false)
  const [followUpStore, setFollowUpStore] = useState(null)

  const openConsolidadoHO = async () => {
    setHoSyncing(true)
    setHoResult(null)
    try {
      const { data } = await api.get('/calendar/handoff-summary')
      setHoData(data.handoffs ?? [])
      setHoMeetConectado(data.meetConectado ?? false)
      setHoOpen(true)
    } catch {
      setHoResult({ ok: false, msg: 'Error al cargar consolidado HO' })
    } finally {
      setHoSyncing(false)
    }
  }

  const activeSection = SECTIONS.find(s => s.key === activeTab)
  const rawStores     = dash?.[activeTab] ?? []

  const churnBase = activeTab === 'churnRisk'
    ? rawStores.filter(s => s.diasSinLogin == null || s.diasSinLogin <= 90)
    : rawStores

  const filtered = activeTab === 'churnRisk' && churnFilter !== 'Todos'
    ? churnBase.filter(s => s.churnLabel?.trim().toLowerCase() === churnFilter.trim().toLowerCase())
    : activeTab === 'ava' && avaFilter !== 'Todos'
    ? churnBase.filter(s => s.avaLabel?.trim() === avaFilter)
    : churnBase

  const stores = search.trim()
    ? filtered.filter(s => {
        const q = search.toLowerCase()
        return s.storeName?.toLowerCase().includes(q) ||
               s.storeCode?.toLowerCase().includes(q) ||
               s.brandId?.toLowerCase().includes(q)
      })
    : filtered

  return (
    <>
      {dash?.needsRefresh && (
        <RefreshBanner lastImportDate={dash?.lastImportDate} onRefresh={onGoToExcel} />
      )}
      <div className={styles.welcome}>
        <p className={styles.welcomeText}>Hola, <span>{firstName}</span> 👋</p>
        <p className={styles.welcomeSub}>Resumen de tu cartera para hoy</p>
      </div>

      <div className={styles.metrics}>
        <MetricCard label="Total tiendas"     value={totalStores}  color="blue"   icon="🏪" trend="total" />
        <MetricCard label="Onboarding activo" value={onboardCount} color="orange" icon="🚀" trend="críticos" />
        <MetricCard label="Riesgo churn"      value={churnCount}   color="red"    icon="⚠️" trend="urgente" />
        <MetricCard label="Saludables"        value={healthyCount} color="green"  icon="✅" trend="meta" />
      </div>

      <AiAssistant />

      {/* Tabs — grid 5×2 compacto para caber en portátiles */}
      <div className={styles.tabGrid}>
        {SECTIONS.map(s => {
          const count = dash?.[s.key]?.length ?? 0
          const isActive = activeTab === s.key
          return (
            <button
              key={s.key}
              className={`${styles.tabCard} ${isActive ? styles.tabCardActive : ''}`}
              style={isActive ? { borderColor: s.color + '88', background: s.color + '12' } : {}}
              title={s.title}
              onClick={() => { setActiveTab(s.key); setChurnFilter('Todos'); setAvaFilter('Todos') }}
            >
              <span className={styles.tabCardIcon}>{s.icon}</span>
              <span className={styles.tabCardLabel} style={isActive ? { color: s.color } : {}}>
                {s.short}
              </span>
              {count > 0 && (
                <span className={styles.tabCardCount}
                  style={isActive ? { background: s.color + '30', color: s.color } : {}}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filtros de Churn */}
      {activeTab === 'churnRisk' && (
        <div className={styles.filterBar}>
          {CHURN_FILTERS.map(f => (
            <button key={f}
              className={`${styles.filterChip} ${churnFilter === f ? styles.filterChipActive : ''}`}
              onClick={() => setChurnFilter(f)}
            >
              {f}
              <span className={styles.filterCount}>
                {f === 'Todos'
                  ? churnBase.length
                  : churnBase.filter(s => s.churnLabel?.trim().toLowerCase() === f.trim().toLowerCase()).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filtros de AVA */}
      {activeTab === 'ava' && (
        <div className={styles.filterBar}>
          {AVA_FILTERS.map(f => (
            <button key={f}
              className={`${styles.filterChip} ${avaFilter === f ? styles.filterChipActive : ''}`}
              onClick={() => setAvaFilter(f)}
            >
              {f}
              <span className={styles.filterCount}>
                {f === 'Todos'
                  ? rawStores.length
                  : rawStores.filter(s => s.avaLabel?.trim() === f).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Barra de acciones + buscador */}
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarLeft}>
          <button
            className={styles.btnFollowUp}
            onClick={() => { setFollowUpStore(null); setFollowUpOpen(true) }}
          >
            Follow Up
          </button>
          {activeTab === 'onboardingCritical' && (
            <>
              <button className={styles.btnHoReport} onClick={openConsolidadoHO} disabled={hoSyncing}>
                {hoSyncing ? '⏳ Cargando...' : '🤝 Consolidado HO'}
              </button>
              {hoResult && (
                <span className={hoResult.ok ? styles.hoResultOk : styles.hoResultErr}>
                  {hoResult.msg}
                </span>
              )}
            </>
          )}
        </div>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar tienda o código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {/* Tabla del tab activo */}
      {dashLoading ? (
        <div className={styles.loadingWrapper}>
          <div className={styles.loadingSpinner} /> Cargando cartera...
        </div>
      ) : (
        <StoreSection
          key={activeTab + churnFilter + avaFilter + search}
          title={activeSection.title}
          icon={activeSection.icon}
          color={activeSection.color}
          stores={stores}
          onRefresh={onRefresh}
          hideHeader
          isChurn={activeTab === 'churnRisk'}
          isAva={activeTab === 'ava' || activeTab === 'healthy'}
          onFollowUp={s => { setFollowUpStore(s); setFollowUpOpen(true) }}
        />
      )}

      {/* Modal Consolidado HO */}
      {hoOpen && (
        <div className={styles.hoOverlay} onClick={() => setHoOpen(false)}>
          <div className={styles.hoModal} onClick={e => e.stopPropagation()}>
            <div className={styles.hoModalHeader}>
              <span>🤝 Consolidado HO — últimos 14 días / próximos 7</span>
              <button className={styles.hoModalClose} onClick={() => setHoOpen(false)}>✕</button>
            </div>
            {!hoMeetConectado ? (
              <div className={styles.hoBlocked}>
                <div className={styles.hoBlockedIcon}>🔒</div>
                <p className={styles.hoBlockedTitle}>Acceso restringido</p>
                <p className={styles.hoBlockedMsg}>
                  Para ver el Consolidado HO con datos reales de duración y participantes,
                  <strong> Jesus David Ruiz</strong> debe iniciar sesión en el sistema
                  y conectar su Google Calendar desde <em>Mi Perfil</em>.
                </p>
                <p className={styles.hoBlockedSub}>
                  Es el organizador de todos los HOs — sus credenciales son necesarias
                  para consultar la API de Google Meet.
                </p>
                <button className={styles.hoBlockedClose} onClick={() => setHoOpen(false)}>
                  Entendido
                </button>
              </div>
            ) : hoData.length === 0 ? (
              <p className={styles.hoEmpty}>No hay handoffs en esta ventana de tiempo.<br/>Asegúrate de tener el Google Calendar sincronizado.</p>
            ) : (
              <>
              <table className={styles.hoTable}>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Brand ID</th>
                    <th>Tienda</th>
                    <th>Farmer</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Duración real</th>
                    <th>Aliado conectado</th>
                    <th>Participantes Meet</th>
                    <th>Invitados calendar</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {hoData.map((h, i) => (
                    <tr key={i} className={h.exitoso ? styles.hoRowOk : styles.hoRowFail}>
                      <td>{h.exitoso ? '✅ Exitoso' : '❌ No exitoso'}</td>
                      <td>{h.brandId}</td>
                      <td>{h.storeName}</td>
                      <td>{h.farmerEmail}</td>
                      <td>{h.eventDate}</td>
                      <td>{h.eventTime ?? '—'}</td>
                      <td>
                        {h.duracionRealMin != null
                          ? <span className={h.duracionOk ? styles.hoTagOk : styles.hoTagFail}>
                              {h.duracionRealMin} min
                            </span>
                          : <span className={styles.hoTagGray}>{h.duracionProgramadaMin} min*</span>
                        }
                      </td>
                      <td>
                        {h.alinadoConectado == null ? <span className={styles.hoTagGray}>—</span>
                          : h.alinadoConectado
                            ? <span className={styles.hoTagOk}>✓ Sí</span>
                            : <span className={styles.hoTagFail}>✗ No</span>
                        }
                      </td>
                      <td className={styles.hoEmails}>
                        {h.participantes?.length
                          ? h.participantes.map((p, j) => (
                              <span key={j} className={p.esExterno ? styles.hoEmailExterno : styles.hoEmailInterno}>
                                {p.displayName || 'Anónimo'}
                                {p.tiempoEnReunionMin > 0 && <span className={styles.hoEmailTime}> ({p.tiempoEnReunionMin}m)</span>}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td className={styles.hoEmails}>
                        {h.attendeeEmails?.length
                          ? h.attendeeEmails.map((e, j) => (
                              <span key={j} className={e.endsWith('@rappi.com') ? styles.hoEmailInterno : styles.hoEmailExterno}>
                                {e}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td>{h.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.hoNote}>* Duración programada — datos reales de Meet disponibles cuando Jesus David conecte su cuenta</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* ── Tarjeta de base asignada ── */
const TIPOS = ['WHATSAPP','LLAMADA','SAC','SEGUIMIENTO','ACTIVACION']
const RESULTADOS = ['EFECTIVA','NO_CONTACTO','NO_RESPONDE','PROBLEMA_TECNICO','REQUIERE_SEGUIMIENTO']
const RESULTADO_LABEL = {
  EFECTIVA: 'Efectiva',
  NO_CONTACTO: 'No contacto',
  NO_RESPONDE: 'No responde',
  PROBLEMA_TECNICO: 'Problema técnico',
  REQUIERE_SEGUIMIENTO: 'Requiere seguimiento',
}

function StoreContextMenu({ x, y, store, onClose, onEfectiva }) {
  const [tipo, setTipo] = useState('')
  const [resultado, setResultado] = useState('')
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef()

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])

  const handleSave = async () => {
    if (!tipo || !resultado || !comentario.trim()) return
    setSaving(true)
    setError(null)
    try {
      await registerManagement(store.id, { managementType: tipo, resultType: resultado, comments: comentario })
      if (resultado === 'EFECTIVA') onEfectiva(store.id)
      setDone(true)
      setTimeout(onClose, 900)
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Error al guardar la gestión'
      setError(msg)
      setSaving(false)
    }
  }

  const px = Math.min(x, window.innerWidth - 290)
  const py = Math.min(y, window.innerHeight - 400)

  return createPortal(
    <div ref={ref} className={styles.ctxMenu} style={{ left: px, top: py }}>
      {done ? (
        <div className={styles.ctxDone}>✓ Gestión registrada</div>
      ) : (
        <>
          <div className={styles.ctxTitle}>{store.storeName}</div>
          <div className={styles.ctxSub}>{store.storeCode}</div>

          <div className={styles.ctxFieldLabel}>Tipo de gestión *</div>
          <div className={styles.ctxChips}>
            {TIPOS.map(t => (
              <button
                key={t}
                className={`${styles.ctxChip} ${tipo === t ? styles.ctxChipActive : ''}`}
                onClick={() => setTipo(t)}
              >{t}</button>
            ))}
          </div>

          <div className={styles.ctxFieldLabel}>Resultado *</div>
          <select className={styles.ctxSelect} value={resultado} onChange={e => setResultado(e.target.value)}>
            <option value="">— selecciona —</option>
            {RESULTADOS.map(r => <option key={r} value={r}>{RESULTADO_LABEL[r]}</option>)}
          </select>

          <div className={styles.ctxFieldLabel}>Comentario *</div>
          <textarea
            className={styles.ctxTextarea}
            rows={2}
            placeholder="Requerido..."
            value={comentario}
            onChange={e => setComentario(e.target.value)}
          />

          {error && <div className={styles.ctxError}>{error}</div>}
          <div className={styles.ctxActions}>
            <button className={styles.ctxBack} onClick={onClose}>Cancelar</button>
            <button
              className={styles.ctxSave}
              disabled={!tipo || !resultado || !comentario.trim() || saving}
              onClick={handleSave}
            >{saving ? 'Guardando...' : 'Registrar gestión'}</button>
          </div>
        </>
      )}
    </div>,
    document.body
  )
}

function BaseCard({ base, onStatusChange }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, store }
  const [efectivas, setEfectivas] = useState(new Set())
  const nextStatus = STATUS_NEXT[base.status] ?? null
  const { bg, color } = STATUS_COLOR[base.status] ?? {}

  const handleAdvance = async (e) => {
    e.stopPropagation()
    if (!nextStatus) return
    setSaving(true)
    try {
      await onStatusChange(base.assignmentId, nextStatus)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.baseCard}>
      <div className={styles.baseHeader} onClick={() => setOpen(o=>!o)}>
        <div className={styles.baseLeft}>
          <span className={styles.baseType}>{base.type ?? base.baseType}</span>
          <span className={styles.baseStoreCount}>{base.stores?.length ?? 0} tiendas</span>
          <span className={styles.baseStatusBadge} style={{ background: bg, color }}>{base.status?.replace(/_/g,' ')}</span>
        </div>
        <div className={styles.baseRight}>
          {nextStatus && (
            <button className={styles.btnAdvance} disabled={saving} onClick={handleAdvance}>
              {saving ? '...' : `Avanzar → ${nextStatus.replace(/_/g,' ')}`}
            </button>
          )}
          <span className={styles.chevronSm}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <>
          {base.stores?.length > 0 && (
            <div className={styles.baseStoresTable}>
              <div className={styles.baseStoresHint}>Click derecho en una fila para tipificar</div>
              <table className={styles.storeTable}>
                <thead>
                  <tr>
                    <th>Tienda</th>
                    <th>Código</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Conexión</th>
                  </tr>
                </thead>
                <tbody>
                  {base.stores.map(s => {
                    const isEfectiva = efectivas.has(s.id)
                    return (
                      <tr
                        key={s.id}
                        className={isEfectiva ? styles.trEfectiva : ''}
                        onContextMenu={isEfectiva ? undefined : e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, store: s }) }}
                        title={isEfectiva ? 'Gestión efectiva registrada' : 'Click derecho para tipificar'}
                        style={{ cursor: isEfectiva ? 'default' : 'context-menu' }}
                      >
                        <td>{s.storeName} {isEfectiva && <span className={styles.efectivaBadge}>✓ Efectiva</span>}</td>
                        <td className={styles.tdCode}>{s.storeCode}</td>
                        <td className={styles.tdMono}>{s.phoneNumber ?? '—'}</td>
                        <td>{s.currentStatus ?? '—'}</td>
                        <td>{s.connectionPercentage != null ? `${s.connectionPercentage}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {ctxMenu && (
            <StoreContextMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              store={ctxMenu.store}
              onClose={() => setCtxMenu(null)}
              onEfectiva={storeId => setEfectivas(prev => new Set([...prev, storeId]))}
            />
          )}

        </>
      )}

      {followUpOpen && (
        <FollowUpModal
          initialStore={followUpStore}
          onClose={() => { setFollowUpOpen(false); setFollowUpStore(null) }}
          onSaved={() => { onRefresh(); setFollowUpOpen(false); setFollowUpStore(null) }}
        />
      )}
    </div>
  )
}
