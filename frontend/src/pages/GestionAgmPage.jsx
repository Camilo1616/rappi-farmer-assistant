import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import {
  getSheetsStatus, connectSheets, getCasos, guardarGestion, getHistorial,
  getResumenHoy, deshacerUltimoCambio, guardarFeedbackIA,
} from '../services/agmService'
import styles from './GestionAgmPage.module.css'

const STATUS_OPTIONS = [
  'Pendiente', 'On track', 'Confirmado', 'Escalado', 'Baja',
  'Sin Información', 'Asignada a otra área', 'Esperando Respuesta',
]

const ESTADOS_FINALES = new Set([
  'imposible contacto', 'confirmado', 'baja', 'asignada a otra área', 'gestión incompleta',
])

const STATUS_COLOR = {
  'confirmado': '#22C55E', 'on track': '#3B82F6', 'baja': '#EF4444',
  'escalado': '#F97316', 'pendiente': '#6B7280', 'esperando respuesta': '#F59E0B',
  'sin información': '#A855F7', 'asignada a otra área': '#94A3B8', 'imposible contacto': '#EF4444',
}

function esc(v) { return v ?? '' }

/** Convierte una fecha del Sheet (dd/MM/yyyy o yyyy-MM-dd) al formato que exige <input type="date">. */
function toInputDate(value) {
  if (!value) return ''
  const v = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return ''
}

/** Convierte yyyy-MM-dd (lo que da el input) a dd/MM/yyyy, formato usado en el Sheet. */
function toSheetDate(value) {
  if (!value) return value
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return value
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
}

function estadoEsFinal(status) {
  return ESTADOS_FINALES.has((status || '').trim().toLowerCase())
}

function statusColor(status) {
  return STATUS_COLOR[(status || '').trim().toLowerCase()] || '#6B7280'
}

/* ── Timeline de cambios (usado en el modal por tienda y en "Mi Historial") ── */
function TimelineList({ entries, showStore }) {
  if (!entries || entries.length === 0) {
    return <p className={styles.emptyText}>Sin cambios registrados todavía.</p>
  }
  return (
    <div className={styles.timeline}>
      {entries.map((h, i) => (
        <div key={i} className={styles.timelineRow}>
          <span className={styles.timelineDot} style={{ background: statusColor(h.status) }} />
          <div className={styles.timelineBody}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineStatus} style={{ color: statusColor(h.status) }}>{h.status || '—'}</span>
              {showStore && <span className={styles.timelineStore}>{h.storeId}</span>}
              <span className={styles.timelineDate}>{h.fechaHora}</span>
            </div>
            {h.agente && <div className={styles.timelineMeta}>Agente: {h.agente}</div>}
            {h.comentarioInterno && <div className={styles.timelineComment}><b>Interno:</b> {h.comentarioInterno}</div>}
            {h.comentarioAliado && <div className={styles.timelineComment}><b>Aliado:</b> {h.comentarioAliado}</div>}
            {h.ticket && <div className={styles.timelineMeta}>Ticket: {h.ticket} ({h.statusTicket || 'sin status'})</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Historial completo de una tienda (qué agentes la tocaron y cuándo) ── */
function StoreHistorialModal({ storeId, onClose }) {
  const [historial, setHistorial] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHistorial({ storeId })
      .then(r => setHistorial(r.data))
      .catch(() => setHistorial([]))
      .finally(() => setLoading(false))
  }, [storeId])

  const agentesUnicos = [...new Set((historial || []).map(h => h.agente).filter(Boolean))]

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>📅 Historial de la tienda</h2>
        <p className={styles.modalStore}><strong>Store ID:</strong> {storeId}</p>

        {!loading && agentesUnicos.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className={styles.sectionTitle} style={{ marginTop: 0 }}>Agentes que la han gestionado</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {agentesUnicos.map(a => (
                <span key={a} className={styles.dayBadge} style={{ color: '#3B82F6', borderColor: '#3B82F655' }}>{a}</span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.sectionTitle}>Cambios registrados</div>
        {loading ? <p className={styles.emptyText}>Cargando...</p> : <TimelineList entries={historial} />}

        <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body
  )
}

function ConversacionModal({ tarea, storeId, onClose }) {
  const [historial, setHistorial] = useState(null)
  const [loadingHist, setLoadingHist] = useState(true)

  useEffect(() => {
    getHistorial({ storeId })
      .then(r => setHistorial(r.data))
      .catch(() => setHistorial([]))
      .finally(() => setLoadingHist(false))
  }, [storeId])

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Conversación IA - Aliado</h2>
        <p className={styles.modalStore}><strong>Store ID:</strong> {storeId}</p>

        <div className={styles.sectionTitle}>Links relacionados</div>
        {(!tarea.links || tarea.links.length === 0)
          ? <p className={styles.emptyText}>No hay links relacionados.</p>
          : tarea.links.map((l, i) => (
              <p key={i}><a href={l} target="_blank" rel="noreferrer">Ver link {i + 1}</a></p>
            ))}

        <div className={styles.sectionTitle}>Historial de conversación (IA)</div>
        <div className={styles.historial}>{tarea.historial || 'Sin historial'}</div>

        <div className={styles.sectionTitle}>📅 Historial de gestión de esta tienda</div>
        {loadingHist
          ? <p className={styles.emptyText}>Cargando...</p>
          : <TimelineList entries={historial} />}

        <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body
  )
}

function ResumenHoyBanner({ email }) {
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    getResumenHoy().then(r => setResumen(r.data)).catch(() => setResumen(null))
  }, [email])

  if (!resumen || resumen.totalHoy === 0) return null

  return (
    <div className={styles.card} style={{ marginBottom: 16 }}>
      <div className={styles.sectionTitle}>📊 Hoy gestionaste {resumen.totalHoy} caso{resumen.totalHoy !== 1 ? 's' : ''}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(resumen.porStatus || {}).map(([status, n]) => (
          <span key={status} className={styles.dayBadge} style={{ color: statusColor(status), borderColor: statusColor(status) + '55' }}>
            {status} × {n}
          </span>
        ))}
      </div>
    </div>
  )
}

function TareaCard({ tarea, idx, storeId, agente, onChange, onSave, onRefresh, saving }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [motivoBaja, setMotivoBaja] = useState('')
  const [tipoBlacklist, setTipoBlacklist] = useState('')
  const [deshaciendo, setDeshaciendo] = useState(false)
  const [deshacerMsg, setDeshacerMsg] = useState(null)
  const soloLectura = estadoEsFinal(tarea.status)

  const handleDeshacer = async () => {
    if (!confirm('¿Deshacer el último cambio de esta tienda? Esto revierte al estado anterior.')) return
    setDeshaciendo(true); setDeshacerMsg(null)
    try {
      await deshacerUltimoCambio({ storeId, rowNumber: tarea.rowNumber, agente })
      onRefresh()
    } catch (e) {
      setDeshacerMsg(e.response?.data?.message || 'Error al deshacer')
    } finally {
      setDeshaciendo(false)
    }
  }

  const update = (patch) => onChange(idx, patch)

  return (
    <div className={styles.taskCard}>
      <div className={styles.sectionTitle}>Tarea {idx + 1}</div>

      {soloLectura && (
        <div className={styles.readOnlyNote}>
          🔒 Este caso está cerrado ({esc(tarea.status)}) y no puede modificarse. Solo lectura.
        </div>
      )}

      <div className={styles.grid2}>
        <div><span className={styles.dato}><b>Tipo soporte:</b> {esc(tarea.tipoSoporte)}</span></div>
        <div><span className={styles.dato}><b>Explicación:</b> {esc(tarea.explicacion)}</span></div>
      </div>

      <button className={styles.btnGhost} onClick={() => setModalOpen(true)}>
        👁 Ver conversación e historial
      </button>

      <label className={styles.label}>Status *</label>
      <select className={styles.input} value={tarea.status || ''} disabled={soloLectura}
        onChange={e => update({ status: e.target.value })}>
        <option value="">Selecciona</option>
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {tarea.status === 'Baja' && (
        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>Motivo baja *</label>
            <select className={styles.input} disabled={soloLectura} value={motivoBaja}
              onChange={e => setMotivoBaja(e.target.value)}>
              <option value="">Selecciona</option>
              <option>Churn</option>
              <option>Test</option>
            </select>
          </div>
          <div>
            <label className={styles.label}>Tipo blacklist *</label>
            <select className={styles.input} disabled={soloLectura} value={tipoBlacklist}
              onChange={e => setTipoBlacklist(e.target.value)}>
              <option value="">Selecciona</option>
              <option>Permanente</option>
              <option>Temporal</option>
            </select>
          </div>
        </div>
      )}

      <label className={styles.label}>Comentario interno *</label>
      <textarea className={styles.textarea} disabled={soloLectura}
        value={tarea.comentarioInterno || ''} onChange={e => update({ comentarioInterno: e.target.value })} />

      <label className={styles.label}>Comentario para el aliado</label>
      <textarea className={styles.textarea} disabled={soloLectura}
        value={tarea.comentarioAliado || ''} onChange={e => update({ comentarioAliado: e.target.value })} />

      <div className={styles.grid2}>
        <div>
          <label className={styles.label}>Fecha escalamiento</label>
          <input className={styles.input} type="date" disabled={soloLectura}
            value={toInputDate(tarea.fechaEscalamiento)} onChange={e => update({ fechaEscalamiento: e.target.value })} />
        </div>
        <div>
          <label className={styles.label}>Ticket</label>
          <input className={styles.input} type="text" disabled={soloLectura}
            value={tarea.ticket || ''} onChange={e => update({ ticket: e.target.value })} />
        </div>
      </div>

      <label className={styles.label}>Status ticket</label>
      <select className={styles.input} disabled={soloLectura}
        value={tarea.statusTicket || ''} onChange={e => update({ statusTicket: e.target.value })}>
        <option value="">Selecciona</option>
        <option>Pendiente</option>
        <option>Resuelto</option>
      </select>

      {!soloLectura && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={styles.btnPrimary} disabled={saving || !tarea.status}
            onClick={() => onSave(idx, { motivoBaja, tipoBlacklist })}>
            {saving ? 'Guardando...' : `Guardar gestión tarea ${idx + 1}`}
          </button>
          <button className={styles.btnGhost} disabled={deshaciendo} onClick={handleDeshacer}
            title="Revierte esta tienda al estado anterior al último cambio guardado">
            {deshaciendo ? 'Deshaciendo...' : '↩ Deshacer último cambio'}
          </button>
        </div>
      )}
      {deshacerMsg && <div className={styles.readOnlyNote}>⚠ {deshacerMsg}</div>}

      {modalOpen && (
        <ConversacionModal tarea={tarea} storeId={storeId} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

/* ── Tab "Feedback IA" — reportar cuando LINA respondió mal ── */
function FeedbackIaTab() {
  const [mensajeErroneo, setMensajeErroneo] = useState('')
  const [solucion, setSolucion] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleSubmit = async () => {
    if (!mensajeErroneo.trim() || !solucion.trim()) return
    setSaving(true); setMsg(null)
    try {
      await guardarFeedbackIA({ mensajeErroneo, solucion })
      setMsg({ type: 'ok', text: '✅ Feedback guardado — gracias por ayudar a mejorar a LINA' })
      setMensajeErroneo(''); setSolucion('')
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.message || 'Error al guardar feedback' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.sectionTitle}>Feedback IA</div>
      <p className={styles.emptyText}>Reporta cuando LINA respondió algo incorrecto a un aliado, para que el equipo lo revise.</p>

      {msg && (
        <div className={styles.readOnlyNote} style={msg.type === 'ok' ? { color: '#22C55E' } : {}}>
          {msg.text}
        </div>
      )}

      <label className={styles.label}>Mensaje Erróneo *</label>
      <textarea className={styles.textarea} value={mensajeErroneo}
        onChange={e => setMensajeErroneo(e.target.value)}
        placeholder="Pega o describe lo que LINA respondió mal" />

      <label className={styles.label}>Solución *</label>
      <textarea className={styles.textarea} value={solucion}
        onChange={e => setSolucion(e.target.value)}
        placeholder="¿Cuál era la respuesta correcta?" />

      <button className={styles.btnPrimary} disabled={saving || !mensajeErroneo.trim() || !solucion.trim()}
        onClick={handleSubmit}>
        {saving ? 'Guardando...' : 'Guardar feedback'}
      </button>
    </div>
  )
}

/* ── Tab "Mi Historial" — agrupado por día, con contadores por status ── */
function MiHistorialTab() {
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entries, setEntries] = useState([])
  const [openDay, setOpenDay] = useState(null)

  const load = (d) => {
    setLoading(true); setError(null)
    getHistorial({ days: d })
      .then(r => setEntries(r.data))
      .catch(e => setError(e.response?.data?.message || 'Error al leer el historial'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(days) }, [days])

  // Agrupar por día (YYYY-MM-DD extraído de "yyyy-MM-dd HH:mm:ss")
  const porDia = {}
  for (const e of entries) {
    const dia = (e.fechaHora || '').slice(0, 10) || 'Sin fecha'
    porDia[dia] = porDia[dia] || []
    porDia[dia].push(e)
  }
  const dias = Object.keys(porDia).sort().reverse()

  return (
    <div className={styles.card}>
      <div className={styles.sectionTitle}>📅 Mi historial de gestiones</div>
      <p className={styles.emptyText}>Aquí ves qué tareas gestionaste y cuándo — incluye ayer y días anteriores.</p>

      <div style={{ display: 'flex', gap: 8, margin: '10px 0 16px' }}>
        {[7, 15, 30].map(d => (
          <button key={d}
            className={styles.btnGhost}
            style={days === d ? { borderColor: 'var(--rappi-orange)', color: 'var(--rappi-orange)' } : {}}
            onClick={() => setDays(d)}>
            Últimos {d} días
          </button>
        ))}
      </div>

      {loading && <p className={styles.emptyText}>Cargando...</p>}
      {error && <div className={styles.readOnlyNote}>⚠ {error}</div>}

      {!loading && !error && dias.length === 0 && (
        <p className={styles.emptyText}>No has gestionado ninguna tarea en este periodo.</p>
      )}

      {!loading && !error && dias.map(dia => {
        const items = porDia[dia]
        const conteo = {}
        items.forEach(e => { conteo[e.status || 'Sin status'] = (conteo[e.status || 'Sin status'] || 0) + 1 })
        const abierto = openDay === dia
        return (
          <div key={dia} className={styles.dayGroup}>
            <button className={styles.dayHeader} onClick={() => setOpenDay(abierto ? null : dia)}>
              <span>{dia}</span>
              <span className={styles.dayCount}>{items.length} cambios</span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(conteo).map(([status, n]) => (
                  <span key={status} className={styles.dayBadge} style={{ color: statusColor(status), borderColor: statusColor(status) + '55' }}>
                    {status} × {n}
                  </span>
                ))}
              </span>
              <span style={{ marginLeft: 'auto' }}>{abierto ? '▲' : '▼'}</span>
            </button>
            {abierto && <TimelineList entries={items} showStore />}
          </div>
        )
      })}
    </div>
  )
}

export default function GestionAgmPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('gestion') // 'gestion' | 'historial'
  const [sheetsStatus, setSheetsStatus] = useState(null)
  const [connecting, setConnecting] = useState(false)

  const [storeFiltro, setStoreFiltro] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState(null)
  const [grupos, setGrupos] = useState([])
  const [indexGrupo, setIndexGrupo] = useState(0)
  const [savingIdx, setSavingIdx] = useState(null)
  const [msg, setMsg] = useState(null)
  const [historialStoreOpen, setHistorialStoreOpen] = useState(null)

  useEffect(() => {
    getSheetsStatus().then(r => setSheetsStatus(r.data)).catch(() => setSheetsStatus({ connected: false }))
  }, [])

  const handleConnect = async () => {
    setConnecting(true); setMsg(null)
    try {
      const { data } = await connectSheets()
      if (!data?.authUrl) {
        setMsg({ type: 'err', text: 'El servidor no devolvió una URL de autorización.' })
        setConnecting(false)
        return
      }
      window.location.href = data.authUrl
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.message || `Error al conectar (${e.response?.status || 'sin conexión'})` })
      setConnecting(false)
    }
  }

  const handleBuscar = async () => {
    setBuscando(true); setError(null)
    try {
      const { data } = await getCasos(storeFiltro || undefined)
      setGrupos(data)
      setIndexGrupo(0)
      setBuscado(true)
    } catch (e) {
      setError(e.response?.data?.message || 'Error al leer el Sheet')
      setGrupos([])
      setBuscado(true)
    } finally {
      setBuscando(false)
    }
  }

  const grupo = grupos[indexGrupo]

  const handleTareaChange = (idx, patch) => {
    setGrupos(prev => prev.map((g, gi) => gi !== indexGrupo ? g : {
      ...g,
      tareas: g.tareas.map((t, ti) => ti !== idx ? t : { ...t, ...patch }),
    }))
  }

  const handleGuardar = async (idx, extra) => {
    const tarea = grupo.tareas[idx]
    setSavingIdx(idx); setMsg(null)
    try {
      await guardarGestion({
        rowNumber: tarea.rowNumber,
        storeId: grupo.storeId,
        agente: user?.email,
        status: tarea.status,
        comentarioInterno: tarea.comentarioInterno,
        comentarioAliado: tarea.comentarioAliado,
        fechaEscalamiento: toSheetDate(tarea.fechaEscalamiento),
        ticket: tarea.ticket,
        statusTicket: tarea.statusTicket,
        motivoBaja: extra?.motivoBaja,
        tipoBlacklist: extra?.tipoBlacklist,
      })
      setMsg({ type: 'ok', text: 'Gestión guardada correctamente' })
      handleBuscar()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.message || 'Error al guardar' })
    } finally {
      setSavingIdx(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Gestión AGM-IA</h1>
        <p className={styles.sub}>Casos escalados por LINA — conectado al Google Sheet real</p>
      </div>

      {sheetsStatus && !sheetsStatus.connected && (
        <div className={styles.previewBanner}>
          🔌 El Sheet aún no está conectado.
          {user?.role === 'ADMIN'
            ? <button className={styles.btnGhost} style={{ marginLeft: 10 }} onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Conectando...' : 'Conectar Google Sheets'}
              </button>
            : ' Pide a un Administrador que lo conecte desde este módulo.'}
        </div>
      )}

      {msg && (
        <div className={styles.previewBanner} style={msg.type === 'ok' ? { background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.4)', color: '#22C55E' } : {}}>
          {msg.text}
        </div>
      )}

      <ResumenHoyBanner email={user?.email} />

      <div className={styles.topActions} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <button className={`${styles.btnTab} ${tab === 'gestion' ? styles.btnTabActive : ''}`}
          onClick={() => setTab('gestion')}>Gestión Tareas</button>
        <button className={`${styles.btnTab} ${tab === 'historial' ? styles.btnTabActive : ''}`}
          onClick={() => setTab('historial')}>Mi Historial</button>
        <button className={`${styles.btnTab} ${tab === 'feedback' ? styles.btnTabActive : ''}`}
          onClick={() => setTab('feedback')}>Feedback IA</button>
      </div>

      {tab === 'gestion' && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Buscar mis tareas asignadas</div>
          <p className={styles.emptyText}>Correo: {user?.email}</p>
          <label className={styles.label}>Buscar por Store ID</label>
          <input className={styles.input} type="text" placeholder="Opcional"
            value={storeFiltro} onChange={e => setStoreFiltro(e.target.value)} />
          <button className={styles.btnPrimary} onClick={handleBuscar} disabled={buscando}>
            {buscando ? 'Buscando...' : 'Buscar pendientes'}
          </button>

          {error && <div className={styles.readOnlyNote}>⚠ {error}</div>}

          {buscado && !error && (
            <div className={styles.contador}>
              {grupos.length === 0
                ? <b>🎉 No hay pendientes para tu correo/filtro.</b>
                : <b>Store {indexGrupo + 1} de {grupos.length}</b>}
            </div>
          )}

          {grupo && (
            <div className={styles.grupoBox}>
              <div className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                Store agrupado
                {grupo.diasSinTocar != null && (
                  <span className={styles.dayBadge} style={{
                    color: grupo.diasSinTocar >= 3 ? '#EF4444' : grupo.diasSinTocar >= 1 ? '#F59E0B' : '#22C55E',
                    borderColor: (grupo.diasSinTocar >= 3 ? '#EF4444' : grupo.diasSinTocar >= 1 ? '#F59E0B' : '#22C55E') + '55',
                    cursor: 'pointer',
                  }} onClick={() => setHistorialStoreOpen(grupo.storeId)}
                    title="Ver quién y cuándo gestionó esta tienda">
                    ⏱ {grupo.diasSinTocar === 0 ? 'Gestionado hoy' : `${grupo.diasSinTocar} día${grupo.diasSinTocar !== 1 ? 's' : ''} sin tocar`}
                  </span>
                )}
                {grupo.diasSinTocar == null && (() => {
                  const tieneAvance = grupo.tareas.some(t =>
                    (t.status && t.status.trim()) || (t.comentarioInterno && t.comentarioInterno.trim()) || (t.ticket && t.ticket.trim()))
                  return (
                    <span className={styles.dayBadge} style={{
                      color: tieneAvance ? '#94A3B8' : '#EF4444',
                      borderColor: (tieneAvance ? '#94A3B8' : '#EF4444') + '55',
                      cursor: 'pointer',
                    }}
                      onClick={() => setHistorialStoreOpen(grupo.storeId)}
                      title="Ver quién y cuándo gestionó esta tienda">
                      ⏱ {tieneAvance ? 'Gestionado (sin fecha registrada en el Sheet)' : 'Sin gestionar aún'} — clic para ver detalle
                    </span>
                  )
                })()}
              </div>
              <div className={styles.grid2}>
                <div>
                  <div className={styles.dato}><b>País:</b> {grupo.pais}</div>
                  <div className={styles.dato}><b>Store ID:</b> {grupo.storeId}</div>
                  <div className={styles.dato}><b>Nombre:</b> {grupo.storeName}</div>
                </div>
                <div>
                  <div className={styles.dato}><b>Teléfono:</b> {grupo.telefono}</div>
                  <div className={styles.dato}><b>Tareas pendientes del Store:</b> {grupo.tareas.length}</div>
                </div>
              </div>

              {grupo.tareas.map((t, i) => (
                <TareaCard key={t.rowNumber ?? i} tarea={t} idx={i} storeId={grupo.storeId} agente={user?.email}
                  onChange={handleTareaChange} onSave={handleGuardar} onRefresh={handleBuscar} saving={savingIdx === i} />
              ))}

              <div className={styles.nav}>
                <button className={styles.btnGhost} disabled={indexGrupo === 0}
                  onClick={() => setIndexGrupo(i => i - 1)}>Anterior Store</button>
                <button className={styles.btnGhost} disabled={indexGrupo >= grupos.length - 1}
                  onClick={() => setIndexGrupo(i => i + 1)}>Siguiente Store</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'historial' && <MiHistorialTab />}
      {tab === 'feedback' && <FeedbackIaTab />}

      {historialStoreOpen && (
        <StoreHistorialModal storeId={historialStoreOpen} onClose={() => setHistorialStoreOpen(null)} />
      )}
    </div>
  )
}
