import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../hooks/useRealtime'
import { logout } from '../services/authService'
import { clearStores, getImportStatus } from '../services/importService'
import { getDashboard, getBasesForFarmer, updateBaseStatus,
         getUnreadCount, getNotifications, markAllNotifRead } from '../services/dashboardService'
import { getStores } from '../services/storeService'
import api from '../services/api'
import StoreSection from '../components/StoreSection'
import FollowUpModal from '../components/FollowUpModal'
import StoreTable from '../components/StoreTable'
import MetricCard from '../components/MetricCard'
import ExcelUpload from '../components/ExcelUpload'
import ProfilePage from './ProfilePage'
import ManagementPage from './ManagementPage'
import WhatsappPage from './WhatsappPage'
import ReportsPage from './ReportsPage'
import styles from './DashboardPage.module.css'

const NAV_ITEMS = [
  { icon: '◼', label: 'Dashboard',    key: 'dashboard' },
  { icon: '🏪', label: 'Tiendas',      key: 'stores' },
  { icon: '📦', label: 'Mis bases',    key: 'bases' },
  { icon: '📥', label: 'Cargar Excel', key: 'excel' },
  { icon: '📋', label: 'Gestiones',    key: 'management' },
  { icon: '💬', label: 'WhatsApp',     key: 'whatsapp' },
  { icon: '📊', label: 'Reportes',     key: 'reports' },
  { icon: '👤', label: 'Mi perfil',    key: 'profile' },
]

const SECTIONS = [
  { key: 'recommended',        title: 'Recomendado hoy',      icon: '⭐', color: '#FF441F' },
  { key: 'onboardingCritical', title: 'Onboarding Crítico',   icon: '🚨', color: '#EF4444' },
  { key: 'aliados',            title: 'Aliados AVA 8–14',     icon: '🔗', color: '#F97316' },
  { key: 'churnRisk',          title: 'Riesgo Churn',         icon: '⚠️', color: '#EF4444' },
  { key: 'ava',                title: 'AVA Bajando',          icon: '📉', color: '#F59E0B' },
  { key: 'healthy',            title: 'Saludables',           icon: '✅', color: '#22C55E' },
  { key: 'selfOnboarding',     title: 'Self-Onboarding',      icon: '🛒', color: '#8B5CF6' },
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
  const [activeNav, setActiveNav]     = useState('excel')
  const [importedToday, setImportedToday] = useState(null) // null = cargando
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen]   = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)

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

  // Verificar si el cargue diario es obligatorio (después de las 12 PM y no ha cargado hoy)
  useEffect(() => {
    getImportStatus()
      .then(({ data }) => {
        const required = data.required === true
        setImportedToday(!required)
        if (!required) setActiveNav('dashboard')
      })
      .catch(() => { setImportedToday(true); setActiveNav('dashboard') })
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

  const handleClearStores = async () => {
    if (!window.confirm('¿Estás seguro de que quieres borrar toda tu cartera? Esta acción no se puede deshacer.')) return
    try {
      await clearStores()
      setDash(null)
      setStores([])
      setProfileOpen(false)
      loadDash()
    } catch {
      alert('Error al borrar la cartera. Intenta de nuevo.')
    }
  }

  const handleBaseStatus = async (assignmentId, nextStatus) => {
    if (!nextStatus) return
    try {
      await updateBaseStatus(assignmentId, nextStatus)
      await loadBases()
    } catch {}
  }

  useEffect(() => { loadDash(); loadUnread() }, [])
  useRealtime(() => { loadDash(); loadUnread() })

  useEffect(() => {
    if (activeNav === 'stores')  loadStores()
    if (activeNav === 'bases')   loadBases()
  }, [activeNav])

  const firstName = user?.fullName?.split(' ')[0] ?? 'Farmer'

  // Métricas del dashboard
  const totalStores    = dash?.totalCount ?? 0
  const onboardCount   = dash?.onboardingCritical?.length ?? 0
  const churnCount     = dash?.churnRisk?.length ?? 0
  const healthyCount   = dash?.healthy?.length ?? 0

  return (
    <div className={styles.layout}>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarDot} />
          <span className={styles.sidebarBrandName}>Rappi Farmer</span>
        </div>

        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map(item => {
            const blocked = importedToday === false && item.key !== 'excel' && item.key !== 'profile'
            return (
              <button
                key={item.key}
                className={`${styles.navItem} ${activeNav === item.key ? styles.active : ''} ${blocked ? styles.navItemBlocked : ''}`}
                onClick={() => !blocked && setActiveNav(item.key)}
                title={blocked ? 'Carga el Excel del día para habilitar este módulo' : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
                {blocked && <span className={styles.navLock}>🔒</span>}
              </button>
            )
          })}
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
              <button className={styles.profileMenuItem} onClick={() => { setActiveNav('profile'); setProfileOpen(false) }}>
                <span>👤</span> Mi perfil
              </button>
              <button className={styles.profileMenuItem} onClick={() => { setActiveNav('excel'); setProfileOpen(false) }}>
                <span>📥</span> Cargar Excel
              </button>
              <div className={styles.profileMenuDivider} />
              <button className={`${styles.profileMenuItem} ${styles.profileMenuItemDanger}`} onClick={handleClearStores}>
                <span>🗑️</span> Borrar cartera
              </button>
              <button className={`${styles.profileMenuItem} ${styles.profileMenuItemDanger}`} onClick={logout}>
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
          <h1 className={styles.pageTitle}>{NAV_ITEMS.find(n=>n.key===activeNav)?.label}</h1>
          <div className={styles.topbarRight}>
            <button className={styles.btnFollowUpTop} onClick={() => setFollowUpOpen(true)}>Follow up</button>
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
                        <span className={styles.notifMsg}>{n.message}</span>
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
                Debes cargar el Excel antes de empezar el turno
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8B93A8' }}>
                Ningún módulo estará disponible hasta que cargues el reporte diario de Rappi.
              </p>
            </div>
            <button
              onClick={() => setActiveNav('excel')}
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
              onGoToExcel={() => setActiveNav('excel')}
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
                    <BaseCard key={base.id} base={base} onStatusChange={handleBaseStatus} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Cargar Excel ── */}
          {activeNav === 'excel' && (
            <ExcelUpload
              onImported={() => { setImportedToday(true); loadDash() }}
              onDashboard={() => setActiveNav('dashboard')}
            />
          )}

          {/* ── Perfil ── */}
          {activeNav === 'profile' && <ProfilePage />}

          {activeNav === 'management' && <ManagementPage />}
          {activeNav === 'whatsapp'  && <WhatsappPage />}

          {activeNav === 'reports' && <ReportsPage />}

        </main>
      </div>

      {followUpOpen && (
        <FollowUpModal
          onClose={() => setFollowUpOpen(false)}
          onSaved={() => { setFollowUpOpen(false); loadDash(); loadStores() }}
        />
      )}
    </div>
  )
}

const CHURN_FILTERS = ['Todos', 'Churn', 'Prevention W1', 'Prevention W2', 'Prevention W3']
const AVA_FILTERS   = ['Todos', 'Crítico', 'Bajando']

/* ── Vista principal del dashboard con tabs horizontales ── */
function DashboardView({ firstName, dash, dashLoading, totalStores, onboardCount, churnCount, healthyCount, onRefresh, onGoToExcel }) {
  const [activeTab, setActiveTab]       = useState(SECTIONS[0].key)
  const [churnFilter, setChurnFilter]   = useState('Todos')
  const [avaFilter, setAvaFilter]       = useState('Todos')
  const [search, setSearch]             = useState('')
  const [hoSyncing, setHoSyncing]         = useState(false)
  const [hoResult, setHoResult]           = useState(null)
  const [hoOpen, setHoOpen]               = useState(false)
  const [hoData, setHoData]               = useState([])
  const [hoMeetConectado, setHoMeetConectado] = useState(false)

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
    ? filtered.filter(s =>
        s.storeName?.toLowerCase().includes(search.toLowerCase()) ||
        s.storeCode?.toLowerCase().includes(search.toLowerCase())
      )
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

      {/* Tabs horizontales */}
      <div className={styles.tabBar}>
        {SECTIONS.map(s => {
          const count = dash?.[s.key]?.length ?? 0
          const isActive = activeTab === s.key
          return (
            <button
              key={s.key}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              style={isActive ? { borderBottomColor: s.color, color: s.color } : {}}
              onClick={() => { setActiveTab(s.key); setChurnFilter('Todos'); setAvaFilter('Todos') }}
            >
              <span>{s.icon}</span>
              <span>{s.title}</span>
              {count > 0 && (
                <span className={styles.tabCount}
                  style={isActive ? { background: s.color + '22', color: s.color } : {}}>
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
function BaseCard({ base, onStatusChange }) {
  const [open, setOpen] = useState(false)
  const nextStatus = STATUS_NEXT[base.status] ?? null
  const { bg, color } = STATUS_COLOR[base.status] ?? {}

  return (
    <div className={styles.baseCard}>
      <div className={styles.baseHeader} onClick={() => setOpen(o=>!o)}>
        <div className={styles.baseLeft}>
          <span className={styles.baseType}>{base.baseType}</span>
          <span className={styles.baseStoreCount}>{base.stores?.length ?? 0} tiendas</span>
          <span className={styles.baseStatusBadge} style={{ background: bg, color }}>{base.status?.replace(/_/g,' ')}</span>
        </div>
        <div className={styles.baseRight}>
          {nextStatus && (
            <button
              className={styles.btnAdvance}
              onClick={e => { e.stopPropagation(); onStatusChange(base.id, nextStatus) }}
            >
              Avanzar → {nextStatus.replace(/_/g,' ')}
            </button>
          )}
          <span className={styles.chevronSm}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && base.stores?.length > 0 && (
        <div className={styles.baseStores}>
          {base.stores.map(s => (
            <div key={s.id} className={styles.baseStoreRow}>
              <span className={styles.baseStoreName}>{s.storeName}</span>
              <span className={styles.baseStoreCode}>{s.storeCode}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
