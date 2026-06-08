import MultiSelectDropdown from './MultiSelectDropdown'
import styles from './SprintsPalancaForm.module.css'

const SPRINTS = [
  'Solicitud de integración',
  'Tubo',
  'Handoff con Hunter / Inside Sales',
  'CO - Solicitud de RUT',
]

const toggle = (arr = [], val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

export function sprintsToString(data) {
  if (!data?.ofrecidos?.length) return ''
  const parts = [`Sprints › ${data.ofrecidos.join(', ')}`]
  if (data.acepto === 'si' && data.aceptados?.length) parts.push(`Aceptó: ${data.aceptados.join(', ')}`)
  if (data.acepto === 'no') parts.push('No aceptó')
  return parts.join(' › ')
}

export function sprintsIsValid(data) {
  if (!data?.ofrecidos?.length || !data?.acepto) return false
  if (data.acepto === 'si' && !data.aceptados?.length) return false
  return true
}

export default function SprintsPalancaForm({ value = {}, onChange }) {
  const set = patch => onChange({ ...value, ...patch })

  return (
    <div className={styles.wrap}>
      <p className={styles.sectionTitle}>🚀 Sprints — detalle</p>

      <div className={styles.field}>
        <label className={styles.label}>Sprints ofrecidos</label>
        <MultiSelectDropdown options={SPRINTS} value={value.ofrecidos ?? []}
          onChange={v => set({ ofrecidos: v, acepto: null, aceptados: [] })} accentColor="#10B981" />
      </div>

      {value.ofrecidos?.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label}>¿Aceptó?</label>
          <div className={styles.siNo}>
            <button type="button" className={`${styles.siNoBtn} ${value.acepto === 'si' ? styles.btnSi : ''}`}
              onClick={() => set({ acepto: 'si', aceptados: [] })}>Sí</button>
            <button type="button" className={`${styles.siNoBtn} ${value.acepto === 'no' ? styles.btnNo : ''}`}
              onClick={() => set({ acepto: 'no', aceptados: [] })}>No</button>
          </div>
        </div>
      )}

      {value.acepto === 'si' && (
        <div className={styles.field}>
          <label className={styles.label}>Sprints aceptados</label>
          <MultiSelectDropdown options={SPRINTS} value={value.aceptados ?? []}
            onChange={v => set({ aceptados: v })} accentColor="#10B981" />
        </div>
      )}
    </div>
  )
}
