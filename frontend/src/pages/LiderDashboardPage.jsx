import { useState, useEffect, useRef, useCallback } from 'react'
import { getLiderDashboard, getBasesForLider, getTodayManagements,
         getNotifications, getUnreadCount, markAllNotifRead, getBaseStores } from '../services/dashboardService'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/authService'
import ProfilePage from './ProfilePage'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '')

const TIPO_COLOR = {
  WHATSAPP:    { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a' },
  LLAMADA:     { bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
  SAC:         { bg: 'rgba(236,72,153,0.12)', color: '#9d174d' },
  SEGUIMIENTO: { bg: 'rgba(234,179,8,0.12)',  color: '#854d0e' },
  ACTIVACION:  { bg: 'rgba(168,85,247,0.12)', color: '#5b21b6' },
}
const RESULTADO_COLOR = {
  EFECTIVA:             { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a' },
  NO_CONTACTO:          { bg: 'rgba(234,179,8,0.12)',  color: '#854d0e' },
  NO_RESPONDE:          { bg: 'rgba(100,116,139,0.12)',color: '#475569' },
  PROBLEMA_TECNICO:     { bg: 'rgba(239,68,68,0.12)',  color: '#991b1b' },
  REQUIERE_SEGUIMIENTO: { bg: 'rgba(168,85,247,0.12)', color: '#5b21b6' },
}
const STATUS_COLOR = {
  SIN_LEER:   { bg: 'rgba(100,116,139,0.12)', color: '#475569', label: 'Sin leer' },
  LEIDA:      { bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8', label: 'Leída' },
  EN_PROCESO: { bg: 'rgba(234,179,8,0.12)',   color: '#854d0e', label: 'En proceso' },
  COMPLETADO: { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a', label: 'Completado' },
}
const BASE_TYPE_LABEL = {
  CHURN: 'Churn', ACTIVE_F7D: 'Activos 7d', RETENCION: 'Retención',
  AVA_8_14: 'AVA 8-14', PRIORIZACION: 'Priorización',
}

const NAV = [
  { key: 'dashboard', icon: '◼',  label: 'Dashboard' },
  { key: 'equipo',    icon: '👥', label: 'Equipo hoy' },
  { key: 'bases',     icon: '📦', label: 'Bases' },
  { key: 'profile',   icon: '👤', label: 'Mi perfil' },
]

function semaforo(f) {
  if (f.gestionesHoy === 0) return { color: '#dc2626', bg: 'rgba(239,68,68,0.1)', icon: '🔴', label: 'Sin iniciar' }
  if (f.exitosasHoy >= 8)   return { color: '#16a34a', bg: 'rgba(34,197,94,0.1)', icon: '🟢', label: 'En meta' }
  return                           { color: '#d97706', bg: 'rgba(234,179,8,0.1)',  icon: '🟡', label: 'En progreso' }
}

function Chip({ label, scheme }) {
  const s = scheme || { bg: 'var(--bg-input)', color: 'var(--text-secondary)' }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ff441f',
        borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function MetricGrid({ data }) {
  const items = [
    { label: 'Farmers',      value: data?.farmers?.length ?? 0, color: 'var(--text-primary)' },
    { label: 'Tiendas',      value: data?.totalStores ?? 0,      color: 'var(--text-primary)' },
    { label: 'Gestiones hoy',value: data?.totalGestiones ?? 0,   color: '#3b82f6' },
    { label: 'Efectivas hoy',value: data?.totalEfectivas ?? 0,   color: '#16a34a' },
    { label: 'No contacto',  value: data?.totalNoContacto ?? 0,  color: '#d97706' },
    { label: 'Onboarding',   value: data?.totalOnboarding ?? 0,  color: '#7c3aed' },
    { label: 'Churn',        value: data?.totalChurn ?? 0,       color: '#dc2626' },
    { label: 'Saludables',   value: data?.totalSaludables ?? 0,  color: '#16a34a' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '16px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color, margin: '4px 0 0', lineHeight: 1 }}>{value}</p>
        </div>
      ))}
    </div>
  )
}

function EquipoTab({ farmers, managements, sort, setSort }) {
  const mgtsByFarmer = managements.reduce((acc, m) => {
    const key = m.userId || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})
  const [expandedFarmer, setExpandedFarmer] = useState(null)

  const sorted = [...(farmers || [])].sort((a, b) => {
    if (sort === 'semaforo') {
      const order = { '🔴': 0, '🟡': 1, '🟢': 2 }
      return (order[semaforo(a).icon] ?? 3) - (order[semaforo(b).icon] ?? 3)
    }
    if (sort === 'gestiones') return b.gestionesHoy - a.gestionesHoy
    if (sort === 'efectivas')  return b.exitosasHoy - a.exitosasHoy
    if (sort === 'tiendas')    return b.totalStores - a.totalStores
    return 0
  })

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
      overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          Semáforo del equipo
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['semaforo','Semáforo'],['gestiones','Gestiones'],['efectivas','Efectivas'],['tiendas','Tiendas']].map(([key, label]) => (
            <button key={key} onClick={() => setSort(key)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: sort === key ? 'none' : '1px solid var(--border)',
              background: sort === key ? '#0f172a' : 'var(--bg-input)',
              color: sort === key ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{label}</button>
          ))}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            {['', 'Farmer', 'Código', 'País', 'Tiendas', 'Onb.', 'Churn', 'Gestiones', 'Efectivas', 'No cont.'].map((h, i) => (
              <th key={i} style={{ padding: '10px 14px', textAlign: i <= 1 ? 'left' : 'center',
                fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => {
            const s = semaforo(f)
            const isExp = expandedFarmer === f.id
            const farmerMgts = mgtsByFarmer[f.id] || []
            const pct = f.gestionesHoy > 0 ? Math.round((f.exitosasHoy / f.gestionesHoy) * 100) : 0
            return (
              <>
                <tr key={f.id}
                  onClick={() => setExpandedFarmer(isExp ? null : f.id)}
                  style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                    background: isExp ? 'var(--bg-secondary)' : 'transparent' }}
                  onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                  onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span title={s.label} style={{ fontSize: 15 }}>{s.icon}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{isExp ? '▼' : '▶'}</span>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{f.fullName}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{f.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ff441f' }}>{f.farmerCode || `#${f.id}`}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>{f.countryCode || '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{f.totalStores}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {f.onboardingCount > 0
                      ? <Chip label={f.onboardingCount} scheme={{ bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8' }} />
                      : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {f.churnCount > 0
                      ? <Chip label={f.churnCount} scheme={{ bg: 'rgba(239,68,68,0.12)', color: '#dc2626' }} />
                      : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700,
                    color: f.gestionesHoy > 0 ? '#3b82f6' : 'var(--text-muted)' }}>{f.gestionesHoy}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontWeight: 700, color: f.exitosasHoy >= 8 ? '#16a34a' : f.exitosasHoy > 0 ? '#d97706' : 'var(--text-muted)' }}>
                        {f.exitosasHoy}
                      </span>
                      {f.gestionesHoy > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center',
                    color: f.noContactoHoy > 0 ? '#d97706' : 'var(--text-muted)',
                    fontWeight: f.noContactoHoy > 0 ? 700 : 400 }}>{f.noContactoHoy || '—'}</td>
                </tr>

                {isExp && (
                  <tr key={`${f.id}-exp`}>
                    <td colSpan={10} style={{ padding: 0, background: 'var(--bg-secondary)',
                      borderBottom: '2px solid var(--border)' }}>
                      <div style={{ padding: '12px 24px 16px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
                          marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Gestiones de {f.fullName} hoy — {farmerMgts.length} total
                        </p>
                        {farmerMgts.length === 0
                          ? <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin gestiones registradas hoy</p>
                          : (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: 'var(--bg-input)' }}>
                                    {['Tienda', 'Brand ID', 'Tipo', 'Resultado', 'Comentario', 'Hora'].map(h => (
                                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10,
                                        fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {farmerMgts.map((m, i) => (
                                    <tr key={m.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.storeName || '—'}</td>
                                      <td style={{ padding: '8px 12px', color: '#ff441f', fontWeight: 700 }}>{m.brandId || '—'}</td>
                                      <td style={{ padding: '8px 12px' }}><Chip label={m.type} scheme={TIPO_COLOR[m.type]} /></td>
                                      <td style={{ padding: '8px 12px' }}><Chip label={m.result} scheme={RESULTADO_COLOR[m.result]} /></td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 200,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.comment || '—'}</td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
      {(farmers || []).length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          No hay farmers asignados a tu equipo
        </div>
      )}
    </div>
  )
}

function BasesTab({ bases, baseStoresData, baseStoresLoading, expandedBase, setExpandedBase }) {
  return (
    <div>
      {bases.length === 0
        ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 0' }}>No has creado bases aún</p>
        : bases.map(base => {
          const isExp = expandedBase === base.id
          const assignments = base.assignments || []
          const completadas = assignments.filter(a => a.status === 'COMPLETADO').length
          const enProceso   = assignments.filter(a => a.status === 'EN_PROCESO').length
          const sinLeer     = assignments.filter(a => a.status === 'SIN_LEER' || a.status === 'LEIDA').length
          const pct = assignments.length > 0 ? Math.round((completadas / assignments.length) * 100) : 0
          return (
            <div key={base.id} style={{ border: '1px solid var(--border)', borderRadius: 12,
              marginBottom: 12, overflow: 'hidden', background: 'var(--bg-card)' }}>
              <div onClick={() => setExpandedBase(isExp ? null : base.id)}
                style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', background: isExp ? 'var(--bg-secondary)' : 'var(--bg-card)' }}>
                <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{isExp ? '▼' : '▶'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{base.title}</span>
                    <Chip label={BASE_TYPE_LABEL[base.type] || base.type} scheme={{ bg: 'rgba(168,85,247,0.12)', color: '#5b21b6' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(base.createdAt).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-input)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`,
                        background: pct === 100 ? '#16a34a' : '#ff441f', borderRadius: 99, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {pct}% · {completadas}/{assignments.length}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {sinLeer > 0     && <Chip label={`${sinLeer} pendiente${sinLeer > 1 ? 's' : ''}`} scheme={STATUS_COLOR.SIN_LEER} />}
                  {enProceso > 0   && <Chip label={`${enProceso} en proceso`} scheme={STATUS_COLOR.EN_PROCESO} />}
                  {completadas > 0 && <Chip label={`${completadas} completada${completadas > 1 ? 's' : ''}`} scheme={STATUS_COLOR.COMPLETADO} />}
                </div>
              </div>

              {isExp && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {assignments.length > 0 && (
                    <div style={{ padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 8,
                      borderBottom: '1px solid var(--border)' }}>
                      {assignments.map((a, i) => {
                        const sc = STATUS_COLOR[a.status] || STATUS_COLOR.SIN_LEER
                        return (
                          <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px' }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-input)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                              {a.farmerName?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.farmerName || `Farmer #${a.farmerId}`}</p>
                              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{a.storeCount ?? 0} tiendas</p>
                            </div>
                            <Chip label={sc.label} scheme={sc} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tipificaciones en tiempo real
                      </p>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· actualiza cada 15s</span>
                      {baseStoresLoading[base.id] && (
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #ff441f',
                          borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
                        {(baseStoresData[base.id] || []).filter(s => s.gestionada).length} / {(baseStoresData[base.id] || []).length} gestionadas
                      </span>
                    </div>
                    {!baseStoresData[base.id]
                      ? <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Cargando tiendas...</p>
                      : baseStoresData[base.id].length === 0
                        ? <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sin tiendas en esta base</p>
                        : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-input)' }}>
                                  {['Estado', 'Tienda', 'Brand ID', 'Farmer', 'Tipo', 'Resultado', 'Comentario', 'Hora'].map(h => (
                                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10,
                                      fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {baseStoresData[base.id].map((s, si) => {
                                  const mgts = s.managements || []
                                  const firstMgt = mgts[0]
                                  return (
                                    <tr key={s.storeId || si} style={{ borderBottom: '1px solid var(--border)',
                                      background: s.gestionada ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <span title={s.gestionada ? 'Gestionada' : 'Sin gestión'} style={{ fontSize: 16 }}>
                                          {s.gestionada ? '✅' : '⬜'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)',
                                        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.storeName || '—'}</td>
                                      <td style={{ padding: '8px 12px', color: '#ff441f', fontWeight: 700 }}>{s.brandId || '—'}</td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{firstMgt?.farmerName || '—'}</td>
                                      <td style={{ padding: '8px 12px' }}>
                                        {firstMgt ? <Chip label={firstMgt.type} scheme={TIPO_COLOR[firstMgt.type]} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '8px 12px' }}>
                                        {firstMgt ? <Chip label={firstMgt.result} scheme={RESULTADO_COLOR[firstMgt.result]} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 200,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {firstMgt?.comment || '—'}
                                      </td>
                                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
  const [expandedBase, setExpandedBase] = useState(null)
  const [baseStoresData, setBaseStoresData]     = useState({})
  const [baseStoresLoading, setBaseStoresLoading] = useState({})

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

  useEffect(() => {
    const poll = async () => {
      try { const r = await getUnreadCount(); setUnread(r.data?.count ?? 0) } catch {}
    }
    poll()
    const interval = setInterval(() => { poll(); load() }, 30000)
    return () => clearInterval(interval)
  }, [load])

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
  const activeLabel = NAV.find(n => n.key === activeNav)?.label || ''

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Sidebar (se mantiene oscuro por diseño) ── */}
      <aside style={{ width: 224, background: '#0f172a', display: 'flex', flexDirection: 'column',
        padding: '24px 0', flexShrink: 0, boxShadow: '2px 0 12px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#ff441f', letterSpacing: '-0.5px' }}>Rappi Farmer</span>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Panel Líder</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setActiveNav(key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 20px',
              background: activeNav === key ? 'rgba(255,68,31,0.15)' : 'transparent',
              border: 'none',
              borderLeft: activeNav === key ? '3px solid #ff441f' : '3px solid transparent',
              color: activeNav === key ? '#ff441f' : '#94a3b8',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
            }}>
              <span>{icon}</span>{label}
              {key === 'bases' && bases.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ff441f', color: '#fff',
                  fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px' }}>{bases.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {user?.avatarUrl
              ? <img src={`${API_BASE}${user.avatarUrl}`} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ff441f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {user?.fullName?.[0]?.toUpperCase()}
                </div>
            }
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '1px 0 0' }}>Líder</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ fontSize: 11, color: '#64748b', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
            transition: 'color 0.15s' }}
            onMouseEnter={e => e.target.style.color = '#ef4444'}
            onMouseLeave={e => e.target.style.color = '#64748b'}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Panel principal ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ height: 56, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {activeLabel}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{now}</span>

            {/* Campana de notificaciones */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={openNotifs} style={{ position: 'relative', background: 'none',
                border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px' }}>
                🔔
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444',
                    color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99,
                    padding: '1px 5px', lineHeight: 1.4 }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div style={{ position: 'absolute', right: 0, top: '100%', width: 320,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Notificaciones</span>
                    {unread > 0 && (
                      <button onClick={handleMarkRead} style={{ fontSize: 11, color: '#3b82f6',
                        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Marcar todo leído
                      </button>
                    )}
                  </div>
                  {notifs.length === 0
                    ? <p style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin notificaciones</p>
                    : notifs.slice(0, 10).map((n, i) => (
                      <div key={n.id || i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                        background: n.read ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: n.read ? 400 : 600, color: 'var(--text-primary)' }}>
                          {n.title || n.message}
                        </p>
                        {n.body && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{n.body}</p>}
                        <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
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

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

          {/* ── Dashboard ── */}
          {activeNav === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {greeting}, {user?.nickname || user?.fullName?.split(' ')[0]} 👋
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, textTransform: 'capitalize' }}>{now}</p>
              </div>

              {loading ? <Spinner /> : (
                <>
                  <MetricGrid data={data} />

                  {/* Accesos rápidos */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {[
                      { key: 'equipo', icon: '👥', label: 'Ver equipo hoy', desc: `${data?.farmers?.length ?? 0} farmers activos`, color: '#3b82f6' },
                      { key: 'bases',  icon: '📦', label: 'Gestionar bases', desc: `${bases.length} bases creadas`, color: '#7c3aed' },
                    ].map(({ key, icon, label, desc, color }) => (
                      <button key={key} onClick={() => setActiveNav(key)} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 14, padding: '18px 20px', cursor: 'pointer',
                        textAlign: 'left', fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)',
                        transition: 'box-shadow 0.15s, border-color 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}>
                        <span style={{ fontSize: 28 }}>{icon}</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Equipo hoy ── */}
          {activeNav === 'equipo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Equipo hoy
              </h2>
              {loading ? <Spinner /> : (
                <EquipoTab
                  farmers={data?.farmers || []}
                  managements={managements}
                  sort={sort}
                  setSort={setSort}
                />
              )}
            </div>
          )}

          {/* ── Bases ── */}
          {activeNav === 'bases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Bases de datos
                </h2>
                {bases.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-input)',
                    padding: '4px 12px', borderRadius: 99, fontWeight: 600 }}>
                    {bases.length} bases
                  </span>
                )}
              </div>
              {loading ? <Spinner /> : (
                <BasesTab
                  bases={bases}
                  baseStoresData={baseStoresData}
                  baseStoresLoading={baseStoresLoading}
                  expandedBase={expandedBase}
                  setExpandedBase={setExpandedBase}
                />
              )}
            </div>
          )}

          {/* ── Mi perfil ── */}
          {activeNav === 'profile' && <ProfilePage />}

        </main>
      </div>
    </div>
  )
}
