import { useState, useEffect, useMemo } from 'react'
import { getTodayManagements, updateManagement, deleteManagement } from '../services/dashboardService'
import styles from './ManagementPage.module.css'

const TIPOS = ['WHATSAPP', 'LLAMADA', 'SAC', 'SEGUIMIENTO', 'ACTIVACION']
const RESULTADOS = ['EFECTIVA', 'NO_CONTACTO']

const TIPO_LABEL = {
  WHATSAPP:    { label: 'WhatsApp',    color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  LLAMADA:     { label: 'Llamada',     color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  SAC:         { label: 'SAC',         color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
  SEGUIMIENTO: { label: 'Seguimiento', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  ACTIVACION:  { label: 'Activación',  color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
}
const RESULT_LABEL = {
  EFECTIVA:              { label: 'Efectiva',             color: '#22C55E', icon: '✅' },
  NO_CONTACTO:           { label: 'No contacto',          color: '#6B7280', icon: '📵' },
  NO_RESPONDE:           { label: 'No responde',          color: '#9CA3AF', icon: '🔇' },
  PROBLEMA_TECNICO:      { label: 'Problema técnico',     color: '#EF4444', icon: '🔧' },
  REQUIERE_SEGUIMIENTO:  { label: 'Requiere seguimiento', color: '#F59E0B', icon: '🔄' },
}
const ALL = 'TODOS'
const META_EFECTIVAS = 15
const META_NO_CONTACTO_MAX = 40

/* ── Modal de edición ── */
function EditModal({ row, onClose, onSaved }) {
  const [tipo,     setTipo]     = useState(row.managementType)
  const [result,   setResult]   = useState(row.resultType)
  const [comments, setComments] = useState(row.comments || '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await updateManagement(row.id, { managementType: tipo, resultType: result, comments })
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Editar gestión</div>
            <div className={styles.modalSub}>{row.storeName} · {row.storeCode}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.fieldLabel}>Tipo de gestión</label>
          <div className={styles.chipGroup}>
            {TIPOS.map(t => {
              const cfg = TIPO_LABEL[t]
              return (
                <button key={t}
                  className={`${styles.chip} ${tipo === t ? styles.chipActive : ''}`}
                  style={tipo === t ? { background: cfg.bg, borderColor: cfg.color, color: cfg.color } : {}}
                  onClick={() => setTipo(t)}
                >{cfg.label}</button>
              )
            })}
          </div>

          <label className={styles.fieldLabel}>Resultado</label>
          <div className={styles.chipGroup}>
            {RESULTADOS.map(r => {
              const cfg = RESULT_LABEL[r]
              return (
                <button key={r}
                  className={`${styles.chip} ${result === r ? styles.chipActive : ''}`}
                  style={result === r ? { background: cfg.color + '18', borderColor: cfg.color, color: cfg.color } : {}}
                  onClick={() => setResult(r)}
                >{cfg.icon} {cfg.label}</button>
              )
            })}
          </div>

          <label className={styles.fieldLabel}>Comentario</label>
          <textarea
            className={styles.textarea}
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Opcional..."
            rows={3}
          />

          {error && <div className={styles.modalError}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Stat card ── */
function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className={styles.statCard} style={{ borderColor: color + '33' }}>
      <div className={styles.statIcon} style={{ background: color + '18', color }}>{icon}</div>
      <div className={styles.statBody}>
        <div className={styles.statValue} style={{ color }}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  )
}

/* ── Página principal ── */
export default function ManagementPage() {
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterTipo,   setFilterTipo]   = useState(ALL)
  const [filterResult, setFilterResult] = useState(ALL)
  const [editing,      setEditing]      = useState(null)
  const [deletingId,   setDeletingId]   = useState(null)

  const load = () => {
    setLoading(true)
    getTodayManagements()
      .then(r => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta gestión? La acción no se puede deshacer.')) return
    setDeletingId(id)
    try {
      await deleteManagement(id)
      load()
    } catch (e) {
      alert(e.response?.data?.message || 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  const stats = useMemo(() => {
    const real = rows.filter(r => !r.brandSync)
    return {
      total:       real.length,
      efectivas:   real.filter(r => r.resultType === 'EFECTIVA').length,
      noContacto:  real.filter(r => r.resultType === 'NO_CONTACTO').length,
      noResponde:  real.filter(r => r.resultType === 'NO_RESPONDE').length,
      problema:    real.filter(r => r.resultType === 'PROBLEMA_TECNICO').length,
      seguimiento: real.filter(r => r.resultType === 'REQUIERE_SEGUIMIENTO').length,
      whatsapp:    real.filter(r => r.managementType === 'WHATSAPP').length,
      llamada:     real.filter(r => r.managementType === 'LLAMADA').length,
    }
  }, [rows])

  const filtered = useMemo(() => rows.filter(r => {
    if (r.brandSync) return false
    if (filterTipo   !== ALL && r.managementType !== filterTipo)   return false
    if (filterResult !== ALL && r.resultType     !== filterResult) return false
    if (search) {
      const q = search.toLowerCase()
      return r.storeName?.toLowerCase().includes(q) || r.storeCode?.toLowerCase().includes(q)
    }
    return true
  }), [rows, filterTipo, filterResult, search])

  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestiones del día</h1>
          <p className={styles.sub}>{today}</p>
        </div>
        <div className={styles.progressWrap}>
          <div className={styles.progressLabel}>
            Meta efectivas: <strong>{stats.efectivas}/{META_EFECTIVAS}</strong>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{
              width: `${Math.min(100, (stats.efectivas / META_EFECTIVAS) * 100)}%`,
              background: stats.efectivas >= META_EFECTIVAS ? '#22C55E' : '#F97316'
            }} />
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className={styles.statsGrid}>
        <StatCard icon="📋" label="Total gestionadas"    value={stats.total}       color="#3B82F6" />
        <StatCard icon="✅" label="Efectivas"            value={stats.efectivas}   color="#22C55E"
          sub={stats.efectivas >= META_EFECTIVAS ? '¡Meta cumplida!' : `Faltan ${META_EFECTIVAS - stats.efectivas}`} />
        <StatCard icon="📵" label="No contacto"          value={stats.noContacto}  color="#6B7280"
          sub={stats.noContacto > META_NO_CONTACTO_MAX ? '⚠️ Sobre límite' : `Límite: ${META_NO_CONTACTO_MAX}`} />
        <StatCard icon="💬" label="WhatsApp"             value={stats.whatsapp}    color="#22C55E" />
        <StatCard icon="📞" label="Llamadas"             value={stats.llamada}     color="#3B82F6" />
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input className={styles.searchInput} placeholder="Buscar tienda..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.clearBtn} onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className={styles.chips}>
          {[ALL, ...TIPOS].map(t => (
            <button key={t}
              className={`${styles.chip} ${filterTipo === t ? styles.chipActive : ''}`}
              style={filterTipo === t && t !== ALL ? { background: TIPO_LABEL[t].bg, borderColor: TIPO_LABEL[t].color, color: TIPO_LABEL[t].color } : {}}
              onClick={() => setFilterTipo(t)}
            >{t === ALL ? 'Todos los tipos' : TIPO_LABEL[t].label}</button>
          ))}
        </div>
        <div className={styles.chips}>
          {[ALL, ...RESULTADOS].map(r => (
            <button key={r}
              className={`${styles.chip} ${filterResult === r ? styles.chipActive : ''}`}
              style={filterResult === r && r !== ALL ? { background: RESULT_LABEL[r].color + '18', borderColor: RESULT_LABEL[r].color, color: RESULT_LABEL[r].color } : {}}
              onClick={() => setFilterResult(r)}
            >{r === ALL ? 'Todos los resultados' : `${RESULT_LABEL[r].icon} ${RESULT_LABEL[r].label}`}</button>
          ))}
        </div>
      </div>

      {/* ── Tabla ── */}
      {loading ? (
        <div className={styles.empty}><div className={styles.spinner} /><p>Cargando gestiones...</p></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📋</span>
          <p>{rows.length === 0 ? 'No hay gestiones registradas hoy.' : 'No hay resultados con los filtros aplicados.'}</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tableCount}>{filtered.length} gestión{filtered.length !== 1 ? 'es' : ''}</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tienda</th>
                <th>Tipo</th>
                <th>Resultado</th>
                <th>Comentario</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const tipo   = TIPO_LABEL[r.managementType]
                const result = RESULT_LABEL[r.resultType]
                const isDeleting = deletingId === r.id
                return (
                  <tr key={r.id} className={r.brandSync ? styles.rowSync : ''}>
                    <td className={styles.tdTime}>{r.managementTime || '—'}</td>
                    <td className={styles.tdStore}>
                      <div className={styles.storeName}>{r.storeName || '—'}</div>
                      <div className={styles.storeCode}>{r.storeCode}</div>
                      {r.brandSync && <span className={styles.syncBadge}>⚡ Brand sync</span>}
                    </td>
                    <td>
                      {tipo
                        ? <span className={styles.badge} style={{ background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                        : r.managementType}
                    </td>
                    <td>
                      {result
                        ? <span className={styles.badge} style={{ background: result.color + '18', color: result.color }}>{result.icon} {result.label}</span>
                        : r.resultType}
                    </td>
                    <td className={styles.tdComment}>{r.comments || <span className={styles.noComment}>—</span>}</td>
                    <td className={styles.tdActions}>
                      {!r.brandSync && (
                        <>
                          <button className={styles.btnEdit} onClick={() => setEditing(r)} title="Editar">✏️</button>
                          <button className={styles.btnDelete} onClick={() => handleDelete(r.id)}
                            disabled={isDeleting} title="Eliminar">
                            {isDeleting ? '...' : '🗑️'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
