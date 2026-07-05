import MultiSelectDropdown from './MultiSelectDropdown'
import styles from './TopRestaurantesPalancaForm.module.css'

const OPTS = {
  cancelaciones: ['Stock out', 'Horarios', 'CPBR', 'CBPI'],
  dr:            ['Producto faltante', 'Producto en mal estado', 'Producto diferente', 'Capacitación y plan de acción'],
  tiempos:       ['Cooking time', 'Códigos de entrega', 'RTWT'],
  conectividad:  ['Validación de dispositivo', 'Extensión de Chrome', 'Capacitación y plan de acción', 'Revisión - corrección de horarios'],
}

const toggle = (arr = [], val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

export function topToString(data) {
  if (!data) return ''
  const parts = ['Top Restaurantes']
  if (data.cancelaciones === 'si' && data.tipoCancelacion?.length) parts.push(`Cancel.: ${data.tipoCancelacion.join(', ')}`)
  if (data.dr           === 'si' && data.tipoDr?.length)          parts.push(`DR: ${data.tipoDr.join(', ')}`)
  if (data.tiempos      === 'si' && data.tipoTiempo?.length)      parts.push(`Tiempo: ${data.tipoTiempo.join(', ')}`)
  if (data.conectividad === 'si' && data.tipoConect?.length)      parts.push(`Conect.: ${data.tipoConect.join(', ')}`)
  return parts.join(' › ')
}

export function topIsValid(data) {
  if (!data) return false
  const alguna = ['cancelaciones','dr','tiempos','conectividad'].some(s => data[s])
  if (!alguna) return false
  if (data.cancelaciones === 'si' && !data.tipoCancelacion?.length) return false
  if (data.dr            === 'si' && !data.tipoDr?.length)          return false
  if (data.tiempos       === 'si' && !data.tipoTiempo?.length)      return false
  if (data.conectividad  === 'si' && !data.tipoConect?.length)      return false
  return true
}

function Section({ label, siNoKey, subKey, opts, value, onChange }) {
  const set = patch => onChange({ ...value, ...patch })
  const active = value[siNoKey]

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>{label}</span>
        <div className={styles.siNo}>
          <button type="button"
            className={`${styles.siNoBtn} ${active === 'si' ? styles.btnSi : ''}`}
            onClick={() => set({ [siNoKey]: 'si', [subKey]: [] })}>Sí</button>
          <button type="button"
            className={`${styles.siNoBtn} ${active === 'no' ? styles.btnNo : ''}`}
            onClick={() => set({ [siNoKey]: 'no', [subKey]: [] })}>No</button>
        </div>
      </div>
      {active === 'si' && (
        <MultiSelectDropdown options={opts} value={value[subKey] ?? []}
          onChange={v => set({ [subKey]: v })} accentColor="#EAB308" />
      )}
    </div>
  )
}

export default function TopRestaurantesPalancaForm({ value = {}, onChange }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.sectionTitle}>⭐ Top Restaurantes — detalle</p>

      <Section label="Cancelaciones"   siNoKey="cancelaciones" subKey="tipoCancelacion" opts={OPTS.cancelaciones} value={value} onChange={onChange} />
      <Section label="DR"              siNoKey="dr"            subKey="tipoDr"          opts={OPTS.dr}            value={value} onChange={onChange} />
      <Section label="Tiempos"         siNoKey="tiempos"       subKey="tipoTiempo"      opts={OPTS.tiempos}       value={value} onChange={onChange} />
      <Section label="Conectividad"    siNoKey="conectividad"  subKey="tipoConect"      opts={OPTS.conectividad}  value={value} onChange={onChange} />
    </div>
  )
}
