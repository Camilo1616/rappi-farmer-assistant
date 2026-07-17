import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { globalSearchStores } from '../services/storeService'
import { deshacerUltimoCambio } from '../services/agmService'
import AgmStoreChat from './AgmStoreChat'
import styles from './FollowUpModal.module.css'
import pageStyles from '../pages/GestionAgmPage.module.css'

const STATUS_OPTIONS = [
  'Pendiente', 'On track', 'Confirmado', 'Escalado', 'Baja',
  'Sin Información', 'Asignada a otra área', 'Esperando Respuesta',
]

function esc(v) { return v ?? '' }

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

function estadoEsFinal(status) {
  const finales = new Set(['imposible contacto', 'confirmado', 'baja', 'asignada a otra área', 'gestión incompleta'])
  return finales.has((status || '').trim().toLowerCase())
}

/** Formulario de una tarea AGM puntual — guarda directo en el Sheet vía guardarGestion. */
function TareaForm({ tarea, storeId, agente, onChange, onSave, onRefresh, saving }) {
  const [motivoBaja, setMotivoBaja] = useState('')
  const [tipoBlacklist, setTipoBlacklist] = useState('')
  const [verConversacion, setVerConversacion] = useState(false)
  const [deshaciendo, setDeshaciendo] = useState(false)
  const [deshacerMsg, setDeshacerMsg] = useState(null)
  const soloLectura = estadoEsFinal(tarea.status)

  const handleDeshacer = async () => {
    if (!confirm('¿Deshacer el último cambio de esta tienda? Esto revierte al estado anterior.')) return
    setDeshaciendo(true); setDeshacerMsg(null)
    try {
      await deshacerUltimoCambio({ storeId, rowNumber: tarea.rowNumber, agente })
      onRefresh?.()
    } catch (e) {
      setDeshacerMsg(e.response?.data?.message || 'Error al deshacer')
    } finally {
      setDeshaciendo(false)
    }
  }

  return (
    <div>
      {soloLectura && (
        <div className={pageStyles.readOnlyNote}>
          🔒 Este caso está cerrado ({esc(tarea.status)}) y no puede modificarse. Solo lectura.
        </div>
      )}

      <div className={pageStyles.grid2}>
        <div><span className={pageStyles.dato}><b>Tipo soporte:</b> {esc(tarea.tipoSoporte)}</span></div>
        <div><span className={pageStyles.dato}><b>Explicación:</b> {esc(tarea.explicacion)}</span></div>
      </div>

      <button className={pageStyles.btnGhost} onClick={() => setVerConversacion(v => !v)}>
        👁 {verConversacion ? 'Ocultar' : 'Ver'} conversación IA-Aliado
      </button>

      {verConversacion && (
        <div style={{ margin: '8px 0' }}>
          <div className={pageStyles.sectionTitle}>Links relacionados</div>
          {(!tarea.links || tarea.links.length === 0)
            ? <p className={pageStyles.emptyText}>No hay links relacionados.</p>
            : tarea.links.map((l, i) => (
                <p key={i}><a href={l} target="_blank" rel="noreferrer">Ver link {i + 1}</a></p>
              ))}
          <div className={pageStyles.sectionTitle}>Historial de conversación (IA)</div>
          <div className={pageStyles.historial}>{tarea.historial || 'Sin historial'}</div>
        </div>
      )}

      <label className={pageStyles.label}>Status *</label>
      <select className={pageStyles.input} value={tarea.status || ''} disabled={soloLectura}
        onChange={e => onChange({ status: e.target.value })}>
        <option value="">Selecciona</option>
        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {tarea.status === 'Baja' && (
        <div className={pageStyles.grid2}>
          <div>
            <label className={pageStyles.label}>Motivo baja *</label>
            <select className={pageStyles.input} disabled={soloLectura} value={motivoBaja}
              onChange={e => setMotivoBaja(e.target.value)}>
              <option value="">Selecciona</option>
              <option>Churn</option>
              <option>Test</option>
            </select>
          </div>
          <div>
            <label className={pageStyles.label}>Tipo blacklist *</label>
            <select className={pageStyles.input} disabled={soloLectura} value={tipoBlacklist}
              onChange={e => setTipoBlacklist(e.target.value)}>
              <option value="">Selecciona</option>
              <option>Permanente</option>
              <option>Temporal</option>
            </select>
          </div>
        </div>
      )}

      <label className={pageStyles.label}>Comentario interno *</label>
      <textarea className={pageStyles.textarea} disabled={soloLectura}
        value={tarea.comentarioInterno || ''} onChange={e => onChange({ comentarioInterno: e.target.value })} />

      <label className={pageStyles.label}>Comentario para el aliado</label>
      <textarea className={pageStyles.textarea} disabled={soloLectura}
        value={tarea.comentarioAliado || ''} onChange={e => onChange({ comentarioAliado: e.target.value })} />

      <div className={pageStyles.grid2}>
        <div>
          <label className={pageStyles.label}>Fecha escalamiento</label>
          <input className={pageStyles.input} type="date" disabled={soloLectura}
            value={toInputDate(tarea.fechaEscalamiento)} onChange={e => onChange({ fechaEscalamiento: e.target.value })} />
        </div>
        <div>
          <label className={pageStyles.label}>Ticket</label>
          <input className={pageStyles.input} type="text" disabled={soloLectura}
            value={tarea.ticket || ''} onChange={e => onChange({ ticket: e.target.value })} />
        </div>
      </div>

      <label className={pageStyles.label}>Status ticket</label>
      <select className={pageStyles.input} disabled={soloLectura}
        value={tarea.statusTicket || ''} onChange={e => onChange({ statusTicket: e.target.value })}>
        <option value="">Selecciona</option>
        <option>Pendiente</option>
        <option>Resuelto</option>
      </select>

      {!soloLectura && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={pageStyles.btnPrimary} disabled={saving || !tarea.status}
            onClick={() => onSave({ motivoBaja, tipoBlacklist })}>
            {saving ? 'Guardando...' : 'Guardar gestión'}
          </button>
          <button className={pageStyles.btnGhost} disabled={deshaciendo} onClick={handleDeshacer}
            title="Revierte esta tienda al estado anterior al último cambio guardado">
            {deshaciendo ? 'Deshaciendo...' : '↩ Deshacer último cambio'}
          </button>
        </div>
      )}
      {deshacerMsg && <div className={pageStyles.readOnlyNote}>⚠ {deshacerMsg}</div>}
    </div>
  )
}

/**
 * Modal de detalle de una tarea AGM: trae historial + chat IA de la tienda (cruzando
 * storeCode -> id interno) y, junto a eso, el formulario que guarda la gestión en el Sheet.
 */
export default function AgmTaskModal({ grupo, tarea, storeId, agente, onClose, onChange, onSave, onRefresh, saving }) {
  const [dbStore, setDbStore] = useState(null)
  const [lookupError, setLookupError] = useState(false)

  useEffect(() => {
    let cancelled = false
    globalSearchStores(storeId).then(r => {
      if (cancelled) return
      const match = (r.data ?? []).find(s => s.storeCode === storeId) ?? r.data?.[0] ?? null
      if (match) setDbStore(match)
      else setLookupError(true)
    }).catch(() => !cancelled && setLookupError(true))
    return () => { cancelled = true }
  }, [storeId])

  const gestionSlot = (
    <TareaForm
      tarea={tarea}
      storeId={storeId}
      agente={agente}
      onChange={onChange}
      onSave={onSave}
      onRefresh={onRefresh}
      saving={saving}
    />
  )

  return createPortal(
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.rightPanel}>
          <div className={styles.leftHeader} style={{ padding: '14px 18px 0' }}>
            <span className={styles.leftTitle}>{grupo.storeName || storeId}</span>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {!dbStore && !lookupError && (
            <div className={styles.emptyChat}>
              <span className={styles.emptyChatIcon}>⏳</span>
              <p>Cargando historial e IA de la tienda...</p>
            </div>
          )}

          {lookupError && (
            <>
              <div className={pageStyles.readOnlyNote} style={{ margin: '0 18px' }}>
                ⚠ No se encontró la tienda {storeId} en la base — solo se muestra el formulario de gestión.
              </div>
              <div style={{ padding: '0 18px 18px' }}>{gestionSlot}</div>
            </>
          )}

          {dbStore && <AgmStoreChat store={dbStore} gestionSlot={gestionSlot} />}
        </div>
      </div>
    </div>,
    document.body
  )
}
