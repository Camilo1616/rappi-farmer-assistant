import { useState, useEffect } from 'react'
import { getDailyReport, getPortfolioReport } from '../services/reportService'
import styles from './ReportsPage.module.css'

const META_EFECTIVAS    = 15
const META_NC_MIN       = 25
const META_NC_MAX       = 40

const TIPO_LABEL  = { WHATSAPP:'WhatsApp', LLAMADA:'Llamada', SAC:'SAC', SEGUIMIENTO:'Seguimiento', ACTIVACION:'Activación' }
const RESULT_LABEL = { EFECTIVA:'Efectiva', NO_CONTACTO:'No contacto', NO_RESPONDE:'No responde', PROBLEMA_TECNICO:'Problema técnico', REQUIERE_SEGUIMIENTO:'Req. seguimiento' }
const TIPO_COLOR  = { WHATSAPP:'#22C55E', LLAMADA:'#3B82F6', SAC:'#F59E0B', SEGUIMIENTO:'#8B5CF6', ACTIVACION:'#EC4899' }
const RESULT_COLOR = { EFECTIVA:'#22C55E', NO_CONTACTO:'#6B7280', NO_RESPONDE:'#F59E0B', PROBLEMA_TECNICO:'#EF4444', REQUIERE_SEGUIMIENTO:'#8B5CF6' }

const PORTFOLIO_SECTIONS = [
  { key:'onboarding',    label:'Onboarding',    color:'#3B82F6', icon:'🚀', storesKey:'storesOnboarding' },
  { key:'aliados',       label:'Aliados AVA',   color:'#F97316', icon:'🔗', storesKey:'storesAliados' },
  { key:'churn',         label:'Riesgo Churn',  color:'#EF4444', icon:'⚠️', storesKey:'storesChurn' },
  { key:'ava',           label:'AVA Bajando',   color:'#F59E0B', icon:'📉', storesKey:'storesAva' },
  { key:'healthy',       label:'Saludables',    color:'#22C55E', icon:'✅', storesKey:'storesHealthy' },
  { key:'selfOnboarding', label:'Self-Onboarding', color:'#8B5CF6', icon:'🛒', storesKey:'storesSelfOnboarding' },
  { key:'sinClasificar',  label:'Sin clasificar',  color:'#6B7280', icon:'❓', storesKey:'storesSinClasificar' },
]

function StoresModal({ section, stores, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = (stores ?? []).filter(s =>
    !search || s.storeName?.toLowerCase().includes(search.toLowerCase()) || s.storeCode?.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span style={{ color: section.color }}>{section.icon} {section.label}</span>
          <span className={styles.modalCount}>{stores?.length ?? 0} tiendas</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalSearch}>
          <span>🔍</span>
          <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className={styles.modalSearchInput} autoFocus />
          {search && <button className={styles.clearBtn} onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className={styles.modalList}>
          {filtered.length === 0 && <div className={styles.empty}>Sin resultados</div>}
          {filtered.map(s => (
            <div key={s.id} className={styles.modalRow}>
              <div className={styles.modalStoreInfo}>
                <span className={styles.storeName}>{s.storeName}</span>
                <span className={styles.storeCode}>{s.storeCode}</span>
              </div>
              <div className={styles.modalStoreMeta}>
                {s.phoneNumber
                  ? <span className={styles.phoneOk}>📱 {s.phoneNumber}</span>
                  : <span className={styles.phoneNo}>Sin teléfono</span>}
                {s.currentStatus && <span className={styles.statusTag}>{s.currentStatus}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
  const [portfolio,    setPortfolio]    = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('daily')
  const [typeFilter,   setTypeFilter]   = useState(null)
  const [resultFilter, setResultFilter] = useState(null)
  const [modalSection, setModalSection] = useState(null)
  const [dateFrom,     setDateFrom]     = useState(todayStr())
  const [dateTo,       setDateTo]       = useState(todayStr())

  const load = async (from, to) => {
    setLoading(true)
    try {
      const [d, p] = await Promise.all([getDailyReport(from), getPortfolioReport()])
      setDaily(d.data)
      setPortfolio(p.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load(dateFrom, dateTo) }, [])  // eslint-disable-line

  const handleDateFromChange = (e) => {
    const from = e.target.value
    setDateFrom(from)
    setTypeFilter(null)
    setResultFilter(null)
    if (from > dateTo) setDateTo(from)
    load(from, dateTo)
  }

  const handleDateToChange = (e) => {
    const to = e.target.value
    setDateTo(to)
    load(dateFrom, to)
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
          <p className={styles.sub}>Resumen de actividad y estado de cartera</p>
        </div>
        <button className={styles.btnRefresh} onClick={() => load(dateFrom, dateTo)}>🔄 Actualizar</button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'daily' ? styles.tabActive : ''}`}
          onClick={() => setTab('daily')}>📋 Gestiones del día</button>
        <button className={`${styles.tab} ${tab === 'portfolio' ? styles.tabActive : ''}`}
          onClick={() => setTab('portfolio')}>🏪 Estado de cartera</button>
      </div>

      {loading && <div className={styles.loading}>Cargando...</div>}

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
                load(todayStr(), todayStr())
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

      {/* ── Estado de cartera ── */}
      {!loading && tab === 'portfolio' && portfolio && (
        <div className={styles.section}>
          <div className={styles.portfolioTotal}>
            <span className={styles.portfolioTotalNum}>{portfolio.total}</span>
            <span className={styles.portfolioTotalLabel}>tiendas activas</span>
          </div>

          <div className={styles.portfolioGrid}>
            {PORTFOLIO_SECTIONS.map(sec => {
              const val = portfolio[sec.key] ?? 0
              const pct = portfolio.total > 0 ? Math.round((val / portfolio.total) * 100) : 0
              const clickable = sec.storesKey && (portfolio[sec.storesKey]?.length ?? 0) > 0
              return (
                <div key={sec.key}
                  className={`${styles.portfolioCard} ${clickable ? styles.portfolioCardClickable : ''}`}
                  onClick={() => clickable && setModalSection(sec)}>
                  <div className={styles.portfolioIcon}>{sec.icon}</div>
                  <div className={styles.portfolioLabel}>{sec.label}</div>
                  <div className={styles.portfolioVal} style={{ color: sec.color }}>{val}</div>
                  <div className={styles.portfolioBar}>
                    <div className={styles.portfolioBarFill} style={{ width: `${pct}%`, background: sec.color }} />
                  </div>
                  <div className={styles.portfolioPct}>{pct}%</div>
                  {clickable && <div className={styles.portfolioHint}>Ver tiendas →</div>}
                </div>
              )
            })}
          </div>

          {modalSection && (
            <StoresModal
              section={modalSection}
              stores={portfolio[modalSection.storesKey]}
              onClose={() => setModalSection(null)}
            />
          )}

          <div className={styles.alertsRow}>
            <div className={styles.alertCard} style={{ borderColor: '#EF444433' }}>
              <span style={{ color: '#EF4444', fontSize: '1.1rem' }}>📵</span>
              <div>
                <div className={styles.alertVal}>{portfolio.sinTelefono}</div>
                <div className={styles.alertLabel}>Sin teléfono</div>
              </div>
            </div>
            <div className={styles.alertCard} style={{ borderColor: '#F59E0B33' }}>
              <span style={{ color: '#F59E0B', fontSize: '1.1rem' }}>📉</span>
              <div>
                <div className={styles.alertVal}>{portfolio.sinVentas}</div>
                <div className={styles.alertLabel}>Sin ventas</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
