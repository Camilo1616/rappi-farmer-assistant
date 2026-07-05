import { useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './GestionAgmPage.module.css'

const STATUS_OPTIONS = [
  'Pendiente', 'On track', 'Confirmado', 'Escalado', 'Baja',
  'Sin Información', 'Asignada a otra área', 'Esperando Respuesta',
]

const ESTADOS_FINALES = new Set([
  'imposible contacto', 'confirmado', 'baja', 'asignada a otra área', 'gestión incompleta',
])

// ── Datos de ejemplo — reemplazar por datos reales cuando se conecte el backend ──
const MOCK_GRUPOS = [
  {
    pais: 'Colombia',
    storeId: 'CO-10234',
    telefono: '+57 300 123 4567',
    tareas: [
      {
        tipoSoporte: 'Activación de tienda',
        explicacion: 'El aliado reporta que no puede activar su catálogo en la app.',
        status: 'Pendiente',
        comentarioInterno: '',
        comentarioAliado: '',
        fechaEscalamiento: '',
        ticket: '',
        statusTicket: '',
        historial: 'IA: Hola, veo que tu catálogo no está activo. ¿Puedes confirmarme...\nAliado: Sí, ya lo intenté pero me sale error.',
        links: ['https://example.com/panel-aliado'],
      },
      {
        tipoSoporte: 'Problema de cobro',
        explicacion: 'Aliado indica que no le ha llegado un pago de la semana pasada.',
        status: 'Confirmado',
        comentarioInterno: 'Se validó con finanzas, pago programado para el viernes.',
        comentarioAliado: 'Tu pago está programado, llegará el viernes.',
        fechaEscalamiento: '2026-07-01',
        ticket: 'FIN-4821',
        statusTicket: 'Resuelto',
        historial: 'IA: Entiendo tu preocupación por el pago...\nAliado: Llevo esperando una semana.',
        links: [],
      },
    ],
  },
  {
    pais: 'Perú',
    storeId: 'PE-88231',
    telefono: '+51 987 654 321',
    tareas: [
      {
        tipoSoporte: 'Handoff — inicio de ventas',
        explicacion: 'Tienda nueva, requiere confirmación de fecha de arranque.',
        status: 'Escalado',
        comentarioInterno: '',
        comentarioAliado: '',
        fechaEscalamiento: '2026-07-05',
        ticket: '',
        statusTicket: '',
        historial: 'IA: ¡Bienvenido a Rappi! Vamos a coordinar tu fecha de inicio...',
        links: ['https://example.com/agenda-handoff'],
      },
    ],
  },
]

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
        {tarea.links.length === 0
          ? <p className={styles.emptyText}>No hay links relacionados.</p>
          : tarea.links.map((l, i) => (
              <p key={i}><a href={l} target="_blank" rel="noreferrer">Ver link {i + 1}</a></p>
            ))}

        <div className={styles.sectionTitle}>Comentarios previos</div>
        <div className={styles.historial}>Sin comentarios previos registrados (datos de ejemplo).</div>

        <div className={styles.sectionTitle}>Historial de conversación</div>
        <div className={styles.historial}>{tarea.historial}</div>

        <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body
  )
}

function TareaCard({ tarea, idx, onChange }) {
  const [modalOpen, setModalOpen] = useState(false)
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
        👁 Ver conversación y comentarios
      </button>

      <label className={styles.label}>Status *</label>
      <select className={styles.input} value={tarea.status} disabled={soloLectura}
        onChange={e => update({ status: e.target.value })}>
        <option value="">Selecciona</option>
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {tarea.status === 'Baja' && (
        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>Motivo baja *</label>
            <select className={styles.input} disabled={soloLectura} defaultValue="">
              <option value="">Selecciona</option>
              <option>Churn</option>
              <option>Test</option>
            </select>
          </div>
          <div>
            <label className={styles.label}>Tipo blacklist *</label>
            <select className={styles.input} disabled={soloLectura} defaultValue="">
              <option value="">Selecciona</option>
              <option>Permanente</option>
              <option>Temporal</option>
            </select>
          </div>
        </div>
      )}

      <label className={styles.label}>Comentario interno *</label>
      <textarea className={styles.textarea} disabled={soloLectura}
        value={tarea.comentarioInterno} onChange={e => update({ comentarioInterno: e.target.value })} />

      <label className={styles.label}>Comentario para el aliado</label>
      <textarea className={styles.textarea} disabled={soloLectura}
        value={tarea.comentarioAliado} onChange={e => update({ comentarioAliado: e.target.value })} />

      <div className={styles.grid2}>
        <div>
          <label className={styles.label}>Fecha escalamiento</label>
          <input className={styles.input} type="date" disabled={soloLectura}
            value={tarea.fechaEscalamiento} onChange={e => update({ fechaEscalamiento: e.target.value })} />
        </div>
        <div>
          <label className={styles.label}>Ticket</label>
          <input className={styles.input} type="text" disabled={soloLectura}
            value={tarea.ticket} onChange={e => update({ ticket: e.target.value })} />
        </div>
      </div>

      <label className={styles.label}>Status ticket</label>
      <select className={styles.input} disabled={soloLectura}
        value={tarea.statusTicket} onChange={e => update({ statusTicket: e.target.value })}>
        <option value="">Selecciona</option>
        <option>Pendiente</option>
        <option>Resuelto</option>
      </select>

      {!soloLectura && (
        <button className={styles.btnPrimary} disabled title="Vista previa — aún sin conectar al backend">
          Guardar gestión tarea {idx + 1}
        </button>
      )}

      {modalOpen && (
        <ConversacionModal tarea={tarea} storeId="—" onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

export default function GestionAgmPage() {
  const [tab, setTab] = useState('gestion') // 'gestion' | 'feedback'
  const [emailAgente, setEmailAgente] = useState('')
  const [storeFiltro, setStoreFiltro] = useState('')
  const [buscado, setBuscado] = useState(false)
  const [grupos, setGrupos] = useState([])
  const [indexGrupo, setIndexGrupo] = useState(0)

  const [fbMensajeErroneo, setFbMensajeErroneo] = useState('')
  const [fbSolucion, setFbSolucion] = useState('')

  const handleBuscar = () => {
    // Vista previa — datos de ejemplo, sin llamada a backend todavía
    setGrupos(MOCK_GRUPOS)
    setIndexGrupo(0)
    setBuscado(true)
  }

  const grupo = grupos[indexGrupo]

  const handleTareaChange = (idx, patch) => {
    setGrupos(prev => prev.map((g, gi) => gi !== indexGrupo ? g : {
      ...g,
      tareas: g.tareas.map((t, ti) => ti !== idx ? t : { ...t, ...patch }),
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Gestión AGM-IA</h1>
        <p className={styles.sub}>Vista previa — módulo nuevo, aún sin conectar a datos reales</p>
      </div>

      <div className={styles.previewBanner}>
        🧪 Esta pantalla usa datos de ejemplo para validar el diseño. La lógica real (conexión al Sheet/backend) se conecta después.
      </div>

      <div className={styles.topActions}>
        <button className={`${styles.btnTab} ${tab === 'gestion' ? styles.btnTabActive : ''}`}
          onClick={() => setTab('gestion')}>Gestión Tareas</button>
        <button className={`${styles.btnTab} ${tab === 'feedback' ? styles.btnTabActive : ''}`}
          onClick={() => setTab('feedback')}>Feedback IA</button>
      </div>

      {tab === 'gestion' && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Buscar tareas asignadas</div>
          <label className={styles.label}>Correo agente</label>
          <input className={styles.input} type="email" placeholder="correo@rappi.com"
            value={emailAgente} onChange={e => setEmailAgente(e.target.value)} />
          <label className={styles.label}>Buscar por Store ID</label>
          <input className={styles.input} type="text" placeholder="Opcional"
            value={storeFiltro} onChange={e => setStoreFiltro(e.target.value)} />
          <button className={styles.btnPrimary} onClick={handleBuscar} disabled={!emailAgente}>
            Buscar pendientes
          </button>

          {buscado && (
            <div className={styles.contador}>
              {grupos.length === 0
                ? <b>🎉 No hay pendientes para este agente/filtro.</b>
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
                </div>
                <div>
                  <div className={styles.dato}><b>Teléfono:</b> {grupo.telefono}</div>
                  <div className={styles.dato}><b>Tareas pendientes del Store:</b> {grupo.tareas.length}</div>
                </div>
              </div>

              {grupo.tareas.map((t, i) => (
                <TareaCard key={i} tarea={t} idx={i} onChange={handleTareaChange} />
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

      {tab === 'feedback' && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Feedback IA</div>
          <label className={styles.label}>Mensaje Erróneo *</label>
          <textarea className={styles.textarea} value={fbMensajeErroneo}
            onChange={e => setFbMensajeErroneo(e.target.value)} />
          <label className={styles.label}>Solución *</label>
          <textarea className={styles.textarea} value={fbSolucion}
            onChange={e => setFbSolucion(e.target.value)} />
          <label className={styles.label}>Adjunto Solución</label>
          <input className={styles.input} type="file" disabled />
          <div className={styles.smallNote}>Sube captura, doc, PDF o evidencia de solución.</div>
          <button className={styles.btnPrimary} disabled={!fbMensajeErroneo || !fbSolucion}
            title="Vista previa — aún sin conectar al backend">
            Guardar feedback
          </button>
        </div>
      )}
    </div>
  )
}
