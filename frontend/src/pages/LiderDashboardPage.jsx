import { useState, useEffect, useRef, useCallback } from 'react'
import { getLiderDashboard, getBasesForLider, getTodayManagements,
         getNotifications, getUnreadCount, markAllNotifRead, getBaseStores } from '../services/dashboardService'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/authService'
import ProfilePage from './ProfilePage'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '')

const TIPO_COLOR = {
  WHATSAPP: { bg: '#dcfce7', color: '#166534' },
  LLAMADA:  { bg: '#dbeafe', color: '#1d4ed8' },
  SAC:      { bg: '#fce7f3', color: '#9d174d' },
  SEGUIMIENTO: { bg: '#fef9c3', color: '#854d0e' },
  ACTIVACION:  { bg: '#ede9fe', color: '#5b21b6' },
}
const RESULTADO_COLOR = {
  EFECTIVA:            { bg: '#dcfce7', color: '#166534' },
  NO_CONTACTO:         { bg: '#fef9c3', color: '#854d0e' },
  NO_RESPONDE:         { bg: '#f1f5f9', color: '#475569' },
  PROBLEMA_TECNICO:    { bg: '#fee2e2', color: '#991b1b' },
  REQUIERE_SEGUIMIENTO:{ bg: '#ede9fe', color: '#5b21b6' },
}
const STATUS_COLOR = {
  SIN_LEER:   { bg: '#f1f5f9',   color: '#475569',  label: 'Sin leer' },
  LEIDA:      { bg: '#dbeafe',   color: '#1d4ed8',  label: 'Leída' },
  EN_PROCESO: { bg: '#fef9c3',   color: '#854d0e',  label: 'En proceso' },
  COMPLETADO: { bg: '#dcfce7',   color: '#166534',  label: 'Completado' },
}
const BASE_TYPE_LABEL = {
  CHURN: 'Churn', ACTIVE_F7D: 'Activos 7d', RETENCION: 'Retención',
  AVA_8_14: 'AVA 8-14', PRIORIZACION: 'Priorización',
}

function semaforo(f) {
  if (f.gestionesHoy === 0) return { color: '#dc2626', bg: '#fee2e2', icon: '🔴', label: 'Sin iniciar' }
  if (f.exitosasHoy >= 8)   return { color: '#16a34a', bg: '#dcfce7', icon: '🟢', label: 'En meta' }
  return                           { color: '#d97706', bg: '#fef9c3', icon: '🟡', label: 'En progreso' }
}

function Chip({ label, scheme }) {
  const s = scheme || { bg: '#f1f5f9', color: '#475569' }
  return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{label}</span>
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ff441f', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function LiderDashboardPage() {
  const { user } = useAuth()
  const [activeNav, setActiveNav] = useState('dashboard')
  const [data, setData]           = useState(null)
  const [bases, setBases]         = useState([])
  const [managements, setMgts]    = useState([])
  const [loading, setLoading]     = useState(true)
  const [sort, setSort]           = useState('semaforo')
  const [expandedFarmer, setExpandedFarmer] = useState(null)
  const [expandedBase, setExpandedBase]     = useState(null)
  const [baseStoresData, setBaseStoresData] = useState({}) // baseId -> stores array
  const [baseStoresLoading, setBaseStoresLoading] = useState({})
  const [activeTab, setActiveTab] = useState('gestiones') // 'gestiones' | 'bases'

  // Notificaciones
  const [notifs, setNotifs]       = useState([])
  const [unread, setUnread]       = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef()

  const load = useCallback(async () => {
    try {
      const [dashRes, basesRes, mgtsRes, unreadRes] = await Promise.allSettled([
        getLiderDashboard(),
        getBasesForLider(),
        getTodayManagements(),
        getUnreadCount(),
      ])
      if (dashRes.status === 'fulfilled')  setData(dashRes.value.data)
      if (basesRes.status === 'fulfilled') setBases(basesRes.value.data || [])
      if (mgtsRes.status === 'fulfilled')  setMgts(mgtsRes.value.data || [])
      if (unreadRes.status === 'fulfilled') setUnread(unreadRes.value.data?.count ?? 0)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Polling de notificaciones cada 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await getUnreadCount()
        setUnread(r.data?.count ?? 0)
      } catch {}
    }
    poll()
    const interval = setInterval(() => { poll(); load() }, 30000)
    return () => clearInterval(interval)
  }, [load])

  // Cargar tiendas de una base con sus gestiones del día
  const loadBaseStores = useCallback(async (baseId) => {
    setBaseStoresLoading(prev => ({ ...prev, [baseId]: true }))
    try {
      const r = await getBaseStores(baseId)
      setBaseStoresData(prev => ({ ...prev, [baseId]: r.data || [] }))
    } catch {
      setBaseStoresData(prev => ({ ...prev, [baseId]: [] }))
    } finally {
      setBaseStoresLoading(prev => ({ ...prev, [baseId]: false }))
    }
  }, [])

  // Polling en tiempo real para la base expandida — cada 15s
  const expandedBaseRef = useRef(null)
  useEffect(() => {
    expandedBaseRef.current = expandedBase
    if (expandedBase != null) loadBaseStores(expandedBase)
  }, [expandedBase, loadBaseStores])

  useEffect(() => {
    const interval = setInterval(() => {
      if (expandedBaseRef.current != null) loadBaseStores(expandedBaseRef.current)
    }, 15000)
    return () => clearInterval(interval)
  }, [loadBaseStores])

  // Cerrar notif dropdown al clicar fuera
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openNotifs = async () => {
    setNotifOpen(o => !o)
    if (!notifOpen) {
      const r = await getNotifications().catch(() => null)
      if (r) setNotifs(r.data || [])
    }
  }
  const handleMarkRead = async () => {
    await markAllNotifRead().catch(() => {})
    setUnread(0)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleLogout = () => { logout(); window.location.href = '/login' }

  const now = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

  // Farmers ordenados
  const farmers = [...(data?.farmers || [])].sort((a, b) => {
    if (sort === 'semaforo') {
      const order = { '🔴': 0, '🟡': 1, '🟢': 2 }
      return (order[semaforo(a).icon] ?? 3) - (order[semaforo(b).icon] ?? 3)
    }
    if (sort === 'gestiones') return b.gestionesHoy - a.gestionesHoy
    if (sort === 'efectivas')  return b.exitosasHoy - a.exitosasHoy
    if (sort === 'tiendas')    return b.totalStores - a.totalStores
    return 0
  })

  // Gestiones agrupadas por farmerId
  const mgtsByFarmer = managements.reduce((acc, m) => {
    const key = m.userId || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const NAV = [
    { key: 'dashboard', icon: '◼', label: 'Dashboard' },
    { key: 'profile',   icon: '👤', label: 'Mi perfil' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, background: '#0f172a', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#ff441f', letterSpacing: '-0.5px' }}>Rappi Farmer</span>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Panel Líder</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setActiveNav(key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 20px', background: activeNav === key ? 'rgba(255,68,31,0.15)' : 'transparent',
              border: 'none', borderLeft: activeNav === key ? '3px solid #ff441f' : '3px solid transparent',
              color: activeNav === key ? '#ff441f' : '#94a3b8', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {user?.avatarUrl
            ? <img src={`${API_BASE}${user.avatarUrl}`} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ff441f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                {user?.fullName?.[0]?.toUpperCase()}
              </div>
          }
          <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{user?.fullName}</p>
          <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 8px' }}>Líder</p>
          <button onClick={handleLogout} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ height: 56, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {NAV.find(n => n.key === activeNav)?.label}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>{now}</span>

            {/* Campana */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={openNotifs} style={{ position: 'relative', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px' }}>
                🔔
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 5px', lineHeight: 1.4 }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div style={{ position: 'absolute', right: 0, top: '100%', width: 320, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Notificaciones</span>
                    {unread > 0 && <button onClick={handleMarkRead} style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Marcar todo leído</button>}
                  </div>
                  {notifs.length === 0
                    ? <p style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin notificaciones</p>
                    : notifs.slice(0, 10).map((n, i) => (
                      <div key={n.id || i} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', background: n.read ? '#fff' : '#f0f9ff' }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: n.read ? 400 : 600, color: '#0f172a' }}>{n.title || n.message}</p>
                        {n.body && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{n.body}</p>}
                        <p style={{ margin: '3px 0 0', fontSize: 10, color: '#94a3b8' }}>
                          {new Date(n.createdAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

          {activeNav === 'profile' && <ProfilePage />}

          {activeNav === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Saludo */}
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {greeting}, {user?.nickname || user?.fullName?.split(' ')[0]} 👋
                </h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, textTransform: 'capitalize' }}>{now}</p>
              </div>

              {loading ? <Spinner /> : (
                <>
                  {/* Métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'Farmers',       value: data?.farmers?.length ?? 0,   color: '#0f172a' },
                      { label: 'Tiendas',        value: data?.totalStores ?? 0,       color: '#0f172a' },
                      { label: 'Gestiones hoy',  value: data?.totalGestiones ?? 0,    color: '#1d4ed8' },
                      { label: 'Efectivas hoy',  value: data?.totalEfectivas ?? 0,    color: '#16a34a' },
                      { label: 'No contacto',    value: data?.totalNoContacto ?? 0,   color: '#d97706' },
                      { label: 'Onboarding',     value: data?.totalOnboarding ?? 0,   color: '#7c3aed' },
                      { label: 'Churn',          value: data?.totalChurn ?? 0,        color: '#dc2626' },
                      { label: 'Saludables',     value: data?.totalSaludables ?? 0,   color: '#16a34a' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
                        <p style={{ fontSize: 28, fontWeight: 800, color, margin: '4px 0 0', lineHeight: 1 }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tabs: Equipo / Bases */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '0 20px' }}>
                      {[['gestiones', '👥 Equipo hoy'], ['bases', '📦 Bases']].map(([key, label]) => (
                        <button key={key} onClick={() => setActiveTab(key)} style={{
                          padding: '14px 16px', fontSize: 13, fontWeight: 700, background: 'none', border: 'none',
                          borderBottom: activeTab === key ? '2px solid #ff441f' : '2px solid transparent',
                          color: activeTab === key ? '#ff441f' : '#64748b', cursor: 'pointer', fontFamily: 'inherit',
                          marginBottom: -1,
                        }}>
                          {label}
                          {key === 'bases' && bases.length > 0 && (
                            <span style={{ marginLeft: 6, background: '#ff441f', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px' }}>{bases.length}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Equipo con gestiones expandibles */}
                    {activeTab === 'gestiones' && (
                      <>
                        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>Haz clic en un farmer para ver sus gestiones</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {[['semaforo','Semáforo'],['gestiones','Gestiones'],['efectivas','Efectivas'],['tiendas','Tiendas']].map(([key, label]) => (
                              <button key={key} onClick={() => setSort(key)} style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                border: sort === key ? 'none' : '1px solid #e2e8f0',
                                background: sort === key ? '#0f172a' : '#f8fafc',
                                color: sort === key ? '#fff' : '#475569', cursor: 'pointer', fontFamily: 'inherit',
                              }}>{label}</button>
                            ))}
                          </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                              {['', 'Farmer', 'Código', 'País', 'Tiendas', 'Onb.', 'Churn', 'Gestiones', 'Efectivas', 'No cont.'].map((h, i) => (
                                <th key={i} style={{ padding: '10px 14px', textAlign: i <= 1 ? 'left' : 'center', fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {farmers.map(f => {
                              const s = semaforo(f)
                              const isExp = expandedFarmer === f.id
                              const farmerMgts = mgtsByFarmer[f.id] || []
                              const pct = f.gestionesHoy > 0 ? Math.round((f.exitosasHoy / f.gestionesHoy) * 100) : 0
                              return (
                                <>
                                  <tr key={f.id}
                                    onClick={() => setExpandedFarmer(isExp ? null : f.id)}
                                    style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', background: isExp ? '#f8fafc' : 'transparent' }}
                                    onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = '#fafafa' }}
                                    onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = 'transparent' }}>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      <span title={s.label} style={{ fontSize: 15 }}>{s.icon}</span>
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 14 }}>{isExp ? '▼' : '▶'}</span>
                                        <div>
                                          <p style={{ fontWeight: 600, color: '#0f172a', margin: 0 }}>{f.fullName}</p>
                                          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{f.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: '#ff441f' }}>{f.farmerCode || `#${f.id}`}</span>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{f.countryCode || '—'}</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>{f.totalStores}</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      {f.onboardingCount > 0 ? <Chip label={f.onboardingCount} scheme={{ bg: '#dbeafe', color: '#1d4ed8' }} /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      {f.churnCount > 0 ? <Chip label={f.churnCount} scheme={{ bg: '#fee2e2', color: '#dc2626' }} /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: f.gestionesHoy > 0 ? '#1d4ed8' : '#94a3b8' }}>{f.gestionesHoy}</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                        <span style={{ fontWeight: 700, color: f.exitosasHoy >= 8 ? '#16a34a' : f.exitosasHoy > 0 ? '#d97706' : '#94a3b8' }}>{f.exitosasHoy}</span>
                                        {f.gestionesHoy > 0 && <span style={{ fontSize: 10, color: '#94a3b8' }}>{pct}%</span>}
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', color: f.noContactoHoy > 0 ? '#d97706' : '#94a3b8', fontWeight: f.noContactoHoy > 0 ? 700 : 400 }}>{f.noContactoHoy || '—'}</td>
                                  </tr>

                                  {/* Fila expandida: gestiones del farmer */}
                                  {isExp && (
                                    <tr key={`${f.id}-exp`}>
                                      <td colSpan={10} style={{ padding: 0, background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <div style={{ padding: '12px 24px 16px' }}>
                                          <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Gestiones de {f.fullName} hoy — {farmerMgts.length} total
                                          </p>
                                          {farmerMgts.length === 0
                                            ? <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Sin gestiones registradas hoy</p>
                                            : (
                                              <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                                  <thead>
                                                    <tr style={{ background: '#f1f5f9' }}>
                                                      {['Tienda', 'Brand ID', 'Tipo', 'Resultado', 'Comentario', 'Hora'].map(h => (
                                                        <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {farmerMgts.map((m, i) => (
                                                      <tr key={m.id || i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{m.storeName || '—'}</td>
                                                        <td style={{ padding: '8px 12px', color: '#ff441f', fontWeight: 700 }}>{m.brandId || '—'}</td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                          <Chip label={m.type} scheme={TIPO_COLOR[m.type]} />
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                          <Chip label={m.result} scheme={RESULTADO_COLOR[m.result]} />
                                                        </td>
                                                        <td style={{ padding: '8px 12px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.comment || '—'}</td>
                                                        <td style={{ padding: '8px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                          {m.createdAt ? new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )
                                          }
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )
                            })}
                          </tbody>
                        </table>
                        {farmers.length === 0 && (
                          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                            No hay farmers asignados a tu equipo
                          </div>
                        )}
                      </>
                    )}

                    {/* Tab: Bases */}
                    {activeTab === 'bases' && (
                      <div style={{ padding: 20 }}>
                        {bases.length === 0
                          ? <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '32px 0' }}>No has creado bases aún</p>
                          : bases.map(base => {
                            const isExp = expandedBase === base.id
                            const assignments = base.assignments || []
                            const completadas = assignments.filter(a => a.status === 'COMPLETADO').length
                            const enProceso   = assignments.filter(a => a.status === 'EN_PROCESO').length
                            const sinLeer     = assignments.filter(a => a.status === 'SIN_LEER' || a.status === 'LEIDA').length
                            const pct = assignments.length > 0 ? Math.round((completadas / assignments.length) * 100) : 0
                            return (
                              <div key={base.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                                <div onClick={() => setExpandedBase(isExp ? null : base.id)}
                                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isExp ? '#f8fafc' : '#fff' }}>
                                  <span style={{ fontSize: 16 }}>{isExp ? '▼' : '▶'}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{base.title}</span>
                                      <Chip label={BASE_TYPE_LABEL[base.type] || base.type} scheme={{ bg: '#ede9fe', color: '#5b21b6' }} />
                                      <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(base.createdAt).toLocaleDateString('es-CO')}</span>
                                    </div>
                                    {/* Barra de progreso */}
                                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#16a34a' : '#ff441f', borderRadius: 99, transition: 'width 0.3s' }} />
                                      </div>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{pct}% · {completadas}/{assignments.length}</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {sinLeer > 0     && <Chip label={`${sinLeer} pendiente${sinLeer > 1 ? 's' : ''}`} scheme={STATUS_COLOR.SIN_LEER} />}
                                    {enProceso > 0   && <Chip label={`${enProceso} en proceso`} scheme={STATUS_COLOR.EN_PROCESO} />}
                                    {completadas > 0 && <Chip label={`${completadas} completada${completadas > 1 ? 's' : ''}`} scheme={STATUS_COLOR.COMPLETADO} />}
                                  </div>
                                </div>

                                {/* Detalle expandido: farmers + tiendas en tiempo real */}
                                {isExp && (
                                  <div style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                    {/* Resumen por farmer */}
                                    {assignments.length > 0 && (
                                      <div style={{ padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
                                        {assignments.map((a, i) => {
                                          const sc = STATUS_COLOR[a.status] || STATUS_COLOR.SIN_LEER
                                          return (
                                            <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 12px' }}>
                                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                                                {a.farmerName?.[0]?.toUpperCase() || '?'}
                                              </div>
                                              <div>
                                                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{a.farmerName || `Farmer #${a.farmerId}`}</p>
                                                <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>{a.storeCount ?? 0} tiendas</p>
                                              </div>
                                              <Chip label={sc.label} scheme={sc} />
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}

                                    {/* Tabla de tiendas en tiempo real */}
                                    <div style={{ padding: '12px 20px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                          Tipificaciones en tiempo real
                                        </p>
                                        <span style={{ fontSize: 10, color: '#94a3b8' }}>· actualiza cada 15s</span>
                                        {baseStoresLoading[base.id] && (
                                          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #ff441f', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                        )}
                                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
                                          {(baseStoresData[base.id] || []).filter(s => s.gestionada).length} / {(baseStoresData[base.id] || []).length} gestionadas
                                        </span>
                                      </div>
                                      {!baseStoresData[base.id]
                                        ? <p style={{ color: '#94a3b8', fontSize: 12 }}>Cargando tiendas...</p>
                                        : baseStoresData[base.id].length === 0
                                          ? <p style={{ color: '#94a3b8', fontSize: 12 }}>Sin tiendas en esta base</p>
                                          : (
                                            <div style={{ overflowX: 'auto' }}>
                                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                                <thead>
                                                  <tr style={{ background: '#f1f5f9' }}>
                                                    {['Estado', 'Tienda', 'Brand ID', 'Farmer', 'Tipo', 'Resultado', 'Comentario', 'Hora'].map(h => (
                                                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {baseStoresData[base.id].map((s, si) => {
                                                    const mgts = s.managements || []
                                                    const firstMgt = mgts[0]
                                                    return (
                                                      <tr key={s.storeId || si} style={{ borderBottom: '1px solid #f1f5f9', background: s.gestionada ? '#f0fdf4' : '#fff' }}>
                                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                          <span title={s.gestionada ? 'Gestionada' : 'Sin gestión'} style={{ fontSize: 16 }}>
                                                            {s.gestionada ? '✅' : '⬜'}
                                                          </span>
                                                        </td>
                                                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.storeName || '—'}</td>
                                                        <td style={{ padding: '8px 12px', color: '#ff441f', fontWeight: 700 }}>{s.brandId || '—'}</td>
                                                        <td style={{ padding: '8px 12px', color: '#475569' }}>{firstMgt?.farmerName || '—'}</td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                          {firstMgt ? <Chip label={firstMgt.type} scheme={TIPO_COLOR[firstMgt.type]} /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                          {firstMgt ? <Chip label={firstMgt.result} scheme={RESULTADO_COLOR[firstMgt.result]} /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                                                        </td>
                                                        <td style={{ padding: '8px 12px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                          {firstMgt?.comment || '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                          {firstMgt?.time ? new Date(firstMgt.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        </td>
                                                      </tr>
                                                    )
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )
                                      }
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        }
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
