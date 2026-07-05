import { useState } from 'react'
import { registerManagement } from '../services/dashboardService'
import styles from './ManagementModal.module.css'

const TIPOS = ['WHATSAPP','LLAMADA','SAC','SEGUIMIENTO','ACTIVACION']
const RESULTADOS = ['EFECTIVA','NO_CONTACTO','NO_RESPONDE','PROBLEMA_TECNICO','REQUIERE_SEGUIMIENTO']

export default function ManagementModal({ store, onClose, onSaved, initialTipo }) {
  const [tipo, setTipo]       = useState(initialTipo || 'WHATSAPP')
  const [result, setResult]   = useState('EFECTIVA')
  const [comments, setComments] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await registerManagement(store.id, { managementType: tipo, resultType: result, comments })
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <p className={styles.storeName}>{store.storeName}</p>
            <p className={styles.storeCode}>{store.storeCode} · Día {store.aging}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Tipo de gestión</label>
            <div className={styles.chips}>
              {TIPOS.map(t => (
                <button key={t} className={`${styles.chip} ${tipo === t ? styles.chipActive : ''}`}
                  onClick={() => setTipo(t)}>{t}</button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Resultado</label>
            <div className={styles.chips}>
              {RESULTADOS.map(r => (
                <button key={r} className={`${styles.chip} ${result === r ? styles.chipResult : ''}`}
                  onClick={() => setResult(r)}>{r.replace(/_/g,' ')}</button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Comentarios <span className={styles.optional}>(opcional)</span></label>
            <textarea className={styles.textarea} rows={3} value={comments}
              onChange={e => setComments(e.target.value)} placeholder="Detalles de la gestión..." />
          </div>

          {error && <p className={styles.error}>⚠ {error}</p>}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar gestión'}
          </button>
        </div>
      </div>
    </div>
  )
}
