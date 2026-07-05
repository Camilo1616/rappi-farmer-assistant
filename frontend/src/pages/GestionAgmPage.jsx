import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { getSheetsStatus, connectSheets, getCasos, guardarGestion } from '../services/agmService'
import styles from './GestionAgmPage.module.css'

const STATUS_OPTIONS = [
  'Pendiente', 'On track', 'Confirmado', 'Escalado', 'Baja',
  'Sin Información', 'Asignada a otra área', 'Esperando Respuesta',
]

const ESTADOS_FINALES = new Set([
  'imposible contacto', 'confirmado', 'baja', 'asignada a otra área', 'gestión incompleta',
])

function esc(v) { return v ?? '' }

function estadoEsFinal(status) {
  return ESTADOS_FINALES.has((status || '').trim().toLowerCase())
}

function ConversacionModal({ tarea, storeId, onClose }) {
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

        <div className={styles.sectionTitle}>Historial de conversación</div>
        <div className={styles.historial}>{tarea.historial || 'Sin historial'}</div>

        <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body
  )
}

function TareaCard({ tarea, idx, storeId, onChange, onSave, saving }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [motivoBaja, setMotivoBaja] = useState('')
  const [tipoBlacklist, setTipoBlacklist] = useState('')
  const soloLectura = estadoEsFinal(tarea.status)

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
        👁 Ver conversación
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
            value={tarea.fechaEscalamiento || ''} onChange={e => update({ fechaEscalamiento: e.target.value })} />
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
        <button className={styles.btnPrimary} disabled={saving || !tarea.status}
          onClick={() => onSave(idx, { motivoBaja, tipoBlacklist })}>
          {saving ? 'Guardando...' : `Guardar gestión tarea ${idx + 1}`}
        </button>
      )}

      {modalOpen && (
        <ConversacionModal tarea={tarea} storeId={storeId} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

export default function GestionAgmPage() {
  const { user } = useAuth()
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

  useEffect(() => {
    getSheetsStatus().then(r => setSheetsStatus(r.data)).catch(() => setSheetsStatus({ connected: false }))
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { data } = await connectSheets()
      window.location.href = data.authUrl
    } catch (e) {
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
        fechaEscalamiento: tarea.fechaEscalamiento,
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
            <div className={styles.sectionTitle}>Store agrupado</div>
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
              <TareaCard key={t.rowNumber ?? i} tarea={t} idx={i} storeId={grupo.storeId}
                onChange={handleTareaChange} onSave={handleGuardar} saving={savingIdx === i} />
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
    </div>
  )
}
