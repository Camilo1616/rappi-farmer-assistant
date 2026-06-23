import { useState, useEffect, useRef, useCallback } from 'react'
import { getLiderDashboard, getBasesForLider, getNotifications, getUnreadCount,
         markAllNotifRead, getBaseStores, getTodayManagements, getStoresByBaseType,
         deleteBase } from '../services/dashboardService'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/authService'
import ProfilePage from './ProfilePage'
import styles from './DashboardPage.module.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '')

const TIPO_COLOR = {
  WHATSAPP:    { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' },
  LLAMADA:     { bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8' },
  SAC:         { bg: 'rgba(236,72,153,0.12)',  color: '#9d174d' },
  SEGUIMIENTO: { bg: 'rgba(234,179,8,0.12)',   color: '#854d0e' },
  ACTIVACION:  { bg: 'rgba(168,85,247,0.12)',  color: '#5b21b6' },
}
const RESULTADO_COLOR = {
  EFECTIVA:             { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' },
  NO_CONTACTO:          { bg: 'rgba(234,179,8,0.12)',   color: '#854d0e' },
  NO_RESPONDE:          { bg: 'rgba(100,116,139,0.12)', color: '#475569' },
  PROBLEMA_TECNICO:     { bg: 'rgba(239,68,68,0.12)',   color: '#991b1b' },
  REQUIERE_SEGUIMIENTO: { bg: 'rgba(168,85,247,0.12)',  color: '#5b21b6' },
}
const STATUS_COLOR = {
  SIN_LEER:   { bg: 'rgba(100,116,139,0.12)', color: '#475569', label: 'Sin leer' },
  LEIDA:      { bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8', label: 'Leída' },
  EN_PROCESO: { bg: 'rgba(234,179,8,0.12)',   color: '#854d0e', label: 'En proceso' },
  COMPLETADO: { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a', label: 'Completado' },
}
const BASE_TYPE_OPTS = [
  { value: 'ACTIVE',    label: 'Active 7d' },
  { value: 'ACTIVE_28', label: 'Active 8-28d' },
  { value: 'AVA_8_14', label: 'AVA 8-14' },
  { value: 'CHURN',    label: 'Churn' },
  { value: 'RETENCION',label: 'Retención' },
  { value: 'PRIORIZACION', label: 'Priorización' },
]
const BASE_TYPE_LABEL = {
  CHURN: 'Churn', ACTIVE_F7D: 'Activos 7d', ACTIVE: 'Active 7d', ACTIVE_28: 'Active 8-28d',
  RETENCION: 'Retención', AVA_8_14: 'AVA 8-14', PRIORIZACION: 'Priorización',
}

const IC = ({ d, d2 }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
)

const NAV_ITEMS_LIDER = [
  { key: 'dashboard', icon: <IC d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" />, color: '#FF441F', bg: 'rgba(255,68,31,0.13)',  label: 'Dashboard'  },
  { key: 'equipo',    icon: <IC d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" d2="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />, color: '#3B82F6', bg: 'rgba(59,130,246,0.13)', label: 'Equipo hoy' },
  { key: 'bases',     icon: <IC d="M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" d2="M14 2v6h6" />, color: '#8B5CF6', bg: 'rgba(139,92,246,0.13)', label: 'Bases'      },
  { key: 'profile',   icon: <IC d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" d2="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />, color: '#94A3B8', bg: 'rgba(148,163,184,0.13)', label: 'Mi perfil' },
]

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function semaforo(f) {
  if (f.gestionesHoy === 0) return { icon: '🔴', label: 'Sin iniciar', color: '#dc2626' }
  if (f.exitosasHoy >= 8)   return { icon: '🟢', label: 'En meta',     color: '#16a34a' }
  return                           { icon: '🟡', label: 'En progreso', color: '#d97706' }
}

function Chip({ label, scheme }) {
  const s = scheme || { bg: 'var(--bg-input)', color: 'var(--text-secondary)' }
  return (
    <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {label}
    </span>
  )
}

function Spinner({ size = 32 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', border: '3px solid #ff441f',
        borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

/* ─── Módulo Equipo hoy ─────────────────────────────────────────────── */
function EquipoTab({ farmers, managements, sort, setSort }) {
  const [expanded, setExpanded] = useState(null)

  // Agrupar gestiones por userId (campo expuesto en ManagementViewDto)
  const mgtsByFarmer = (managements || []).reduce((acc, m) => {
    const key = m.userId
    if (key == null) return acc
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const sorted = [...(farmers || [])].sort((a, b) => {
    if (sort === 'semaforo') {
      const ord = { '🔴': 0, '🟡': 1, '🟢': 2 }
      return (ord[semaforo(a).icon] ?? 3) - (ord[semaforo(b).icon] ?? 3)
    }
    if (sort === 'gestiones') return b.gestionesHoy - a.gestionesHoy
    if (sort === 'efectivas')  return b.exitosasHoy - a.exitosasHoy
    if (sort === 'tiendas')    return b.totalStores - a.totalStores
    return 0
  })

  const toggle = (farmerId) => setExpanded(prev => prev === farmerId ? null : farmerId)

  if (sorted.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        No hay farmers asignados a tu equipo
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
      overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>

      {/* Header con filtros */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Semáforo del equipo
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· clic para ver gestiones</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['semaforo','Semáforo'],['gestiones','Gestiones'],['efectivas','Efectivas'],['tiendas','Tiendas']].map(([key, label]) => (
            <button key={key} onClick={() => setSort(key)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: sort === key ? 'none' : '1px solid var(--border)',
              background: sort === key ? '#ff441f' : 'var(--bg-input)',
              color: sort === key ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            {['', 'Farmer', 'Cód.', 'País', 'Tiendas', 'Onb.', 'Churn', 'Gestiones hoy', 'Efectivas', 'No cont.'].map((h, i) => (
              <th key={i} style={{ padding: '10px 14px', textAlign: i <= 1 ? 'left' : 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => {
            const s  = semaforo(f)
            const isExp = expanded === f.id
            const farmerMgts = mgtsByFarmer[f.id] || []

            return (
              <>
                <tr key={f.id}
                  onClick={() => toggle(f.id)}
                  style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                    background: isExp ? 'var(--bg-secondary)' : 'transparent',
                    transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                  onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = 'transparent' }}>

                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span title={s.label} style={{ fontSize: 16 }}>{s.icon}</span>
                  </td>

                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{isExp ? '▼' : '▶'}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: 13 }}>{f.fullName}</p>
                          {(() => {
                            const st = f.activityStatus
                            const cfg = st === 'ACTIVO'
                              ? { bg: 'rgba(34,197,94,0.15)', color: '#16a34a', dot: '#22c55e', label: 'Activo' }
                              : st === 'INACTIVO'
                              ? { bg: 'rgba(234,179,8,0.15)', color: '#92400e', dot: '#eab308', label: 'Inactivo' }
                              : { bg: 'rgba(107,114,128,0.15)', color: '#6b7280', dot: '#9ca3af', label: 'Desactivado' }
                            return (
                              <span title={f.lastActivityTime ? `Última actividad: ${f.lastActivityTime}` : 'Sin actividad'} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: cfg.bg, color: cfg.color, borderRadius: 20,
                                padding: '2px 7px', fontSize: 10, fontWeight: 700,
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot,
                                  boxShadow: st === 'ACTIVO' ? `0 0 5px ${cfg.dot}` : 'none',
                                  display: 'inline-block' }} />
                                {cfg.label}
                              </span>
                            )
                          })()}
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>
                          {f.email}{f.lastActivityTime ? ` · ${f.lastActivityTime}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ff441f' }}>{f.farmerCode || `#${f.id}`}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>{f.countryCode || '—'}</td>
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

                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: f.gestionesHoy > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                      {f.gestionesHoy}
                    </span>
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 15,
                        color: f.exitosasHoy >= 8 ? '#16a34a' : f.exitosasHoy > 0 ? '#d97706' : 'var(--text-muted)' }}>
                        {f.exitosasHoy}
                      </span>
                      {f.gestionesHoy > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                          de {f.gestionesHoy}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'center',
                    fontWeight: f.noContactoHoy > 0 ? 700 : 400,
                    color: f.noContactoHoy > 0 ? '#d97706' : 'var(--text-muted)' }}>
                    {f.noContactoHoy || '—'}
                  </td>
                </tr>

                {/* Fila expandida: gestiones del farmer */}
                {isExp && (
                  <tr key={`${f.id}-detail`}>
                    <td colSpan={10} style={{ padding: 0, background: 'var(--bg-secondary)',
                      borderBottom: '2px solid var(--border)' }}>
                      <div style={{ padding: '14px 28px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                            textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                            Gestiones de {f.fullName} hoy
                          </p>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-input)',
                            padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                            {farmerMgts.length} total
                          </span>
                        </div>

                        {farmerMgts.length === 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0',
                            color: 'var(--text-muted)', fontSize: 13 }}>
                            <span style={{ fontSize: 18 }}>⬜</span>
                            Sin gestiones registradas hoy
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-input)' }}>
                                  {['Tienda', 'Brand ID', 'Tipo', 'Resultado', 'Comentario', 'Hora'].map(h => (
                                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10,
                                      fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                                      whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {farmerMgts.map((m, i) => (
                                  <tr key={m.id || i} style={{ borderBottom: '1px solid var(--border)',
                                    background: m.resultType === 'EFECTIVA' ? 'rgba(34,197,94,0.04)' : 'transparent' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 160,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {m.storeName || '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px', color: '#ff441f', fontWeight: 700, fontSize: 11 }}>
                                      {m.storeCode || '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <Chip label={m.managementType} scheme={TIPO_COLOR[m.managementType]} />
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <Chip label={m.resultType} scheme={RESULTADO_COLOR[m.resultType]} />
                                    </td>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxWidth: 220,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {m.comments || '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
                                      {m.managementTime || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Módulo Bases ──────────────────────────────────────────────────── */
function BasesTab({ bases, farmers, baseStoresData, baseStoresLoading, expandedBase, setExpandedBase, onBaseCreated, onBaseDeleted }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Botón nueva base */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#ff441f', color: '#fff', border: 'none',
          borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(255,68,31,0.3)',
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          + Nueva base
        </button>
      </div>

      {/* Modal creación */}
      {showForm && (
        <CrearBaseModal
          farmers={farmers}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); onBaseCreated() }}
        />
      )}

      {/* Lista de bases */}
      {bases.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16,
          padding: '48px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: 36 }}>📦</span>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 12 }}>No has creado bases aún</p>
          <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Crea tu primera base para asignar tiendas a los farmers</p>
        </div>
      ) : bases.map(base => (
        <BaseCard key={base.id} base={base}
          baseStoresData={baseStoresData} baseStoresLoading={baseStoresLoading}
          expanded={expandedBase === base.id}
          onToggle={() => setExpandedBase(expandedBase === base.id ? null : base.id)}
          onDeleted={onBaseDeleted}
        />
      ))}
    </div>
  )
}

function BaseCard({ base, baseStoresData, baseStoresLoading, expanded, onToggle, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm]   = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm) { setConfirm(true); return }
    setDeleting(true)
    try {
      await deleteBase(base.id)
      onDeleted?.()
    } catch {
      setDeleting(false)
      setConfirm(false)
    }
  }

  const cancelConfirm = (e) => { e.stopPropagation(); setConfirm(false) }
  const totalFarmers = base.farmersCount ?? 0
  const completadas  = base.completados  ?? 0
  const enProceso    = base.enProceso    ?? 0
  const sinLeer      = base.pendientes   ?? 0
  const pct = totalFarmers > 0 ? Math.round((completadas / totalFarmers) * 100) : 0

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
      background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>

      {/* Header */}
      <div onClick={onToggle} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center',
        gap: 12, cursor: 'pointer', background: expanded ? 'var(--bg-secondary)' : 'var(--bg-card)',
        transition: 'background 0.15s' }}>
        <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{base.title}</span>
            <Chip label={BASE_TYPE_LABEL[base.type] || base.type} scheme={{ bg: 'rgba(168,85,247,0.12)', color: '#5b21b6' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(base.createdAt).toLocaleDateString('es-CO')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 5, background: 'var(--bg-input)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`,
                background: pct === 100 ? '#16a34a' : '#ff441f', borderRadius: 99, transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {pct}% · {completadas}/{totalFarmers}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          {sinLeer > 0     && <Chip label={`${sinLeer} pendiente${sinLeer > 1 ? 's' : ''}`} scheme={STATUS_COLOR.SIN_LEER} />}
          {enProceso > 0   && <Chip label={`${enProceso} en proceso`} scheme={STATUS_COLOR.EN_PROCESO} />}
          {completadas > 0 && <Chip label={`${completadas} completado${completadas > 1 ? 's' : ''}`} scheme={STATUS_COLOR.COMPLETADO} />}
          {/* Botón eliminar */}
          {confirm ? (
            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              <button onClick={handleDelete} disabled={deleting} style={{
                padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', boxShadow: '0 2px 6px rgba(220,38,38,0.4)',
              }}>{deleting ? 'Eliminando...' : '¿Eliminar?'}</button>
              <button onClick={cancelConfirm} style={{
                padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={handleDelete} title="Eliminar base" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              background: 'rgba(220,38,38,0.1)', color: '#dc2626',
              border: '1.5px solid rgba(220,38,38,0.35)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.1)'; e.currentTarget.style.color = '#dc2626' }}>
              🗑 Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {/* Resumen de la base */}
          <div style={{ padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 8,
            borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
              👥 <strong>{totalFarmers}</strong> farmer{totalFarmers !== 1 ? 's' : ''}
            </div>
            {sinLeer > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)',
                borderRadius: 10, padding: '6px 12px', fontSize: 12, color: '#475569', fontWeight: 600 }}>
                ⏳ {sinLeer} pendiente{sinLeer !== 1 ? 's' : ''}
              </div>
            )}
            {enProceso > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
                borderRadius: 10, padding: '6px 12px', fontSize: 12, color: '#854d0e', fontWeight: 600 }}>
                🔄 {enProceso} en proceso
              </div>
            )}
            {completadas > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 10, padding: '6px 12px', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                ✅ {completadas} completado{completadas !== 1 ? 's' : ''}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
              borderRadius: 10, padding: '6px 12px', fontSize: 12, color: '#5b21b6', fontWeight: 600 }}>
              🏪 {base.tiendas ?? 0} tiendas · {base.gestionadas ?? 0} gestionadas
            </div>
          </div>

          {/* Tiendas en tiempo real */}
          <div style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tipificaciones en tiempo real
              </p>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· actualiza cada 15s</span>
              {baseStoresLoading[base.id] && (
                <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid #ff441f',
                  borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
                {(baseStoresData[base.id] || []).filter(s => s.gestionada).length}
                {' / '}
                {(baseStoresData[base.id] || []).length} gestionadas
              </span>
            </div>

            {!baseStoresData[base.id]
              ? <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Cargando tiendas...</p>
              : baseStoresData[base.id].length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sin tiendas en esta base</p>
                : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-input)' }}>
                          {['Estado', 'Tienda', 'Brand ID', 'Farmer', 'Tipo', 'Resultado', 'Comentario', 'Hora'].map(h => (
                            <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10,
                              fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                              whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {baseStoresData[base.id].map((s, si) => {
                          const firstMgt = (s.managements || [])[0]
                          return (
                            <tr key={s.storeId || si} style={{ borderBottom: '1px solid var(--border)',
                              background: s.gestionada ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 16 }}>
                                {s.gestionada ? '✅' : '⬜'}
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)',
                                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.storeName || '—'}
                              </td>
                              <td style={{ padding: '8px 12px', color: '#ff441f', fontWeight: 700, fontSize: 11 }}>{s.brandId || '—'}</td>
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
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>
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
}

/* ─── Modal Crear Base ──────────────────────────────────────────────── */
function CrearBaseModal({ farmers, onClose, onCreated }) {
  const [title, setTitle]           = useState('')
  const [type, setType]             = useState('ACTIVE')
  const [activeDays, setActiveDays] = useState(7)   // solo aplica para ACTIVE
  const [message, setMessage]       = useState('')
  const [selectedFarmers, setSel]        = useState([])
  const [preview, setPreview]            = useState(null)
  const [selectedStoreIds, setSelStores] = useState([])
  const [storeSearch, setStoreSearch]    = useState('')
  const [loadingPrev, setLoadPrev]       = useState(false)
  const [saving, setSaving]              = useState(false)
  const [error, setError]           = useState(null)

  const templates = {
    ACTIVE:       'Team! Les dejo la base ACTIVE del día.\n\nAliados que ingresaron recientemente — debemos lograr login y activación con órdenes.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    CHURN:        'Team! Les dejo la base CHURN del día.\n\nAliados que esta semana nos entran en churn — recuerden que lo ideal es buscar reconexión de por lo menos 5 minutos dentro de horario.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    RETENCION:    'Team! Les dejo la base PRIORIDAD RETENCIÓN del día.\n\nLa prioridad está en la columna 2 — empiecen por los \'Prioridad 1\'. Hay aliados con AVA MTD desde 6% hacia arriba. Recuerden: para que cuente en retención debe tener AVA del 10%.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    AVA_8_14:     'Team! Les dejo la base AVA 8-14 del día.\n\nAliados que YA LES CUENTAN PARA AVA. Miren la columna U — filtren por URGENTE!!\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    PRIORIZACION: 'Team! Les dejo la base de PRIORIZACIÓN del día.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
  }

  const handleTypeChange = (val) => {
    setType(val)
    setPreview(null)
    if (!message || Object.values(templates).some(t => message === t)) {
      setMessage(templates[val] || '')
    }
  }

  useEffect(() => { setMessage(templates['ACTIVE']) }, [])

  const toggleFarmer = (id) => {
    setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setPreview(null)
    setSelStores([])
    setStoreSearch('')
  }

  const loadPreview = async () => {
    if (selectedFarmers.length === 0) return
    setLoadPrev(true); setPreview(null)
    try {
      const params = type === 'ACTIVE' ? { activeDays } : {}
      const r = await getStoresByBaseType(type, selectedFarmers, params)
      const allStores = r.data || []
      const byFarmer = {}
      for (const f of selectedFarmers) {
        const farmer = farmers.find(x => x.id === f)
        byFarmer[f] = { name: farmer?.fullName || `#${f}`, stores: [] }
      }
      for (const s of allStores) {
        // farmerId puede llegar como number o string según el JSON
        const fId = selectedFarmers.find(id => id === s.farmerId || id === Number(s.farmerId))
        if (fId != null) byFarmer[fId].stores.push(s)
        else {
          // si no tiene farmerId asociado, asignarlo al primer farmer seleccionado
          const fallback = selectedFarmers[0]
          if (fallback != null) byFarmer[fallback].stores.push(s)
        }
      }
      setPreview(byFarmer)
      setSelStores(allStores.map(s => s.id))
      setStoreSearch('')
    } catch { setError('Error al cargar preview') }
    finally { setLoadPrev(false) }
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setError('El título es obligatorio'); return }
    if (selectedFarmers.length === 0) { setError('Selecciona al menos un farmer'); return }
    setSaving(true); setError(null)
    try {
      const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const farmerNames = selectedFarmers.map(id => farmers.find(f => f.id === id)?.fullName || `#${id}`).join(', ')
      const finalMsg = message.replace('{farmers}', farmerNames).replace('{fecha}', fecha)

      const body = { title: title.trim(), type, message: finalMsg, farmerIds: selectedFarmers }
      if (type === 'ACTIVE') body.activeDays = activeDays
      // solo enviar storeIds si el líder cargó el preview y ajustó la selección
      if (preview && selectedStoreIds.length > 0) body.storeIds = selectedStoreIds

      await api.post('/bases', body)
      onCreated()
    } catch (e) {
      setError(e.response?.data?.message || 'Error al crear la base')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18,
        width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            📦 Nueva base
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>✕</button>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo de base</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {BASE_TYPE_OPTS.map(opt => (
                <button key={opt.value} onClick={() => handleTypeChange(opt.value)} style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  border: type === opt.value ? 'none' : '1px solid var(--border)',
                  background: type === opt.value ? '#ff441f' : 'var(--bg-input)',
                  color: type === opt.value ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sub-selector de días — solo para ACTIVE */}
            {type === 'ACTIVE' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Tiendas sin conectar a Rappi Aliados en:
                </span>
                {[7, 28].map(d => (
                  <button key={d} onClick={() => { setActiveDays(d); setPreview(null) }} style={{
                    padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                    border: activeDays === d ? 'none' : '1px solid var(--border)',
                    background: activeDays === d ? '#0f172a' : 'var(--bg-input)',
                    color: activeDays === d ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {d} días
                  </button>
                ))}
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  (basado en último login)
                </span>
              </div>
            )}
          </div>

          {/* Título */}
          <div>
            <label style={labelStyle}>Título de la base</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={`BASE ${BASE_TYPE_LABEL[type] || type} — ${new Date().toLocaleDateString('es-CO')}`}
              style={inputStyle} maxLength={120} />
          </div>

          {/* Farmers */}
          <div>
            <label style={labelStyle}>Farmers destinatarios</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto',
              border: '1px solid var(--border)', borderRadius: 10, padding: '8px 4px', background: 'var(--bg-input)' }}>
              {farmers.length === 0
                ? <p style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No hay farmers disponibles</p>
                : farmers.map(f => (
                  <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 14px', cursor: 'pointer', borderRadius: 7,
                    background: selectedFarmers.includes(f.id) ? 'rgba(255,68,31,0.1)' : 'transparent',
                    transition: 'background 0.12s' }}>
                    <input type="checkbox" checked={selectedFarmers.includes(f.id)}
                      onChange={() => toggleFarmer(f.id)} style={{ accentColor: '#ff441f', width: 15, height: 15 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{f.fullName}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{f.farmerCode} · {f.countryCode || '—'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.totalStores} tiendas</span>
                  </label>
                ))
              }
            </div>
            {selectedFarmers.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedFarmers.length} seleccionados</span>
                <button onClick={loadPreview} disabled={loadingPrev} style={{
                  fontSize: 13, fontWeight: 700, color: '#fff', background: '#3b82f6',
                  border: 'none', borderRadius: 8, padding: '8px 18px',
                  cursor: loadingPrev ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: loadingPrev ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {loadingPrev ? '⏳ Cargando...' : '👁 Ver tiendas que entran'}
                </button>
              </div>
            )}
          </div>

          {/* Preview de tiendas con checkboxes y buscador */}
          {preview && (() => {
            const allPreviewStores = Object.values(preview).flatMap(({ stores }) => stores)
            const q = storeSearch.toLowerCase()
            const filtered = q
              ? allPreviewStores.filter(s =>
                  s.storeName?.toLowerCase().includes(q) || s.storeCode?.toLowerCase().includes(q))
              : allPreviewStores
            const totalSelected = selectedStoreIds.length
            const toggleStore = (id) => setSelStores(prev =>
              prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
            const toggleAll = () => setSelStores(
              selectedStoreIds.length === allPreviewStores.length ? [] : allPreviewStores.map(s => s.id))
            return (
              <div style={{ border: '2px solid rgba(59,130,246,0.35)', borderRadius: 12, overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                {/* Header */}
                <div style={{ padding: '14px 18px', background: 'rgba(59,130,246,0.08)',
                  borderBottom: '1px solid rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Tiendas en la base
                    </span>
                    <span style={{ fontSize: 12, color: '#3b82f6', marginLeft: 10, fontWeight: 600 }}>
                      {totalSelected} / {allPreviewStores.length} seleccionadas
                    </span>
                  </div>
                  <button onClick={toggleAll} style={{ fontSize: 12, fontWeight: 700,
                    color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.4)',
                    borderRadius: 7, padding: '5px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {selectedStoreIds.length === allPreviewStores.length ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                </div>
                {/* Buscador */}
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-secondary)' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
                    <input
                      value={storeSearch}
                      onChange={e => setStoreSearch(e.target.value)}
                      placeholder="Buscar tienda por nombre o código..."
                      style={{ ...inputStyle, padding: '9px 12px 9px 34px', fontSize: 13, margin: 0,
                        width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  {q && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{storeSearch}"
                    </p>
                  )}
                </div>
                {/* Lista por farmer */}
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  {Object.entries(preview).map(([fId, { name, stores }]) => {
                    const visibleStores = q
                      ? stores.filter(s => s.storeName?.toLowerCase().includes(q) || s.storeCode?.toLowerCase().includes(q))
                      : stores
                    if (visibleStores.length === 0) return null
                    return (
                      <div key={fId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <div style={{ padding: '8px 18px', background: 'rgba(0,0,0,0.04)',
                          display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)',
                            background: 'var(--bg-input)', borderRadius: 20, padding: '1px 8px' }}>
                            {visibleStores.filter(s => selectedStoreIds.includes(s.id)).length}/{visibleStores.length}
                          </span>
                        </div>
                        {visibleStores.map(s => (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                            padding: '8px 18px 8px 30px', cursor: 'pointer',
                            background: selectedStoreIds.includes(s.id) ? 'rgba(255,68,31,0.07)' : 'transparent',
                            transition: 'background 0.1s', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <input type="checkbox" checked={selectedStoreIds.includes(s.id)}
                              onChange={() => toggleStore(s.id)}
                              style={{ accentColor: '#ff441f', width: 15, height: 15, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{s.storeName}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                              background: 'var(--bg-input)', padding: '2px 7px', borderRadius: 5 }}>{s.storeCode}</span>
                          </label>
                        ))}
                      </div>
                    )
                  })}
                  {filtered.length === 0 && (
                    <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      Sin resultados para "{storeSearch}"
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Mensaje */}
          <div>
            <label style={labelStyle}>Mensaje para los farmers</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              rows={8} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Variables: <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 4 }}>{'{farmers}'}</code>{' '}
              <code style={{ background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 4 }}>{'{fecha}'}</code>{' '}
              se reemplazan automáticamente al enviar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving || !title.trim() || selectedFarmers.length === 0} style={{
            padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700,
            background: saving || !title.trim() || selectedFarmers.length === 0 ? 'var(--bg-input)' : '#ff441f',
            color: saving || !title.trim() || selectedFarmers.length === 0 ? 'var(--text-muted)' : '#fff',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            boxShadow: saving ? 'none' : '0 2px 8px rgba(255,68,31,0.3)', transition: 'background 0.15s',
          }}>
            {saving ? 'Enviando...' : `📤 Crear y enviar (${selectedFarmers.length} farmers)`}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }
const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

/* ─── Pantalla de métricas del líder ───────────────────────────────── */
function MetricsScreen({ data, bases, onNav }) {
  const farmers      = data?.farmers      ?? []
  const totalG       = data?.totalGestiones  ?? 0
  const totalEf      = data?.totalEfectivas  ?? 0
  const totalNC      = data?.totalNoContacto ?? 0
  const totalStores  = data?.totalStores     ?? 0
  const totalOnb     = data?.totalOnboarding ?? 0
  const totalChurn   = data?.totalChurn      ?? 0
  const totalSal     = data?.totalSaludables ?? 0
  const bPend        = data?.basesPendientes ?? 0
  const bProc        = data?.basesEnProceso  ?? 0
  const bComp        = data?.basesCompletadas ?? 0

  const convRate     = totalG > 0 ? Math.round((totalEf / totalG) * 100) : 0
  const enMeta       = farmers.filter(f => f.exitosasHoy >= 8).length
  const sinIniciar   = farmers.filter(f => f.gestionesHoy === 0).length
  const enProgreso   = farmers.length - enMeta - sinIniciar

  // Ordenar farmers: primero los que más necesitan atención (sin iniciar), luego en progreso, luego en meta
  const farmersOrdenados = [...farmers].sort((a, b) => {
    const ord = (f) => f.gestionesHoy === 0 ? 0 : f.exitosasHoy >= 8 ? 2 : 1
    return ord(a) - ord(b)
  })

  const card = (content, style = {}) => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: 'var(--shadow-sm)', ...style }}>
      {content}
    </div>
  )

  const kpi = (label, value, sub, color, icon) => (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '20px 22px', boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 36, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>{sub}</p>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Sección 1: KPIs de gestión de hoy ── */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: '0.08em', margin: '0 0 10px' }}>Gestión del equipo · hoy</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {kpi('Gestiones totales', totalG, `${farmers.length} farmers`, '#3b82f6', '📋')}
          {kpi('Efectivas', totalEf, `${convRate}% conversión`, '#16a34a', '✅')}
          {kpi('No contacto', totalNC, totalG > 0 ? `${Math.round((totalNC/totalG)*100)}% del total` : '—', '#d97706', '📵')}
          {kpi('Farmers en meta', enMeta, `de ${farmers.length} · meta ≥ 8 ef.`, enMeta === farmers.length ? '#16a34a' : '#d97706', '🎯')}
        </div>
      </div>

      {/* ── Sección 2: Cartera + Bases ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start' }}>

        {/* Cartera */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.08em', margin: '0 0 10px' }}>Cartera del equipo</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'Total tiendas', value: totalStores, color: 'var(--text-primary)', icon: '🏪' },
              { label: 'Onboarding',    value: totalOnb,    color: '#7c3aed',             icon: '🚀' },
              { label: 'Churn',         value: totalChurn,  color: '#dc2626',             icon: '⚠️' },
              { label: 'Saludables',    value: totalSal,    color: '#16a34a',             icon: '💚' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bases — columna derecha */}
        <div style={{ minWidth: 180 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.08em', margin: '0 0 10px' }}>Bases</p>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {[
              { label: 'Pendientes',  value: bPend, color: '#6b7280', dot: '#9ca3af' },
              { label: 'En proceso',  value: bProc, color: '#d97706', dot: '#f59e0b' },
              { label: 'Completadas', value: bComp, color: '#16a34a', dot: '#22c55e' },
            ].map(({ label, value, color, dot }, i, arr) => (
              <div key={label} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 10,
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                </div>
                <span style={{ fontSize: 22, fontWeight: 800, color }}>{value}</span>
              </div>
            ))}
            <button onClick={() => onNav('bases')} style={{ width: '100%', padding: '10px 16px',
              background: 'var(--bg-secondary)', border: 'none', borderTop: '1px solid var(--border)',
              color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'center', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}>
              Ver bases →
            </button>
          </div>
        </div>
      </div>

      {/* ── Sección 3: Semáforo del equipo ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.08em', margin: 0 }}>Semáforo del equipo</p>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>🔴 Sin iniciar: <strong style={{ color: '#dc2626' }}>{sinIniciar}</strong></span>
            <span>🟡 En progreso: <strong style={{ color: '#d97706' }}>{enProgreso}</strong></span>
            <span>🟢 En meta: <strong style={{ color: '#16a34a' }}>{enMeta}</strong></span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>

          {farmers.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No hay farmers asignados al equipo
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {['Est.', 'Farmer', 'Tiendas', 'Gestiones hoy', 'Efectivas', 'No cont.', 'Progreso'].map((h, i) => (
                      <th key={i} style={{ padding: '9px 14px', textAlign: i <= 1 ? 'left' : 'center',
                        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {farmersOrdenados.map((f, i) => {
                    const s = semaforo(f)
                    const pct = Math.min(100, Math.round((f.exitosasHoy / 8) * 100))
                    return (
                      <tr key={f.id} style={{ borderBottom: i < farmersOrdenados.length - 1 ? '1px solid var(--border)' : 'none',
                        background: f.gestionesHoy === 0 ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span title={s.label} style={{ fontSize: 15 }}>{s.icon}</span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{f.fullName}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                            {f.farmerCode || `#${f.id}`}{f.countryCode ? ` · ${f.countryCode}` : ''}
                          </p>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {f.totalStores}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center',
                          fontWeight: 700, fontSize: 15, color: f.gestionesHoy > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                          {f.gestionesHoy}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center',
                          fontWeight: 700, fontSize: 15,
                          color: f.exitosasHoy >= 8 ? '#16a34a' : f.exitosasHoy > 0 ? '#d97706' : 'var(--text-muted)' }}>
                          {f.exitosasHoy}
                          {f.exitosasHoy >= 8 && <span style={{ fontSize: 10, marginLeft: 4 }}>✓</span>}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center',
                          color: f.noContactoHoy > 0 ? '#d97706' : 'var(--text-muted)',
                          fontWeight: f.noContactoHoy > 0 ? 700 : 400 }}>
                          {f.noContactoHoy || '—'}
                        </td>
                        <td style={{ padding: '11px 20px 11px 14px', minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)',
                              borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99,
                                background: pct >= 100 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ef4444',
                                transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                              whiteSpace: 'nowrap', minWidth: 30 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {farmers.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)',
              background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => onNav('equipo')} style={{ padding: '7px 18px', borderRadius: 8,
                background: '#3b82f6', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit' }}>
                Ver detalle completo →
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

/* ─── Página principal ──────────────────────────────────────────────── */
export default function LiderDashboardPage() {
  const { user } = useAuth()
  const [activeNav, setActiveNav]             = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileOpen, setProfileOpen]         = useState(false)
  const [data, setData]                       = useState(null)
  const [bases, setBases]                     = useState([])
  const [managements, setMgts]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [sort, setSort]                       = useState('semaforo')
  const [expandedBase, setExpandedBase]       = useState(null)
  const [baseStoresData, setBaseStoresData]   = useState({})
  const [baseStoresLoading, setBSLoading]     = useState({})
  const [notifs, setNotifs]                   = useState([])
  const [unread, setUnread]                   = useState(0)
  const [notifOpen, setNotifOpen]             = useState(false)
  const notifRef   = useRef()
  const profileRef = useRef()

  const loadBases = useCallback(async () => {
    const r = await getBasesForLider().catch(() => null)
    if (r) setBases(r.data || [])
  }, [])

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
    setBSLoading(p => ({ ...p, [baseId]: true }))
    try {
      const r = await getBaseStores(baseId)
      setBaseStoresData(p => ({ ...p, [baseId]: r.data || [] }))
    } catch {
      setBaseStoresData(p => ({ ...p, [baseId]: [] }))
    } finally { setBSLoading(p => ({ ...p, [baseId]: false })) }
  }, [])

  const expandedBaseRef = useRef(null)
  useEffect(() => {
    expandedBaseRef.current = expandedBase
    if (expandedBase != null) loadBaseStores(expandedBase)
  }, [expandedBase, loadBaseStores])

  useEffect(() => {
    const iv = setInterval(() => {
      if (expandedBaseRef.current != null) loadBaseStores(expandedBaseRef.current)
    }, 15000)
    return () => clearInterval(iv)
  }, [loadBaseStores])

  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
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
    setUnread(0); setNotifs(p => p.map(n => ({ ...n, read: true })))
  }
  const handleLogout = () => { logout(); window.location.href = '/login' }

  const now = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className={styles.layout}>

      {/* ── Sidebar (mismo diseño que farmer) ── */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarDot} />
          {!sidebarCollapsed && <span className={styles.sidebarBrandName}>Rappi Farmer</span>}
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {NAV_ITEMS_LIDER.map(item => (
            <button
              key={item.key}
              className={`${styles.navItem} ${activeNav === item.key ? styles.active : ''}`}
              onClick={() => setActiveNav(item.key)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className={styles.navIconWrap} style={{ background: item.bg, borderColor: item.color + '33', color: item.color }}>
                {item.icon}
              </span>
              {!sidebarCollapsed && <span className={styles.navLabel}>{item.label}</span>}
              {!sidebarCollapsed && item.key === 'bases' && bases.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ff441f', color: '#fff',
                  fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px', lineHeight: 1.4 }}>
                  {bases.length}
                </span>
              )}
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
              <button className={styles.profileMenuItem} onClick={() => { setActiveNav('profile'); setProfileOpen(false) }}>
                <span>👤</span> Mi perfil
              </button>
              <div className={styles.profileMenuDivider} />
              <button className={`${styles.profileMenuItem} ${styles.profileMenuItemDanger}`} onClick={() => { setProfileOpen(false); handleLogout() }}>
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
            {!sidebarCollapsed && (
              <div className={styles.userInfo}>
                <div className={styles.userFullName}>{user?.fullName}</div>
                <div className={styles.userRole}>Líder</div>
              </div>
            )}
            {!sidebarCollapsed && <span className={styles.chevron}>{profileOpen ? '▲' : '▼'}</span>}
          </div>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <div className={styles.content}>

        {/* Topbar */}
        <div className={styles.topbar}>
          <h1 className={styles.pageTitle}>{NAV_ITEMS_LIDER.find(n => n.key === activeNav)?.label}</h1>
          <div className={styles.topbarRight}>
            <span className={styles.date} style={{ textTransform: 'capitalize' }}>{now}</span>
            <div className={styles.notifWrap} ref={notifRef}>
              <button className={styles.notifBtn} onClick={openNotifs}>
                🔔
                {unread > 0 && <span className={styles.notifBadge}>{unread > 9 ? '9+' : unread}</span>}
              </button>
              {notifOpen && (
                <div className={styles.notifDropdown}>
                  <div className={styles.notifHeader}>
                    <span>Notificaciones</span>
                    {unread > 0 && (
                      <button className={styles.markReadBtn} onClick={handleMarkRead}>Marcar todo leído</button>
                    )}
                  </div>
                  {notifs.length === 0
                    ? <p className={styles.notifEmpty}>Sin notificaciones</p>
                    : notifs.slice(0, 10).map((n, i) => (
                      <div key={n.id || i} className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}>
                        <span className={styles.notifMsg}>{n.title || n.message}</span>
                        {n.body && <span className={styles.notifBody}>{n.body}</span>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        <main className={styles.main}>

          {/* Dashboard — pantalla principal de métricas */}
          {activeNav === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {greeting}, {user?.nickname || user?.fullName?.split(' ')[0]} 👋
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, textTransform: 'capitalize' }}>{now}</p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px' }}>
                  🔄 Actualiza cada 30s
                </span>
              </div>
              {loading ? <Spinner /> : (
                <MetricsScreen data={data} bases={bases} onNav={setActiveNav} />
              )}
            </div>
          )}

          {/* Equipo hoy */}
          {activeNav === 'equipo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Equipo hoy</h2>
              {loading ? <Spinner /> : (
                <EquipoTab farmers={data?.farmers || []} managements={managements} sort={sort} setSort={setSort} />
              )}
            </div>
          )}

          {/* Bases */}
          {activeNav === 'bases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Bases de datos</h2>
              {loading ? <Spinner /> : (
                <BasesTab
                  bases={bases} farmers={data?.farmers || []}
                  baseStoresData={baseStoresData} baseStoresLoading={baseStoresLoading}
                  expandedBase={expandedBase} setExpandedBase={setExpandedBase}
                  onBaseCreated={() => { load(); loadBases() }}
                  onBaseDeleted={() => { load(); loadBases() }}
                />
              )}
            </div>
          )}

          {/* Mi perfil */}
          {activeNav === 'profile' && <ProfilePage />}

        </main>
      </div>
    </div>
  )
}
