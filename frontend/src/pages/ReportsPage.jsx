import { useState, useEffect } from 'react'
import { getDailyReport } from '../services/reportService'
import HistorialGestionTab from '../components/HistorialGestionTab'
import styles from './ReportsPage.module.css'

const META_EFECTIVAS    = 15
const META_NC_MIN       = 25
const META_NC_MAX       = 40

const TIPO_LABEL  = { WHATSAPP:'WhatsApp', LLAMADA:'Llamada', SAC:'SAC', SEGUIMIENTO:'Seguimiento', ACTIVACION:'Activación' }
const RESULT_LABEL = { EFECTIVA:'Efectiva', NO_CONTACTO:'No contacto', NO_RESPONDE:'No responde', PROBLEMA_TECNICO:'Problema técnico', REQUIERE_SEGUIMIENTO:'Req. seguimiento' }
const TIPO_COLOR  = { WHATSAPP:'#22C55E', LLAMADA:'#3B82F6', SAC:'#F59E0B', SEGUIMIENTO:'#8B5CF6', ACTIVACION:'#EC4899' }
const RESULT_COLOR = { EFECTIVA:'#22C55E', NO_CONTACTO:'#6B7280', NO_RESPONDE:'#F59E0B', PROBLEMA_TECNICO:'#EF4444', REQUIERE_SEGUIMIENTO:'#8B5CF6' }

function StatCard({ label, value, sub, color, progress, progressMax, progressOk }) {
  const pct = progressMax ? Math.min(100, Math.round((value / progressMax) * 100)) : null
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color: color || '#F0F2F8' }}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
      {pct !== null && (
        <div className={styles.progressWrap}>
          <div className={styles.progressBg}>
            <div className={styles.progressFill}
              style={{ width: `${pct}%`, background: progressOk ? '#22C55E' : color || '#3B82F6' }} />
          </div>
          <span className={styles.progressPct}>{pct}%</span>
        </div>
      )}
    </div>
  )
}

const todayStr = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ReportsPage() {
  const [daily,        setDaily]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('daily')
  const [typeFilter,   setTypeFilter]   = useState(null)
  const [resultFilter, setResultFilter] = useState(null)
  const [dateFrom,     setDateFrom]     = useState(todayStr())
  const [dateTo,       setDateTo]       = useState(todayStr())

  const load = async (from) => {
    setLoading(true)
    try {
      const d = await getDailyReport(from)
      setDaily(d.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load(dateFrom) }, [])  // eslint-disable-line

  const handleDateFromChange = (e) => {
    const from = e.target.value
    setDateFrom(from)
    setTypeFilter(null)
    setResultFilter(null)
    if (from > dateTo) setDateTo(from)
    load(from)
  }

  const handleDateToChange = (e) => {
    const to = e.target.value
    setDateTo(to)
    load(dateFrom)
  }

  const rows = daily?.rows ?? []
  const filteredRows = rows.filter(r =>
    (!typeFilter   || r.managementType === typeFilter) &&
    (!resultFilter || r.resultType     === resultFilter)
  )

  const efPct  = daily ? Math.min(100, Math.round((daily.efectivas / META_EFECTIVAS) * 100)) : 0
  const ncOk   = daily ? daily.noContacto >= META_NC_MIN && daily.noContacto <= META_NC_MAX : false

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reportes</h1>
          <p className={styles.sub}>Resumen de actividad de gestión</p>
        </div>
        <button className={styles.btnRefresh} onClick={() => load(dateFrom)}>🔄 Actualizar</button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'daily' ? styles.tabActive : ''}`}
          onClick={() => setTab('daily')}>📋 Gestiones del día</button>
        <button className={`${styles.tab} ${tab === 'historial' ? styles.tabActive : ''}`}
          onClick={() => setTab('historial')}>📅 Historial de gestión</button>
      </div>

      {loading && tab === 'daily' && <div className={styles.loading}>Cargando...</div>}

      {/* ── Gestiones del día ── */}
      {!loading && tab === 'daily' && daily && (
        <div className={styles.section}>

          {/* Filtro de rango de fechas */}
          <div className={styles.dateFilterRow}>
            <label className={styles.dateFilterLabel}>📅 Desde:</label>
            <input
              type="date"
              className={styles.dateInput}
              value={dateFrom}
              max={todayStr()}
              onChange={handleDateFromChange}
            />
            <label className={styles.dateFilterLabel}>Hasta:</label>
            <input
              type="date"
              className={styles.dateInput}
              value={dateTo}
              min={dateFrom}
              max={todayStr()}
              onChange={handleDateToChange}
            />
            {(dateFrom !== todayStr() || dateTo !== todayStr()) && (
              <button className={styles.btnToday} onClick={() => {
                setDateFrom(todayStr()); setDateTo(todayStr())
                setTypeFilter(null); setResultFilter(null)
                load(todayStr())
              }}>
                Ir a hoy
              </button>
            )}
          </div>

          {/* Metas */}
          <div className={styles.metaRow}>
            <div className={`${styles.metaCard} ${daily.efectivas >= META_EFECTIVAS ? styles.metaOk : styles.metaPending}`}>
              <span className={styles.metaIcon}>{daily.efectivas >= META_EFECTIVAS ? '✅' : '🎯'}</span>
              <div>
                <div className={styles.metaLabel}>Efectivas</div>
                <div className={styles.metaVal}>{daily.efectivas} / {META_EFECTIVAS}</div>
              </div>
              <div className={styles.metaBar}>
                <div className={styles.metaBarFill} style={{ width: `${efPct}%` }} />
              </div>
            </div>
            <div className={`${styles.metaCard} ${ncOk ? styles.metaOk : daily.noContacto > META_NC_MAX ? styles.metaWarn : styles.metaPending}`}>
              <span className={styles.metaIcon}>{ncOk ? '✅' : daily.noContacto > META_NC_MAX ? '⚠️' : '🎯'}</span>
              <div>
                <div className={styles.metaLabel}>No contacto</div>
                <div className={styles.metaVal}>{daily.noContacto} / {META_NC_MIN}–{META_NC_MAX}</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className={styles.statsGrid}>
            <StatCard label="Total gestiones" value={daily.total} color="#F0F2F8" />
            <StatCard label="Efectivas"  value={daily.efectivas}  color="#22C55E" progress progressMax={META_EFECTIVAS} progressOk={daily.efectivas >= META_EFECTIVAS} />
            <StatCard label="No contacto" value={daily.noContacto} color="#6B7280" sub={`Meta: ${META_NC_MIN}–${META_NC_MAX}`} />
            <StatCard label="WhatsApp"    value={daily.whatsapp}   color="#22C55E" />
            <StatCard label="Llamadas"    value={daily.llamadas}   color="#3B82F6" />
            <StatCard label="SAC"         value={daily.sac}        color="#F59E0B" />
            <StatCard label="Seguimiento" value={daily.seguimiento} color="#8B5CF6" />
            <StatCard label="Activación"  value={daily.activacion} color="#EC4899" />
          </div>

          {/* Filtros */}
          <div className={styles.filters}>
            <span className={styles.filterLabel}>Tipo:</span>
            {['WHATSAPP','LLAMADA','SAC','SEGUIMIENTO','ACTIVACION'].map(t => (
              <button key={t}
                className={`${styles.chip} ${typeFilter === t ? styles.chipActive : ''}`}
                style={typeFilter === t ? { borderColor: TIPO_COLOR[t], color: TIPO_COLOR[t] } : {}}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}>
                {TIPO_LABEL[t]}
              </button>
            ))}
            <span className={styles.filterLabel} style={{ marginLeft: 12 }}>Resultado:</span>
            {['EFECTIVA','NO_CONTACTO'].map(r => (
              <button key={r}
                className={`${styles.chip} ${resultFilter === r ? styles.chipActive : ''}`}
                style={resultFilter === r ? { borderColor: RESULT_COLOR[r], color: RESULT_COLOR[r] } : {}}
                onClick={() => setResultFilter(resultFilter === r ? null : r)}>
                {RESULT_LABEL[r]}
              </button>
            ))}
          </div>

          {/* Tabla */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tienda</th>
                  <th>Tipo</th>
                  <th>Resultado</th>
                  <th>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr><td colSpan={5} className={styles.empty}>Sin gestiones registradas hoy</td></tr>
                )}
                {filteredRows.map(r => (
                  <tr key={r.id}>
                    <td className={styles.tdHora}>{r.hora}</td>
                    <td>
                      <span className={styles.storeName}>{r.storeName}</span>
                      <span className={styles.storeCode}>{r.storeCode}</span>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ background: `${TIPO_COLOR[r.managementType]}22`, color: TIPO_COLOR[r.managementType] }}>
                        {TIPO_LABEL[r.managementType] || r.managementType}
                      </span>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ background: `${RESULT_COLOR[r.resultType]}22`, color: RESULT_COLOR[r.resultType] }}>
                        {RESULT_LABEL[r.resultType] || r.resultType}
                      </span>
                    </td>
                    <td className={styles.tdComment}>{r.comments || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Historial de gestión ── */}
      {tab === 'historial' && <HistorialGestionTab />}
    </div>
  )
}
