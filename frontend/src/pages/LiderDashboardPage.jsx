import { useState, useEffect, useRef, useCallback } from 'react'
import { getLiderDashboard, getBasesForLider, getNotifications, getUnreadCount,
         markAllNotifRead, getBaseStores, getTodayManagements, getStoresByBaseType } from '../services/dashboardService'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/authService'
import ProfilePage from './ProfilePage'

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
  { value: 'ACTIVE_F7D', label: 'Activos 7 días' },
  { value: 'AVA_8_14',   label: 'AVA 8-14' },
  { value: 'CHURN',      label: 'Churn' },
  { value: 'RETENCION',  label: 'Retención' },
  { value: 'PRIORIZACION', label: 'Priorización general' },
]
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
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: 13 }}>{f.fullName}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>{f.email}</p>
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
function BasesTab({ bases, farmers, baseStoresData, baseStoresLoading, expandedBase, setExpandedBase, onBaseCreated }) {
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
        />
      ))}
    </div>
  )
}

function BaseCard({ base, baseStoresData, baseStoresLoading, expanded, onToggle }) {
  const assignments  = base.assignments || []
  const completadas  = assignments.filter(a => a.status === 'COMPLETADO').length
  const enProceso    = assignments.filter(a => a.status === 'EN_PROCESO').length
  const sinLeer      = assignments.filter(a => a.status === 'SIN_LEER' || a.status === 'LEIDA').length
  const pct = assignments.length > 0 ? Math.round((completadas / assignments.length) * 100) : 0

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
              {pct}% · {completadas}/{assignments.length}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {sinLeer > 0     && <Chip label={`${sinLeer} pendiente${sinLeer > 1 ? 's' : ''}`} scheme={STATUS_COLOR.SIN_LEER} />}
          {enProceso > 0   && <Chip label={`${enProceso} en proceso`} scheme={STATUS_COLOR.EN_PROCESO} />}
          {completadas > 0 && <Chip label={`${completadas} listo${completadas > 1 ? 's' : ''}`} scheme={STATUS_COLOR.COMPLETADO} />}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {/* Farmers asignados */}
          {assignments.length > 0 && (
            <div style={{ padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 8,
              borderBottom: '1px solid var(--border)' }}>
              {assignments.map((a, i) => {
                const sc = STATUS_COLOR[a.status] || STATUS_COLOR.SIN_LEER
                return (
                  <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '6px 12px' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-input)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {a.farmerName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.farmerName}</p>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{a.storeCount ?? 0} tiendas</p>
                    </div>
                    <Chip label={sc.label} scheme={sc} />
                  </div>
                )
              })}
            </div>
          )}

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
  const [type, setType]             = useState('ACTIVE_F7D')
  const [message, setMessage]       = useState('')
  const [selectedFarmers, setSel]   = useState([])
  const [preview, setPreview]       = useState(null)   // { farmerId: stores[] }
  const [loadingPrev, setLoadPrev]  = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  // Plantillas por tipo
  const templates = {
    ACTIVE_F7D: 'Team! Les dejo la base ACTIVE del día.\n\nAliados que ingresaron recientemente — debemos lograr login y activación con órdenes.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    CHURN:      'Team! Les dejo la base CHURN del día.\n\nAliados que esta semana nos entran en churn — recuerden que lo ideal es buscar reconexión de por lo menos 5 minutos dentro de horario.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    RETENCION:  'Team! Les dejo la base PRIORIDAD RETENCIÓN del día.\n\nLa prioridad está en la columna 2 — empiecen por los \'Prioridad 1\'. Hay aliados con AVA MTD desde 6% hacia arriba. Recuerden: para que cuente en retención debe tener AVA del 10%.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    AVA_8_14:   'Team! Les dejo la base AVA 8-14 del día.\n\nAliados que YA LES CUENTAN PARA AVA. Miren la columna U — filtren por URGENTE!!\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
    PRIORIZACION: 'Team! Les dejo la base de PRIORIZACIÓN del día.\n\nFarmers en esta base: {farmers}\n\nEn todas tipifican las últimas 3 columnas!!\nMe confirman lectura!\nBASE PRIORIZACIÓN {fecha}',
  }

  const handleTypeChange = (val) => {
    setType(val)
    if (!message || Object.values(templates).includes(message)) {
      setMessage(templates[val] || '')
    }
    setPreview(null)
  }

  useEffect(() => {
    setMessage(templates[type] || '')
  }, [])

  const toggleFarmer = (id) => {
    setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setPreview(null)
  }

  const loadPreview = async () => {
    if (selectedFarmers.length === 0) return
    setLoadPrev(true)
    setPreview(null)
    try {
      const r = await getStoresByBaseType(type, selectedFarmers)
      // Agrupar por farmer según farmerEmail o brandId
      const byFarmer = {}
      for (const f of selectedFarmers) {
        const farmer = farmers.find(x => x.id === f)
        byFarmer[f] = { name: farmer?.fullName || `#${f}`, stores: [] }
      }
      // Stores vienen planas, las asignamos al farmer por farmerEmail
      for (const s of (r.data || [])) {
        const fId = selectedFarmers.find(id => {
          const f = farmers.find(x => x.id === id)
          return f && (f.email === s.farmerEmail)
        })
        if (fId) byFarmer[fId].stores.push(s)
      }
      setPreview(byFarmer)
    } catch (e) {
      setError('Error al cargar preview')
    } finally { setLoadPrev(false) }
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setError('El título es obligatorio'); return }
    if (selectedFarmers.length === 0) { setError('Selecciona al menos un farmer'); return }
    setSaving(true); setError(null)
    try {
      const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const farmerNames = selectedFarmers.map(id => farmers.find(f => f.id === id)?.fullName || `#${id}`).join(', ')
      const finalMsg = message
        .replace('{farmers}', farmerNames)
        .replace('{fecha}', fecha)

      await api.post('/bases', {
        title: title.trim(),
        type,
        message: finalMsg,
        farmerIds: selectedFarmers,
      })
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BASE_TYPE_OPTS.map(opt => (
                <button key={opt.value} onClick={() => handleTypeChange(opt.value)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  border: type === opt.value ? 'none' : '1px solid var(--border)',
                  background: type === opt.value ? '#ff441f' : 'var(--bg-input)',
                  color: type === opt.value ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
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
                  fontSize: 11, fontWeight: 700, color: '#3b82f6', background: 'none',
                  border: '1px solid rgba(59,130,246,0.4)', borderRadius: 6, padding: '3px 10px',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {loadingPrev ? 'Cargando...' : '👁 Ver tiendas que entran'}
                </button>
              </div>
            )}
          </div>

          {/* Preview de tiendas por farmer */}
          {preview && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', fontSize: 11,
                fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Preview de tiendas por farmer
              </div>
              {Object.entries(preview).map(([fId, { name, stores }]) => (
                <div key={fId} style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{stores.length} tiendas</span>
                  {stores.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {stores.slice(0, 10).map(s => (
                        <span key={s.id} style={{ fontSize: 10, background: 'var(--bg-input)',
                          color: 'var(--text-secondary)', padding: '2px 7px', borderRadius: 6 }}>
                          {s.storeName}
                        </span>
                      ))}
                      {stores.length > 10 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{stores.length - 10} más</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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

/* ─── Métricas globales ─────────────────────────────────────────────── */
function MetricGrid({ data }) {
  const items = [
    { label: 'Farmers',      value: data?.farmers?.length ?? 0, color: 'var(--text-primary)' },
    { label: 'Tiendas',      value: data?.totalStores ?? 0,      color: 'var(--text-primary)' },
    { label: 'Gestiones hoy',value: data?.totalGestiones ?? 0,   color: '#3b82f6' },
    { label: 'Efectivas',    value: data?.totalEfectivas ?? 0,   color: '#16a34a' },
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
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color, margin: '4px 0 0', lineHeight: 1 }}>{value}</p>
        </div>
      ))}
    </div>
  )
}

/* ─── Página principal ──────────────────────────────────────────────── */
export default function LiderDashboardPage() {
  const { user } = useAuth()
  const [activeNav, setActiveNav] = useState('dashboard')
  const [data, setData]           = useState(null)
  const [bases, setBases]         = useState([])
  const [managements, setMgts]    = useState([])
  const [loading, setLoading]     = useState(true)
  const [sort, setSort]           = useState('semaforo')
  const [expandedBase, setExpandedBase]       = useState(null)
  const [baseStoresData, setBaseStoresData]   = useState({})
  const [baseStoresLoading, setBSLoading]     = useState({})
  const [notifs, setNotifs]       = useState([])
  const [unread, setUnread]       = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef()

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
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 224, background: '#0f172a', display: 'flex', flexDirection: 'column',
        padding: '24px 0', flexShrink: 0, boxShadow: '2px 0 12px rgba(0,0,0,0.2)' }}>
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
              <span>{icon}</span>
              <span>{label}</span>
              {key === 'bases' && bases.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ff441f', color: '#fff',
                  fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px', lineHeight: 1.4 }}>
                  {bases.length}
                </span>
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
            border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
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
          padding: '0 28px', flexShrink: 0 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {NAV.find(n => n.key === activeNav)?.label}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{now}</span>
            {/* Campana */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={openNotifs} style={{ position: 'relative', background: 'none',
                border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px' }}>
                🔔
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444',
                    color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99,
                    padding: '1px 5px', lineHeight: 1.4 }}>{unread > 9 ? '9+' : unread}</span>
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
                        Marcar leído
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
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

          {/* Dashboard */}
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
                        transition: 'border-color 0.15s, box-shadow 0.15s',
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

          {/* Equipo hoy */}
          {activeNav === 'equipo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Equipo hoy
              </h2>
              {loading ? <Spinner /> : (
                <EquipoTab farmers={data?.farmers || []} managements={managements} sort={sort} setSort={setSort} />
              )}
            </div>
          )}

          {/* Bases */}
          {activeNav === 'bases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Bases de datos
                </h2>
              </div>
              {loading ? <Spinner /> : (
                <BasesTab
                  bases={bases}
                  farmers={data?.farmers || []}
                  baseStoresData={baseStoresData}
                  baseStoresLoading={baseStoresLoading}
                  expandedBase={expandedBase}
                  setExpandedBase={setExpandedBase}
                  onBaseCreated={() => { load(); loadBases() }}
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
