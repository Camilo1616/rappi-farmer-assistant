import { useState, useEffect } from 'react'
import { getHistorial } from '../services/agmService'
import TimelineList, { statusColor } from './TimelineList'
import styles from '../pages/GestionAgmPage.module.css'

const todayStr = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ── "Historial de gestión" — único módulo de Reportes, filtrado por día exacto o rango ── */
export default function HistorialGestionTab() {
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entries, setEntries] = useState([])
  const [openDay, setOpenDay] = useState(null)
  const [statusFiltro, setStatusFiltro] = useState(null)
  const [storeFiltro, setStoreFiltro] = useState('')

  const load = (desde, hasta) => {
    setLoading(true); setError(null)
    getHistorial({ desde, hasta })
      .then(r => setEntries(r.data))
      .catch(e => setError(e.response?.data?.message || 'Error al leer el historial'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(dateFrom, dateTo) }, []) // eslint-disable-line

  const handleDateFromChange = (e) => {
    const from = e.target.value
    setDateFrom(from)
    const to = from > dateTo ? from : dateTo
    if (from > dateTo) setDateTo(from)
    load(from, to)
  }

  const handleDateToChange = (e) => {
    const to = e.target.value
    setDateTo(to)
    load(dateFrom, to)
  }

  const irAHoy = () => {
    setDateFrom(todayStr()); setDateTo(todayStr())
    setStatusFiltro(null); setStoreFiltro('')
    load(todayStr(), todayStr())
  }

  // Conteo por status sobre TODO lo traído (para los chips de filtro, antes de aplicar filtros)
  const conteoTotal = {}
  entries.forEach(e => { conteoTotal[e.status || 'Sin status'] = (conteoTotal[e.status || 'Sin status'] || 0) + 1 })

  const filtradas = entries.filter(e =>
    (!statusFiltro || (e.status || 'Sin status') === statusFiltro) &&
    (!storeFiltro.trim() || (e.storeId || '').toLowerCase().includes(storeFiltro.trim().toLowerCase()))
  )

  // Agrupar por día (YYYY-MM-DD extraído de "yyyy-MM-dd HH:mm:ss")
  const porDia = {}
  for (const e of filtradas) {
    const dia = (e.fechaHora || '').slice(0, 10) || 'Sin fecha'
    porDia[dia] = porDia[dia] || []
    porDia[dia].push(e)
  }
  const dias = Object.keys(porDia).sort().reverse()

  const hayFiltrosActivos = !!statusFiltro || !!storeFiltro.trim()

  return (
    <div className={styles.card}>
      <div className={styles.sectionTitle}>📅 Historial de gestión</div>
      <p className={styles.emptyText}>Qué tareas se gestionaron y cuándo — elige un día exacto o un rango de fechas.</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0 16px' }}>
        <label className={styles.label} style={{ margin: 0 }}>Desde:</label>
        <input className={styles.input} style={{ width: 'auto' }} type="date"
          value={dateFrom} max={todayStr()} onChange={handleDateFromChange} />
        <label className={styles.label} style={{ margin: 0 }}>Hasta:</label>
        <input className={styles.input} style={{ width: 'auto' }} type="date"
          value={dateTo} min={dateFrom} max={todayStr()} onChange={handleDateToChange} />
        <input className={styles.input} style={{ width: 160 }} type="text" placeholder="Buscar Store ID"
          value={storeFiltro} onChange={e => setStoreFiltro(e.target.value)} />
        {(dateFrom !== todayStr() || dateTo !== todayStr() || hayFiltrosActivos) && (
          <button className={styles.btnGhost} onClick={irAHoy}>Ir a hoy</button>
        )}
      </div>

      {loading && <p className={styles.emptyText}>Cargando...</p>}
      {error && <div className={styles.readOnlyNote}>⚠ {error}</div>}

      {!loading && !error && entries.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 16px' }}>
          <span className={styles.dayBadge} style={{ color: '#F0F2F8', borderColor: '#F0F2F855' }}>
            Total: {filtradas.length}{hayFiltrosActivos ? ` de ${entries.length}` : ''}
          </span>
          {Object.entries(conteoTotal).map(([status, n]) => {
            const activo = statusFiltro === status
            return (
              <button key={status}
                className={styles.dayBadge}
                style={{
                  color: statusColor(status), borderColor: statusColor(status) + (activo ? 'FF' : '55'),
                  background: activo ? statusColor(status) + '22' : 'transparent',
                  cursor: 'pointer',
                }}
                title="Filtrar por este status"
                onClick={() => setStatusFiltro(activo ? null : status)}>
                {status} × {n}
              </button>
            )
          })}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className={styles.emptyText}>No hay gestiones registradas en este periodo.</p>
      )}

      {!loading && !error && entries.length > 0 && dias.length === 0 && (
        <p className={styles.emptyText}>Ninguna gestión coincide con el filtro aplicado.</p>
      )}

      {!loading && !error && dias.map(dia => {
        const items = porDia[dia]
        const conteo = {}
        items.forEach(e => { conteo[e.status || 'Sin status'] = (conteo[e.status || 'Sin status'] || 0) + 1 })
        const abierto = dias.length === 1 || openDay === dia
        return (
          <div key={dia} className={styles.dayGroup}>
            <button className={styles.dayHeader} onClick={() => setOpenDay(abierto && dias.length > 1 ? null : dia)}>
              <span>{dia}</span>
              <span className={styles.dayCount}>{items.length} cambios</span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(conteo).map(([status, n]) => (
                  <span key={status} className={styles.dayBadge} style={{ color: statusColor(status), borderColor: statusColor(status) + '55' }}>
                    {status} × {n}
                  </span>
                ))}
              </span>
              {dias.length > 1 && <span style={{ marginLeft: 'auto' }}>{abierto ? '▲' : '▼'}</span>}
            </button>
            {abierto && <TimelineList entries={items} showStore />}
          </div>
        )
      })}
    </div>
  )
}
