import MultiSelectDropdown from './MultiSelectDropdown'
import styles from './MarkdownPalancaForm.module.css'

const MARKDOWN_OFRECIDO = ['Upselling', 'Reactivación', 'Renegociación', 'Adquisición']
const CAMPANAS          = ['Dto. Producto', '2x1 o 3x2', 'Dto. Toda la tienda', 'Envíos gratis']
const SEGUIMIENTO_USER  = ['Pro', 'No Pro', 'Pro / No Pro']

export function markdownToString(data) {
  if (!data?.seguimientoActiva) return ''
  const parts = ['Markdown']
  if (data.seguimientoActiva === 'si') {
    parts.push('Seguimiento campaña activa')
    if (data.idCampana) parts.push(`ID: ${data.idCampana}`)
  } else {
    if (data.markdownOfrecido?.length) parts.push(data.markdownOfrecido.join(', '))
    if (data.campanaOfrecida?.length)  parts.push(data.campanaOfrecida.join(', '))
    if (data.seguimientoUser?.length)  parts.push(data.seguimientoUser.join(', '))
    if (data.acepto)                   parts.push(data.acepto === 'si' ? 'Aceptó campaña' : 'No aceptó ninguno')
  }
  return parts.join(' › ')
}

export function markdownIsValid(data) {
  if (!data?.seguimientoActiva) return false
  if (data.seguimientoActiva === 'si') return !!data.idCampana?.trim()
  return !!(data.markdownOfrecido?.length && data.campanaOfrecida?.length && data.seguimientoUser?.length && data.acepto)
}

export default function MarkdownPalancaForm({ value = {}, onChange }) {
  const set = patch => onChange({ ...value, ...patch })

  return (
    <div className={styles.wrap}>
      <p className={styles.sectionTitle}>📉 Markdown — detalle</p>

      <div className={styles.field}>
        <label className={styles.label}>¿Es seguimiento de una campaña activa?</label>
        <div className={styles.chips}>
          {['si', 'no'].map(v => (
            <button key={v} type="button"
              className={`${styles.chip} ${value.seguimientoActiva === v ? (v === 'si' ? styles.chipYes : styles.chipNo) : ''}`}
              onClick={() => set({ seguimientoActiva: v, idCampana: '', markdownOfrecido: [], campanaOfrecida: [], seguimientoUser: [], acepto: null })}
            >{v === 'si' ? 'Sí' : 'No'}</button>
          ))}
        </div>
      </div>

      {value.seguimientoActiva === 'si' && (
        <div className={styles.field}>
          <label className={styles.label}>ID de campaña <span className={styles.required}>*</span></label>
          <input
            className={`${styles.input} ${!value.idCampana?.trim() ? styles.inputError : ''}`}
            type="text" placeholder="Ej: MKD-2025-001"
            value={value.idCampana ?? ''}
            onChange={e => set({ idCampana: e.target.value })}
          />
          {!value.idCampana?.trim() && (
            <p className={styles.errorMsg}>El ID de campaña es obligatorio para continuar</p>
          )}
        </div>
      )}

      {value.seguimientoActiva === 'no' && (
        <>
          <div className={styles.field}>
            <label className={styles.label}>Markdown ofrecido al aliado</label>
            <MultiSelectDropdown options={MARKDOWN_OFRECIDO} value={value.markdownOfrecido ?? []}
              onChange={v => set({ markdownOfrecido: v })} accentColor="#F59E0B" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Campaña ofrecida</label>
            <MultiSelectDropdown options={CAMPANAS} value={value.campanaOfrecida ?? []}
              onChange={v => set({ campanaOfrecida: v })} accentColor="#F59E0B" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Seguimiento de usuario</label>
            <MultiSelectDropdown options={SEGUIMIENTO_USER} value={value.seguimientoUser ?? []}
              onChange={v => set({ seguimientoUser: v })} accentColor="#F59E0B" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>¿Se aceptó una campaña?</label>
            <div className={styles.chips}>
              {[{ v: 'si', label: 'Sí' }, { v: 'no', label: 'No aceptó ninguno' }].map(({ v, label }) => (
                <button key={v} type="button"
                  className={`${styles.chip} ${value.acepto === v ? (v === 'si' ? styles.chipYes : styles.chipNo) : ''}`}
                  onClick={() => set({ acepto: v })}
                >{label}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
