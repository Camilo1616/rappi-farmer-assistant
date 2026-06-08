import MultiSelectDropdown from './MultiSelectDropdown'
import styles from './AdsPalancaForm.module.css'

const ADS_TIPOS = ['Tipo de ADS', 'Upselling', 'Never Ads', 'Down Selling', 'Retención', 'Seguimiento']

const ADS_SUBTIPOS = {
  'Tipo de ADS':  ['Mínimo presupuesto', 'Con inversión', 'Con menor presupuesto', 'No reactivado'],
  'Upselling':    ['Con inversión', 'Sin coinversión', 'Sigue igual'],
  'Never Ads':    ['Con coinversión', 'Sin coinversión', 'No activo'],
  'Down Selling': ['Cambio de CPC', 'Cambia segmento de usuario', 'Cambia momento de consumo'],
  'Retención':    ['Coinversión', 'Sin coinversión', 'No se retuvo'],
  'Seguimiento':  [],
}

const ADS_FIELDS = {
  'Tipo de ADS': {
    'Mínimo presupuesto':     [{ key: 'montoCreado',      label: 'Monto creado' }],
    'Con inversión':          [{ key: 'montoCreado',      label: 'Monto creado' }],
    'Con menor presupuesto':  [{ key: 'montoCreado',      label: 'Monto creado' }],
    'No reactivado':          [],
  },
  'Upselling': {
    'Con inversión':   [{ key: 'montoFinal', label: 'Monto final' }, { key: 'montoIncremental', label: 'Monto incremental' }],
    'Sin coinversión': [{ key: 'montoFinal', label: 'Monto final' }, { key: 'montoIncremental', label: 'Monto incremental' }],
    'Sigue igual':     [{ key: 'montoFinal', label: 'Monto final' }, { key: 'montoIncremental', label: 'Monto incremental' }],
  },
  'Never Ads': {
    'Con coinversión': [{ key: 'montoCerrado', label: 'Monto cerrado' }],
    'Sin coinversión': [],
    'No activo':       [],
  },
  'Down Selling': {
    'Cambio de CPC':              [],
    'Cambia segmento de usuario': [],
    'Cambia momento de consumo':  [],
  },
  'Retención':    { 'Coinversión': [], 'Sin coinversión': [], 'No se retuvo': [] },
  'Seguimiento':  {},
}

export function adsToString(adsData) {
  if (!adsData?.tipos?.length) return ''
  const parts = ['Ads', adsData.tipos.join(', ')]
  if (adsData.subtipos?.length) parts.push(adsData.subtipos.join(', '))
  const tipo = adsData.tipos[0]
  const subtipo = adsData.subtipos?.[0]
  const fields = ADS_FIELDS[tipo]?.[subtipo] ?? []
  fields.forEach(f => {
    const val = adsData.values?.[f.key]
    if (val) parts.push(`${f.label}: $${val}`)
  })
  return parts.join(' › ')
}

export default function AdsPalancaForm({ value, onChange }) {
  const tipos    = value?.tipos    ?? []
  const subtipos = value?.subtipos ?? []
  const values   = value?.values   ?? {}
  const set = patch => onChange({ tipos, subtipos, values, ...value, ...patch })

  const primerTipo  = tipos[0] ?? null
  const subOpts     = primerTipo ? ADS_SUBTIPOS[primerTipo] : []
  const fields      = primerTipo && subtipos[0] ? (ADS_FIELDS[primerTipo]?.[subtipos[0]] ?? []) : []

  return (
    <div className={styles.wrap}>
      <p className={styles.sectionTitle}>📢 Ads — detalle</p>

      <div className={styles.field}>
        <label className={styles.label}>Tipo de acción</label>
        <MultiSelectDropdown options={ADS_TIPOS} value={tipos}
          onChange={v => set({ tipos: v, subtipos: [], values: {} })} accentColor="#A78BFA" />
      </div>

      {primerTipo && subOpts.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label}>Resultado</label>
          <MultiSelectDropdown options={subOpts} value={subtipos}
            onChange={v => set({ subtipos: v, values: {} })} accentColor="#A78BFA" />
        </div>
      )}

      {fields.length > 0 && (
        <div className={styles.montoRow}>
          {fields.map(f => (
            <div key={f.key} className={styles.montoField}>
              <label className={styles.sublabel}>{f.label}</label>
              <div className={styles.montoInput}>
                <span className={styles.currency}>$</span>
                <input className={styles.input} type="number" min="0" placeholder="0"
                  value={values[f.key] ?? ''}
                  onChange={e => set({ values: { ...values, [f.key]: e.target.value } })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
