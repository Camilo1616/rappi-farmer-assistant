import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getBasesForFarmer, updateBaseStatus } from '../services/dashboardService'
import { registerManagement } from '../services/dashboardService'
import styles from '../layouts/AppLayout.module.css'

const STATUS_NEXT = { SIN_LEER: 'LEIDA', LEIDA: 'EN_PROCESO', EN_PROCESO: 'COMPLETADO', COMPLETADO: null }
const STATUS_COLOR = {
  SIN_LEER:   { bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  LEIDA:      { bg: 'rgba(249,115,22,0.1)',  color: '#F97316' },
  EN_PROCESO: { bg: 'rgba(234,179,8,0.12)',  color: '#EAB308' },
  COMPLETADO: { bg: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
}

const TIPOS = ['WHATSAPP', 'LLAMADA', 'SAC', 'SEGUIMIENTO', 'ACTIVACION']
const RESULTADOS = ['EFECTIVA', 'NO_CONTACTO', 'NO_RESPONDE', 'PROBLEMA_TECNICO', 'REQUIERE_SEGUIMIENTO']
const RESULTADO_LABEL = {
  EFECTIVA: 'Efectiva',
  NO_CONTACTO: 'No contacto',
  NO_RESPONDE: 'No responde',
  PROBLEMA_TECNICO: 'Problema técnico',
  REQUIERE_SEGUIMIENTO: 'Requiere seguimiento',
}

/** Bases asignadas por el líder — /dashboard/bases */
export default function BasesPage() {
  const [bases, setBases] = useState([])
  const [loading, setLoading] = useState(true)

  const loadBases = async () => {
    setLoading(true)
    try {
      const { data } = await getBasesForFarmer()
      setBases(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadBases() }, [])

  const handleStatusChange = async (assignmentId, nextStatus) => {
    if (!nextStatus) return
    try {
      await updateBaseStatus(assignmentId, nextStatus)
      await loadBases()
    } catch {}
  }

  if (loading) {
    return <div className={styles.loadingWrapper}><div className={styles.loadingSpinner}/> Cargando bases...</div>
  }

  if (bases.length === 0) {
    return (
      <div className={styles.comingSoon}>
        <span className={styles.comingSoonIcon}>📦</span>
        <p className={styles.comingSoonText}>No tienes bases asignadas</p>
        <p className={styles.comingSoonSub}>Tu líder asignará bases próximamente</p>
      </div>
    )
  }

  return (
    <div className={styles.sections}>
      {bases.map(base => (
        <BaseCard key={base.assignmentId} base={base} onStatusChange={handleStatusChange} />
      ))}
    </div>
  )
}

function StoreContextMenu({ x, y, store, onClose, onEfectiva }) {
  const [tipo, setTipo] = useState('')
  const [resultado, setResultado] = useState('')
  const [comentario, setComentario] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef()

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])

  const handleSave = async () => {
    if (!tipo || !resultado || !comentario.trim()) return
    setSaving(true)
    setError(null)
    try {
      await registerManagement(store.id, { managementType: tipo, resultType: resultado, comments: comentario })
      if (resultado === 'EFECTIVA') onEfectiva(store.id)
      setDone(true)
      setTimeout(onClose, 900)
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Error al guardar la gestión'
      setError(msg)
      setSaving(false)
    }
  }

  const px = Math.min(x, window.innerWidth - 290)
  const py = Math.min(y, window.innerHeight - 400)

  return createPortal(
    <div ref={ref} className={styles.ctxMenu} style={{ left: px, top: py }}>
      {done ? (
        <div className={styles.ctxDone}>✓ Gestión registrada</div>
      ) : (
        <>
          <div className={styles.ctxTitle}>{store.storeName}</div>
          <div className={styles.ctxSub}>{store.storeCode}</div>

          <div className={styles.ctxFieldLabel}>Tipo de gestión *</div>
          <div className={styles.ctxChips}>
            {TIPOS.map(t => (
              <button
                key={t}
                className={`${styles.ctxChip} ${tipo === t ? styles.ctxChipActive : ''}`}
                onClick={() => setTipo(t)}
              >{t}</button>
            ))}
          </div>

          <div className={styles.ctxFieldLabel}>Resultado *</div>
          <select className={styles.ctxSelect} value={resultado} onChange={e => setResultado(e.target.value)}>
            <option value="">— selecciona —</option>
            {RESULTADOS.map(r => <option key={r} value={r}>{RESULTADO_LABEL[r]}</option>)}
          </select>

          <div className={styles.ctxFieldLabel}>Comentario *</div>
          <textarea
            className={styles.ctxTextarea}
            rows={2}
            placeholder="Requerido..."
            value={comentario}
            onChange={e => setComentario(e.target.value)}
          />

          {error && <div className={styles.ctxError}>{error}</div>}
          <div className={styles.ctxActions}>
            <button className={styles.ctxBack} onClick={onClose}>Cancelar</button>
            <button
              className={styles.ctxSave}
              disabled={!tipo || !resultado || !comentario.trim() || saving}
              onClick={handleSave}
            >{saving ? 'Guardando...' : 'Registrar gestión'}</button>
          </div>
        </>
      )}
    </div>,
    document.body
  )
}

function BaseCard({ base, onStatusChange }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [efectivas, setEfectivas] = useState(new Set())
  const nextStatus = STATUS_NEXT[base.status] ?? null
  const { bg, color } = STATUS_COLOR[base.status] ?? {}

  const handleAdvance = async (e) => {
    e.stopPropagation()
    if (!nextStatus) return
    setSaving(true)
    try {
      await onStatusChange(base.assignmentId, nextStatus)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.baseCard}>
      <div className={styles.baseHeader} onClick={() => setOpen(o => !o)}>
        <div className={styles.baseLeft}>
          <span className={styles.baseType}>{base.type ?? base.baseType}</span>
          <span className={styles.baseStoreCount}>{base.stores?.length ?? 0} tiendas</span>
          <span className={styles.baseStatusBadge} style={{ background: bg, color }}>{base.status?.replace(/_/g, ' ')}</span>
        </div>
        <div className={styles.baseRight}>
          {nextStatus && (
            <button className={styles.btnAdvance} disabled={saving} onClick={handleAdvance}>
              {saving ? '...' : `Avanzar → ${nextStatus.replace(/_/g, ' ')}`}
            </button>
          )}
          <span className={styles.chevronSm}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <>
          {base.stores?.length > 0 && (
            <div className={styles.baseStoresTable}>
              <div className={styles.baseStoresHint}>Click derecho en una fila para tipificar</div>
              <table className={styles.storeTable}>
                <thead>
                  <tr>
                    <th>Tienda</th>
                    <th>Código</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Conexión</th>
                  </tr>
                </thead>
                <tbody>
                  {base.stores.map(s => {
                    const isEfectiva = efectivas.has(s.id)
                    return (
                      <tr
                        key={s.id}
                        className={isEfectiva ? styles.trEfectiva : ''}
                        onContextMenu={isEfectiva ? undefined : e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, store: s }) }}
                        title={isEfectiva ? 'Gestión efectiva registrada' : 'Click derecho para tipificar'}
                        style={{ cursor: isEfectiva ? 'default' : 'context-menu' }}
                      >
                        <td>{s.storeName} {isEfectiva && <span className={styles.efectivaBadge}>✓ Efectiva</span>}</td>
                        <td className={styles.tdCode}>{s.storeCode}</td>
                        <td className={styles.tdMono}>{s.phoneNumber ?? '—'}</td>
                        <td>{s.currentStatus ?? '—'}</td>
                        <td>{s.connectionPercentage != null ? `${s.connectionPercentage}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {ctxMenu && (
            <StoreContextMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              store={ctxMenu.store}
              onClose={() => setCtxMenu(null)}
              onEfectiva={storeId => setEfectivas(prev => new Set([...prev, storeId]))}
            />
          )}
        </>
      )}
    </div>
  )
}
