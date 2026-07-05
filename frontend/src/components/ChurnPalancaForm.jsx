import MultiSelectDropdown from './MultiSelectDropdown'
import styles from './ChurnPalancaForm.module.css'

const MOTIVOS_CHURN = [
  'Calamidad doméstica','Vacaciones','Sin personal para operar','Solo opera fines de semana',
  'Cierra por temporada','Problemas internos tienda','Remodelación','Cerrado permanentemente',
  'Cierra por extorsión','Deja de trabajar Apps delivery','Fraude','Quiebra por incremento insumos',
  'Vendió el negocio','Cierra Rappi - aumento comisión','Cierra Rappi - comisión muy alta',
  'Cierra Rappi - desacuerdos términos','Cierre Rappi - exclusividad otro agregador',
  'Cierra Rappi - falta de ventas','Cierra Rappi - desacuerdo soporte',
  'Cierra Rappi - sin resolución soporte','En espera actualización CFDI','En negociación TR',
  'Fraude - tienda duplicada','Sin dispositivo para operar','Falla de dispositivo',
  'Falla de internet','Necesita modificación menú/precios','Falta de ventas bien configurada',
  'Modificación de horarios','Suspendida','Problemas de Ads','No se conecta RT',
  'Órdenes canceladas falta RTs','Problemas integraciones POS','Problemas con credenciales',
  'Se apagó por CT','Solicita cambio contractual','Cambio frecuencia pagos',
  'Problema backlog cambios','Problema de pago saldo negativo','Problemas con cancelaciones',
  'Problemas con compensaciones',
]

const MOTIVOS_HOLD = [
  'Aliado con calamidad doméstica (se prenderá)',
  'Aliado en vacaciones',
  'Aliado necesita modificación de menú/precios',
  'Aliado no cuenta con dispositivo para operar',
  'Aliado sin personal para operar',
  'Aliado solicita cambio contractual (pendiente envío documentos)',
  'Cambio de frecuencia de pagos',
  'Cierra por temporada (aliado se prenderá)',
  'En espera de actualización de CFDI',
  'En negociación de TR',
  'Problema backlog (cambios contractuales)',
  'Problema de Ads',
  'Problemas con la integración (POS/integrador)',
  'Problemas internos de la tienda (luz, gas, agua)',
  'Remodelación por CT',
]


const toggle = (arr = [], val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

export function churnToString(data) {
  if (!data) return ''
  const parts = ['Churn']
  if (data.tienda)          parts.push(`Tienda: ${data.tienda}`)
  if (data.motivos?.length) parts.push(data.motivos.join(', '))
  if (data.situacion === 'reactiva') {
    parts.push('Se reactiva')
    const holds = data.motivosHold?.filter(x => x !== '__otro__') ?? []
    if (holds.length)           parts.push(holds.join(', '))
    if (data.otro?.trim())      parts.push(`Otro: ${data.otro}`)
    if (data.fechaReactivacion) parts.push(`Fecha: ${data.fechaReactivacion}`)
  } else if (data.situacion === 'cierre') {
    parts.push('Cierre definitivo')
  }
  return parts.join(' › ')
}

export function churnIsValid(data) {
  if (!data?.tienda || !data?.motivos?.length || !data?.situacion) return false
  if (data.situacion === 'reactiva') {
    const tieneHold = data.motivosHold?.some(x => x !== '__otro__')
    const tieneOtro = data.motivosHold?.includes('__otro__') && data.otro?.trim()
    if (!tieneHold && !tieneOtro) return false
    if (!data.fechaReactivacion) return false
  }
  return true
}

export default function ChurnPalancaForm({ value = {}, onChange, store }) {
  const set = patch => onChange({ ...value, tienda: store?.brandId ?? store?.storeCode, ...patch })

  return (
    <div className={styles.wrap}>
      <p className={styles.sectionTitle}>⚠️ Churn — detalle</p>

      {/* Tienda fija — la del proceso actual */}
      <div className={styles.field}>
        <label className={styles.label}>Tienda</label>
        <div className={styles.selectedStore}>
          <span className={styles.brandId}>{store?.brandId ?? store?.storeCode}</span>
          <span className={styles.storeName}>{store?.storeName}</span>
        </div>
      </div>

      {/* Motivos Churn */}
      <div className={styles.field}>
        <label className={styles.label}>Motivos Churn</label>
        <MultiSelectDropdown options={MOTIVOS_CHURN} value={value.motivos ?? []}
          onChange={v => set({ motivos: v })} accentColor="#EF4444" />
      </div>

      {/* Situación */}
      <div className={styles.field}>
        <label className={styles.label}>Situación</label>
        <div className={styles.chips}>
          <button type="button"
            className={`${styles.chip} ${value.situacion === 'reactiva' ? styles.chipYes : ''}`}
            onClick={() => set({ situacion: 'reactiva', motivoHold: '', otro: '', fechaReactivacion: '' })}
          >Se reactiva</button>
          <button type="button"
            className={`${styles.chip} ${value.situacion === 'cierre' ? styles.chipNo : ''}`}
            onClick={() => set({ situacion: 'cierre', motivoHold: '', otro: '', fechaReactivacion: '' })}
          >Cierre definitivo</button>
        </div>
      </div>

      {/* Rama: Se reactiva */}
      {value.situacion === 'reactiva' && (
        <>
          <div className={styles.field}>
            <label className={styles.label}>Motivos ON HOLD</label>
            <MultiSelectDropdown
              options={[...MOTIVOS_HOLD, 'Otro...']}
              value={value.motivosHold?.map(x => x === '__otro__' ? 'Otro...' : x) ?? []}
              onChange={v => set({ motivosHold: v.map(x => x === 'Otro...' ? '__otro__' : x) })}
              accentColor="#EF4444" />
          </div>

          {value.motivosHold?.includes('__otro__') && (
            <div className={styles.field}>
              <label className={styles.label}>Especificar otro <span className={styles.required}>*</span></label>
              <input className={styles.input} type="text"
                placeholder="Describe el motivo..."
                value={value.otro ?? ''}
                onChange={e => set({ otro: e.target.value })} />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Fecha de reactivación <span className={styles.required}>*</span></label>
            <input className={`${styles.input} ${!value.fechaReactivacion ? styles.inputError : ''}`}
              type="date" value={value.fechaReactivacion ?? ''}
              onChange={e => set({ fechaReactivacion: e.target.value })} />
          </div>
        </>
      )}
    </div>
  )
}
