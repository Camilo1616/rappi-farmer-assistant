import { useState, useEffect } from 'react'
import api from '../services/api'
import AiAssistant from '../components/AiAssistant'
import StoreSection from '../components/StoreSection'
import MetricCard from '../components/MetricCard'
import { useDashboard } from '../context/DashboardContext'
import { RefreshBanner } from '../layouts/AppLayout'
import styles from '../layouts/AppLayout.module.css'

const SECTIONS = [
  { key: 'onboardingCritical', title: 'Aliados 1-7',    short: 'Aliados 1-7',  icon: '🚨', color: '#EF4444' },
  { key: 'aliados',            title: 'Tiendas 8-14',   short: 'Tiendas 8-14', icon: '🔗', color: '#F97316' },
  { key: 'churnRisk',          title: 'Riesgo Churn',   short: 'Churn',        icon: '⚠️', color: '#EF4444' },
  { key: 'ava',                title: 'AVA Bajando',    short: 'AVA',          icon: '📉', color: '#F59E0B' },
  { key: 'healthy',            title: 'Saludables',     short: 'Saludables',   icon: '✅', color: '#22C55E' },
  { key: 'selfOnboarding',     title: 'Self-Onboarding',short: 'Self',         icon: '🛒', color: '#8B5CF6' },
  { key: 'insideSales',        title: 'Gestión IS',     short: 'Gestión IS',   icon: '📋', color: '#0EA5E9' },
]

const CHURN_FILTERS = ['Todos', 'Churn', 'Prevention W1', 'Prevention W2', 'Prevention W3']
const AVA_FILTERS   = ['Todos', 'Retención', 'Bajando']

const SEGMENT_TO_TAB = {
  'Onboarding': 'onboardingCritical',
  'Churn':      'churnRisk',
  'AVA':        'ava',
  'Saludable':  'healthy',
}

/** Vista principal de /dashboard — resumen de cartera con tabs por segmento. */
export default function DashboardHomePage() {
  const {
    firstName, dash, dashLoading, loadDash,
    totalStores, onboardCount, churnCount, healthyCount,
    sidebarSegment, openFollowUp, goTo,
  } = useDashboard()

  const [activeTab, setActiveTab] = useState(SECTIONS[0].key)

  useEffect(() => {
    const tab = SEGMENT_TO_TAB[sidebarSegment]
    if (tab) setActiveTab(tab)
  }, [sidebarSegment])

  const [churnFilter, setChurnFilter] = useState('Todos')
  const [avaFilter, setAvaFilter]     = useState('Todos')
  const [search, setSearch]           = useState('')
  const [hoSyncing, setHoSyncing]         = useState(false)
  const [hoResult, setHoResult]           = useState(null)
  const [hoOpen, setHoOpen]               = useState(false)
  const [hoData, setHoData]               = useState([])
  const [hoMeetConectado, setHoMeetConectado] = useState(false)

  const openConsolidadoHO = async () => {
    setHoSyncing(true)
    setHoResult(null)
    try {
      const { data } = await api.get('/calendar/handoff-summary')
      setHoData(data.handoffs ?? [])
      setHoMeetConectado(data.meetConectado ?? false)
      setHoOpen(true)
    } catch {
      setHoResult({ ok: false, msg: 'Error al cargar consolidado HO' })
    } finally {
      setHoSyncing(false)
    }
  }

  const activeSection = SECTIONS.find(s => s.key === activeTab)
  const rawStores     = dash?.[activeTab] ?? []

  const churnBase = activeTab === 'churnRisk'
    ? rawStores.filter(s => s.diasSinLogin == null || s.diasSinLogin <= 90)
    : rawStores

  const filtered = activeTab === 'churnRisk' && churnFilter !== 'Todos'
    ? churnBase.filter(s => s.churnLabel?.trim().toLowerCase() === churnFilter.trim().toLowerCase())
    : activeTab === 'ava' && avaFilter !== 'Todos'
    ? churnBase.filter(s => s.avaLabel?.trim() === avaFilter)
    : churnBase

  const stores = search.trim()
    ? filtered.filter(s => {
        const q = search.toLowerCase()
        return s.storeName?.toLowerCase().includes(q) ||
               s.storeCode?.toLowerCase().includes(q) ||
               s.brandId?.toLowerCase().includes(q)
      })
    : filtered

  return (
    <>
      {dash?.needsRefresh && (
        <RefreshBanner lastImportDate={dash?.lastImportDate} onRefresh={() => goTo('excel')} />
      )}
      <div className={styles.welcome}>
        <p className={styles.welcomeText}>Hola, <span>{firstName}</span> 👋</p>
        <p className={styles.welcomeSub}>Resumen de tu cartera para hoy</p>
      </div>

      <div className={styles.metrics}>
        <MetricCard label="Total tiendas"     value={totalStores}  color="blue"   icon="🏪" trend="total" />
        <MetricCard label="Onboarding activo" value={onboardCount} color="orange" icon="🚀" trend="críticos" />
        <MetricCard label="Riesgo churn"      value={churnCount}   color="red"    icon="⚠️" trend="urgente" />
        <MetricCard label="Saludables"        value={healthyCount} color="green"  icon="✅" trend="meta" />
      </div>

      <AiAssistant />

      <div className={styles.tabGrid}>
        {SECTIONS.map(s => {
          const count = dash?.[s.key]?.length ?? 0
          const isActive = activeTab === s.key
          return (
            <button
              key={s.key}
              className={`${styles.tabCard} ${isActive ? styles.tabCardActive : ''}`}
              style={isActive ? { borderColor: s.color + '88', background: s.color + '12' } : {}}
              title={s.title}
              onClick={() => { setActiveTab(s.key); setChurnFilter('Todos'); setAvaFilter('Todos') }}
            >
              <span className={styles.tabCardIcon}>{s.icon}</span>
              <span className={styles.tabCardLabel} style={isActive ? { color: s.color } : {}}>
                {s.short}
              </span>
              {count > 0 && (
                <span className={styles.tabCardCount}
                  style={isActive ? { background: s.color + '30', color: s.color } : {}}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'churnRisk' && (
        <div className={styles.filterBar}>
          {CHURN_FILTERS.map(f => (
            <button key={f}
              className={`${styles.filterChip} ${churnFilter === f ? styles.filterChipActive : ''}`}
              onClick={() => setChurnFilter(f)}
            >
              {f}
              <span className={styles.filterCount}>
                {f === 'Todos'
                  ? churnBase.length
                  : churnBase.filter(s => s.churnLabel?.trim().toLowerCase() === f.trim().toLowerCase()).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'ava' && (
        <div className={styles.filterBar}>
          {AVA_FILTERS.map(f => (
            <button key={f}
              className={`${styles.filterChip} ${avaFilter === f ? styles.filterChipActive : ''}`}
              onClick={() => setAvaFilter(f)}
            >
              {f}
              <span className={styles.filterCount}>
                {f === 'Todos'
                  ? rawStores.length
                  : rawStores.filter(s => s.avaLabel?.trim() === f).length}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.tableToolbar}>
        <div className={styles.toolbarLeft}>
          {activeTab === 'onboardingCritical' && (
            <>
              <button className={styles.btnHoReport} onClick={openConsolidadoHO} disabled={hoSyncing}>
                {hoSyncing ? '⏳ Cargando...' : '🤝 Consolidado HO'}
              </button>
              {hoResult && (
                <span className={hoResult.ok ? styles.hoResultOk : styles.hoResultErr}>
                  {hoResult.msg}
                </span>
              )}
            </>
          )}
        </div>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar tienda o código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {dashLoading ? (
        <div className={styles.loadingWrapper}>
          <div className={styles.loadingSpinner} /> Cargando cartera...
        </div>
      ) : (
        <StoreSection
          key={activeTab + churnFilter + avaFilter + search}
          title={activeSection.title}
          icon={activeSection.icon}
          color={activeSection.color}
          stores={stores}
          onRefresh={loadDash}
          hideHeader
          isChurn={activeTab === 'churnRisk'}
          isAva={activeTab === 'ava' || activeTab === 'healthy'}
          onFollowUp={s => openFollowUp(s)}
        />
      )}

      {hoOpen && (
        <div className={styles.hoOverlay} onClick={() => setHoOpen(false)}>
          <div className={styles.hoModal} onClick={e => e.stopPropagation()}>
            <div className={styles.hoModalHeader}>
              <span>🤝 Consolidado HO — últimos 14 días / próximos 7</span>
              <button className={styles.hoModalClose} onClick={() => setHoOpen(false)}>✕</button>
            </div>
            {!hoMeetConectado ? (
              <div className={styles.hoBlocked}>
                <div className={styles.hoBlockedIcon}>🔒</div>
                <p className={styles.hoBlockedTitle}>Acceso restringido</p>
                <p className={styles.hoBlockedMsg}>
                  Para ver el Consolidado HO con datos reales de duración y participantes,
                  <strong> Jesus David Ruiz</strong> debe iniciar sesión en el sistema
                  y conectar su Google Calendar desde <em>Mi Perfil</em>.
                </p>
                <p className={styles.hoBlockedSub}>
                  Es el organizador de todos los HOs — sus credenciales son necesarias
                  para consultar la API de Google Meet.
                </p>
                <button className={styles.hoBlockedClose} onClick={() => setHoOpen(false)}>
                  Entendido
                </button>
              </div>
            ) : hoData.length === 0 ? (
              <p className={styles.hoEmpty}>No hay handoffs en esta ventana de tiempo.<br/>Asegúrate de tener el Google Calendar sincronizado.</p>
            ) : (
              <>
              <table className={styles.hoTable}>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Brand ID</th>
                    <th>Tienda</th>
                    <th>Farmer</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Duración real</th>
                    <th>Aliado conectado</th>
                    <th>Participantes Meet</th>
                    <th>Invitados calendar</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {hoData.map((h, i) => (
                    <tr key={i} className={h.exitoso ? styles.hoRowOk : styles.hoRowFail}>
                      <td>{h.exitoso ? '✅ Exitoso' : '❌ No exitoso'}</td>
                      <td>{h.brandId}</td>
                      <td>{h.storeName}</td>
                      <td>{h.farmerEmail}</td>
                      <td>{h.eventDate}</td>
                      <td>{h.eventTime ?? '—'}</td>
                      <td>
                        {h.duracionRealMin != null
                          ? <span className={h.duracionOk ? styles.hoTagOk : styles.hoTagFail}>
                              {h.duracionRealMin} min
                            </span>
                          : <span className={styles.hoTagGray}>{h.duracionProgramadaMin} min*</span>
                        }
                      </td>
                      <td>
                        {h.alinadoConectado == null ? <span className={styles.hoTagGray}>—</span>
                          : h.alinadoConectado
                            ? <span className={styles.hoTagOk}>✓ Sí</span>
                            : <span className={styles.hoTagFail}>✗ No</span>
                        }
                      </td>
                      <td className={styles.hoEmails}>
                        {h.participantes?.length
                          ? h.participantes.map((p, j) => (
                              <span key={j} className={p.esExterno ? styles.hoEmailExterno : styles.hoEmailInterno}>
                                {p.displayName || 'Anónimo'}
                                {p.tiempoEnReunionMin > 0 && <span className={styles.hoEmailTime}> ({p.tiempoEnReunionMin}m)</span>}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td className={styles.hoEmails}>
                        {h.attendeeEmails?.length
                          ? h.attendeeEmails.map((e, j) => (
                              <span key={j} className={e.endsWith('@rappi.com') ? styles.hoEmailInterno : styles.hoEmailExterno}>
                                {e}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td>{h.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.hoNote}>* Duración programada — datos reales de Meet disponibles cuando Jesus David conecte su cuenta</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
