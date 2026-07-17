import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import {
  getSheetsStatus, connectSheets, getCasos, guardarGestion, getHistorial,
  getResumenHoy, guardarFeedbackIA,
} from '../services/agmService'
import TimelineList, { statusColor } from '../components/TimelineList'
import AgmTaskModal from '../components/AgmTaskModal'
import { remainingMs, slaColor, formatCountdown } from '../utils/sla'
import styles from './GestionAgmPage.module.css'

/** Convierte yyyy-MM-dd (lo que da el input del modal) a dd/MM/yyyy, formato usado en el Sheet. */
function toSheetDate(value) {
  if (!value) return value
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return value
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
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

export default function GestionAgmPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('gestion') // 'gestion' | 'feedback'
  const [sheetsStatus, setSheetsStatus] = useState(null)
  const [connecting, setConnecting] = useState(false)

  const [storeFiltro, setStoreFiltro] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState(null)
  const [grupos, setGrupos] = useState([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [historialStoreOpen, setHistorialStoreOpen] = useState(null)
  const [selected, setSelected] = useState(null) // { grupoIndex, tareaIndex }
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    getSheetsStatus().then(r => setSheetsStatus(r.data)).catch(() => setSheetsStatus({ connected: false }))
  }, [])

  // Refresca los temporizadores de SLA cada minuto sin volver a golpear el Sheet.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
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
      setBuscado(true)
    } catch (e) {
      setError(e.response?.data?.message || 'Error al leer el Sheet')
      setGrupos([])
      setBuscado(true)
    } finally {
      setBuscando(false)
    }
  }

  // Todas las tareas de todos los stores, aplanadas en filas y priorizadas por urgencia de SLA
  // (las que están más cerca de vencer o ya vencieron van primero; sin SLA calculable van al final).
  const filas = useMemo(() => {
    const planas = grupos.flatMap((g, gi) =>
      g.tareas.map((t, ti) => ({ ...t, grupoIndex: gi, tareaIndex: ti, grupo: g, remaining: remainingMs(t.fechaLimite, now) }))
    )
    return planas.sort((a, b) => {
      if (a.remaining == null && b.remaining == null) return 0
      if (a.remaining == null) return 1
      if (b.remaining == null) return -1
      return a.remaining - b.remaining
    })
  }, [grupos, now])

  const selectedGrupo = selected ? grupos[selected.grupoIndex] : null
  const selectedTarea = selectedGrupo ? selectedGrupo.tareas[selected.tareaIndex] : null

  const handleTareaChange = (patch) => {
    if (!selected) return
    setGrupos(prev => prev.map((g, gi) => gi !== selected.grupoIndex ? g : {
      ...g,
      tareas: g.tareas.map((t, ti) => ti !== selected.tareaIndex ? t : { ...t, ...patch }),
    }))
  }

  const handleGuardar = async (extra) => {
    if (!selected) return
    const grupo = grupos[selected.grupoIndex]
    const tarea = grupo.tareas[selected.tareaIndex]
    setSaving(true); setMsg(null)
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
      setSelected(null)
      handleBuscar()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Gestión AGM-IA</h1>
          <p className={styles.sub}>Casos escalados por LINA — conectado al Google Sheet real</p>
        </div>
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

      <div className={styles.topActions} style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className={`${styles.btnTab} ${tab === 'gestion' ? styles.btnTabActive : ''}`}
          onClick={() => setTab('gestion')}>Gestión Tareas</button>
        <button className={`${styles.btnTab} ${tab === 'feedback' ? styles.btnTabActive : ''}`}
          onClick={() => setTab('feedback')}>Feedback IA</button>
      </div>

      {tab === 'gestion' && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Mis tareas asignadas</div>
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
              {filas.length === 0
                ? <b>🎉 No hay pendientes para tu correo/filtro.</b>
                : <b>{filas.length} tarea{filas.length !== 1 ? 's' : ''} pendiente{filas.length !== 1 ? 's' : ''} en {grupos.length} tienda{grupos.length !== 1 ? 's' : ''}</b>}
            </div>
          )}

          {filas.length > 0 && (
            <div className={styles.tareasTableWrap}>
              <table className={styles.tareasTable}>
                <thead>
                  <tr>
                    <th>Prioridad</th>
                    <th>País</th>
                    <th>Store</th>
                    <th>Tipo soporte</th>
                    <th>Status</th>
                    <th>Días</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={f.rowNumber ?? i} className={styles.tareaRow}
                      onClick={() => setSelected({ grupoIndex: f.grupoIndex, tareaIndex: f.tareaIndex })}>
                      <td>
                        <div className={styles.slaBadge} style={{ color: slaColor(f.remaining) }}>
                          ⏱ {formatCountdown(f.remaining)}
                        </div>
                        <div className={styles.slaCategoria}>{f.categoria}</div>
                      </td>
                      <td>{f.grupo.pais}</td>
                      <td>
                        <div className={styles.tareaRowStore}>{f.grupo.storeName}</div>
                        <div className={styles.tareaRowStoreCode}>{f.grupo.storeId}</div>
                      </td>
                      <td>{f.tipoSoporte}</td>
                      <td>
                        <span className={styles.dayBadge} style={{ color: statusColor(f.status), borderColor: statusColor(f.status) + '55' }}>
                          {f.status || 'Pendiente'}
                        </span>
                      </td>
                      <td>
                        <span
                          title="Ver quién y cuándo gestionó esta tienda"
                          onClick={e => { e.stopPropagation(); setHistorialStoreOpen(f.grupo.storeId) }}
                          style={{ textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          {f.grupo.diasSinTocar ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'feedback' && <FeedbackIaTab />}

      {historialStoreOpen && (
        <StoreHistorialModal storeId={historialStoreOpen} onClose={() => setHistorialStoreOpen(null)} />
      )}

      {selected && selectedGrupo && selectedTarea && (
        <AgmTaskModal
          grupo={selectedGrupo}
          tarea={selectedTarea}
          storeId={selectedGrupo.storeId}
          agente={user?.email}
          onClose={() => setSelected(null)}
          onChange={handleTareaChange}
          onSave={handleGuardar}
          onRefresh={handleBuscar}
          saving={saving}
        />
      )}
    </div>
  )
}
