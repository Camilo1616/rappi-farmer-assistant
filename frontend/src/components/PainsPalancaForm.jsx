import MultiSelectDropdown from './MultiSelectDropdown'
import styles from './PainsPalancaForm.module.css'

const ACCIONES = [
  'Demoras a procesos cambios contractuales',
  'Restablecimiento de credenciales de Rappi Aliados',
  'Pagos',
  'Modificaciones de menú',
  'Órdenes en vivo',
  'Solicitudes de cambios de modalidad (FS a MP / MP a SP)',
  'Ayuda con la operación (código de entrega, modificar demanda, etc.)',
  'Disminución de las ventas',
  'Suspensión de tienda',
  'Publicación de tienda',
  'Modificación de dirección, nombre y logo',
  'Sesión fotográfica',
  'Credenciales Rappi Aliados',
  'Credenciales Portal Partners',
  'Actualización de polígonos',
]

const toggle = (arr = [], val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

export function painsToString(data) {
  if (!data?.acciones?.length) return ''
  return `Pains › ${data.acciones.join(', ')}`
}

export function painsIsValid(data) {
  return data?.acciones?.length > 0
}

export default function PainsPalancaForm({ value = {}, onChange }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.sectionTitle}>🔧 Pains — detalle</p>
      <div className={styles.field}>
        <label className={styles.label}>Acciones a realizar</label>
        <MultiSelectDropdown options={ACCIONES} value={value.acciones ?? []}
          onChange={v => onChange({ ...value, acciones: v })} accentColor="#EC4899" />
      </div>
    </div>
  )
}
