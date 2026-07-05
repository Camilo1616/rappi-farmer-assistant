import MultiSelectDropdown from './MultiSelectDropdown'
import styles from './CatalogoPalancaForm.module.css'

const AJUSTES = [
  'Disponibilidad del producto', 'Arreglo de topping', 'Generación de combos',
  'Igualdad en precios', 'Catálogo PDF', 'Eliminar Missing products',
  'Creación de productos', 'Purchasing experience', 'Fotos', 'Catálogo 100%',
]

const AJUSTES_REALIZAR = [...AJUSTES, 'No aceptó ninguno']

export function catalogoToString(data) {
  if (!data) return ''
  const parts = ['Catálogo']
  if (data.ofrecidos?.length)  parts.push(`Ofrecido: ${data.ofrecidos.join(', ')}`)
  if (data.aRealizar?.length)  parts.push(`A realizar: ${data.aRealizar.join(', ')}`)
  return parts.join(' › ')
}

export function catalogoIsValid(data) {
  return data?.ofrecidos?.length > 0 && data?.aRealizar?.length > 0
}

function toggleRealizar(current = [], val) {
  if (val === 'No aceptó ninguno') return current.includes(val) ? [] : ['No aceptó ninguno']
  const without = current.filter(x => x !== 'No aceptó ninguno')
  return without.includes(val) ? without.filter(x => x !== val) : [...without, val]
}

export default function CatalogoPalancaForm({ value = {}, onChange }) {
  const set = patch => onChange({ ...value, ...patch })

  return (
    <div className={styles.wrap}>
      <p className={styles.sectionTitle}>📋 Catálogo — detalle</p>

      <div className={styles.field}>
        <label className={styles.label}>Ajustes ofrecidos al aliado</label>
        <MultiSelectDropdown options={AJUSTES} value={value.ofrecidos ?? []}
          onChange={v => set({ ofrecidos: v })} accentColor="#6366F1" />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Ajustes a realizar</label>
        <MultiSelectDropdown
          options={AJUSTES_REALIZAR}
          value={value.aRealizar ?? []}
          onChange={v => {
            const prev = value.aRealizar ?? []
            const added = v.find(x => !prev.includes(x))
            if (added) {
              set({ aRealizar: toggleRealizar(prev, added) })
            } else {
              set({ aRealizar: v })
            }
          }}
          accentColor="#6366F1" />
      </div>
    </div>
  )
}
