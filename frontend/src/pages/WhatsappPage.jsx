import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getDashboard } from '../services/dashboardService'
import {
  getWhatsappStatus, getWhatsappQr, openChrome,
  sendTest, getMsgTemplates, sendMasivo, sendPersonalized, getWaHistory, getWaSentToday
} from '../services/whatsappService'
import { generateWhatsappMessage, getAiRecommendations, invalidateAiRecommendation } from '../services/aiService'
import progressStore from '../services/whatsappProgressStore'
import api from '../services/api'
import styles from './WhatsappPage.module.css'

function limitForDays(days) {
  if (days < 7)  return 0
  if (days < 15) return 10
  if (days < 31) return 25
  if (days < 91) return 50
  return 100
}

function WaPhoneSetupModal({ onSave }) {
  const [days,   setDays]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const parsed = parseInt(days, 10)
  const valid  = !isNaN(parsed) && parsed >= 0 && parsed <= 3650
  const limit  = valid ? limitForDays(parsed) : null

  const limitLabel = limit === null ? null
    : limit === 0   ? '🚫 Bloqueado — número muy nuevo'
    : limit === 10  ? `✅ Límite: ${limit}/día`
    : limit === 25  ? `✅ Límite: ${limit}/día`
    : limit === 50  ? `✅ Límite: ${limit}/día`
    : `✅ Límite: ${limit}/día — máximo`

  const limitColor = limit === 0 ? '#EF4444' : limit <= 25 ? '#F59E0B' : '#22C55E'

  const handleSave = async () => {
    if (!valid) return
    setSaving(true); setError('')
    try {
      await api.post('/auth/wa-phone-age', { daysAgo: String(parsed) })
      onSave({ days: parsed, limit })
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#1F2937', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%',
        border: '1.5px solid #374151', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: 8 }}>📱</div>
        <h3 style={{ color: '#F9FAFB', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', margin: '0 0 6px' }}>
          ¿Cuántos días llevas usando tu SIM de WhatsApp Business?
        </h3>
        <p style={{ color: '#9CA3AF', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
          Este dato <strong style={{ color: '#F9FAFB' }}>no se puede editar después</strong>.<br/>
          Responde con certeza — usamos esto para calcular tu límite diario y proteger tu número.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>Número de días</label>
          <input
            type="number" min="0" max="3650"
            value={days} onChange={e => setDays(e.target.value)}
            placeholder="Ej: 45"
            autoFocus
            style={{
              background: '#111827', border: '1.5px solid #374151', borderRadius: 8,
              padding: '10px 14px', color: '#F9FAFB', fontSize: '1.1rem', width: '100%',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {limitLabel && (
            <div style={{ color: limitColor, fontSize: '0.85rem', fontWeight: 600, marginTop: 4 }}>
              {limitLabel}
            </div>
          )}
        </div>
        {error && <div style={{ color: '#FCA5A5', fontSize: 12, marginTop: 8 }}>⚠ {error}</div>}
        <button onClick={handleSave} disabled={!valid || saving} style={{
          marginTop: 18, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
          background: valid ? '#7C3AED' : '#374151', color: '#fff', fontWeight: 700,
          fontSize: '0.95rem', cursor: valid ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Guardando...' : 'Confirmar — no podré cambiar esto'}
        </button>
      </div>
    </div>
  )
}

const STATUS_COLOR = { ENVIADO: '#22C55E', NUMERO_INVALIDO: '#F59E0B', ERROR: '#EF4444' }
const STATUS_LABEL = { ENVIADO: 'Enviado', NUMERO_INVALIDO: 'N° inválido', ERROR: 'Error' }

function formatDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr ?? ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return new Date(+y, +m - 1, +d).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'short'
  })
}

/* ── Tooltip portal — se monta en document.body, no se corta por overflow ── */
function TooltipPortal({ session, pos, onMouseEnter, onMouseLeave }) {
  const TOOLTIP_W = 320
  const TOOLTIP_H = 340
  const left = Math.max(8, Math.min(pos.left, window.innerWidth - TOOLTIP_W - 8))
  // Si no cabe abajo, lo muestra arriba de la fila
  const top  = pos.bottom + 8 + TOOLTIP_H > window.innerHeight
    ? Math.max(8, pos.top - TOOLTIP_H - 8)
    : pos.bottom + 8

  return createPortal(
    <div
      className={styles.historyTooltip}
      style={{ top, left, width: TOOLTIP_W }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.tooltipHeader}>
        {formatDate(session.date)} · {session.total} tiendas
      </div>
      <div className={styles.tooltipList}>
        {session.stores.map((s, i) => (
          <div key={i} className={styles.tooltipRow}>
            <span className={styles.tooltipDot} style={{ background: STATUS_COLOR[s.status] || '#6B7280' }} />
            <div className={styles.tooltipStoreInfo}>
              <span className={styles.tooltipStoreName}>{s.storeName}</span>
              <span className={styles.tooltipStoreMeta}>{s.brandId || s.storeCode} · {s.sentAt}</span>
              {s.status === 'ERROR' && s.errorMessage && (
                <span className={styles.tooltipError}>⚠ {s.errorMessage}</span>
              )}
            </div>
            <span className={styles.tooltipStatus} style={{ color: STATUS_COLOR[s.status] || '#6B7280' }}>
              {STATUS_LABEL[s.status] || s.status}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}

/* ── Historial de envíos ── */
function WaHistory() {
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [open,     setOpen]     = useState(false)
  const [hovered,  setHovered]  = useState(null)   // { idx, pos }
  const hideTimer = useRef(null)

  const showTooltip = (idx, e) => {
    clearTimeout(hideTimer.current)
    const rect = e.currentTarget.getBoundingClientRect()
    setHovered({ idx, pos: { top: rect.top, bottom: rect.bottom, left: rect.left } })
  }
  const scheduleHide = () => { hideTimer.current = setTimeout(() => setHovered(null), 150) }
  const cancelHide   = () => clearTimeout(hideTimer.current)

  useEffect(() => {
    getWaHistory(30)
      .then(r => setHistory(r.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  return (
    <div className={styles.historySection}>
      <button className={styles.historyToggle} onClick={() => setOpen(o => !o)}>
        <span>📋 Historial de envíos</span>
        {history.length > 0 && (
          <span className={styles.historyBadge}>{history.length} días</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.historyTable}>
          {history.length === 0 && (
            <div style={{ padding: '20px', color: '#6B7280', fontSize: 13, textAlign: 'center' }}>
              Sin historial de envíos en los últimos 30 días
            </div>
          )}
          {history.map((session, idx) => (
            <div
              key={session.date}
              className={styles.historyRow}
              onMouseEnter={e => showTooltip(idx, e)}
              onMouseLeave={scheduleHide}
            >
              <div className={styles.historyDate}>{formatDate(session.date)}</div>
              <div className={styles.historyStats}>
                <span className={styles.histStat} style={{ color: '#22C55E' }}>
                  ✓ {session.enviados} enviados
                </span>
                {session.noValidos > 0 && (
                  <span className={styles.histStat} style={{ color: '#F59E0B' }}>
                    ⚠ {session.noValidos} inválidos
                  </span>
                )}
                {session.errores > 0 && (
                  <span className={styles.histStat} style={{ color: '#EF4444' }}>
                    ✗ {session.errores} errores
                  </span>
                )}
                <span className={styles.histStat} style={{ color: '#6B7280' }}>
                  {session.total} total
                </span>
              </div>
              <span className={styles.historyHint}>Pasa el mouse para ver tiendas →</span>
            </div>
          ))}
        </div>
      )}

      {hovered !== null && history[hovered.idx] && (
        <TooltipPortal
          session={history[hovered.idx]}
          pos={hovered.pos}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  )
}

const SECTIONS = [
  { key: 'onboardingCritical', label: 'Onboarding',         icon: '🚨', color: '#EF4444' },
  { key: 'aliados',            label: 'Aliados 8–14',       icon: '🔗', color: '#F97316' },
  { key: 'selfOnboarding',     label: 'Self',               icon: '🛒', color: '#8B5CF6' },
  { key: 'churnRisk',          label: 'Churn',              icon: '⚠️', color: '#EF4444',
    subTabs: [
      { label: 'Todos',          filter: null },
      { label: 'Churn',          filter: s => s.churnLabel === 'Churn' },
      { label: 'Prevention W1',  filter: s => s.churnLabel === 'Prevention W1' },
      { label: 'Prevention W2',  filter: s => s.churnLabel === 'Prevention W2' },
      { label: 'Prevention W3',  filter: s => s.churnLabel === 'Prevention W3' },
    ]
  },
  { key: 'ava', label: 'AVA Bajando', icon: '📉', color: '#F59E0B',
    subTabs: [
      { label: 'Todos',    filter: null },
      { label: 'Crítico',  filter: s => s.avaLabel === 'Crítico' },
      { label: 'Bajando',  filter: s => s.avaLabel === 'Bajando' },
    ]
  },
]

const MAX_DIARIO = Infinity

/* ── Badge de aging con color según urgencia ── */
function AgingBadge({ aging }) {
  if (aging == null) return null
  const color = aging <= 3 ? '#EF4444' : aging <= 8 ? '#F97316' : aging <= 14 ? '#F59E0B' : '#6B7280'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
      background: color + '20', color, border: `1px solid ${color}40`, whiteSpace: 'nowrap',
    }}>
      D{aging}
    </span>
  )
}

/* ── Badge de AVA o churn ── */
function StatusBadge({ store }) {
  if (store.churnLabel) {
    const color = store.churnLabel === 'Churn' ? '#EF4444' : '#F59E0B'
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
        background: color + '20', color, border: `1px solid ${color}40`, whiteSpace: 'nowrap',
      }}>
        {store.churnLabel}
      </span>
    )
  }
  if (store.connectionPercentage != null) {
    const pct   = Number(store.connectionPercentage)
    const color = pct < 30 ? '#EF4444' : pct < 60 ? '#F59E0B' : '#22C55E'
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
        background: color + '20', color, border: `1px solid ${color}40`, whiteSpace: 'nowrap',
      }}>
        AVA {pct.toFixed(0)}%
      </span>
    )
  }
  return null
}

/* ── Selector de tiendas mejorado ── */
function StoreSelector({ sections, dashStores, selected, remaining, onToggle, onSelectAll, onClear, sentTodayIds }) {
  const available = sections.filter(s => (dashStores[s.key]?.length ?? 0) > 0)
  const [activeKey,    setActiveKey]    = useState(() => available[0]?.key ?? null)
  const [activeSubIdx, setActiveSubIdx] = useState(0)

  // Seleccionar automáticamente la primera pestaña cuando llegan los datos
  useEffect(() => {
    if (!activeKey && available.length > 0) setActiveKey(available[0].key)
  }, [available.length])
  const [search,       setSearch]       = useState('')
  const [hideNoPhone,  setHideNoPhone]  = useState(true)
  const [hideSentToday, setHideSentToday] = useState(false)

  const sec       = sections.find(s => s.key === activeKey)
  const allStores = sec ? (dashStores[activeKey] ?? []) : []

  const subTabs = sec?.subTabs ?? null
  const subTab  = subTabs?.[activeSubIdx]
  const bySubTab = subTab?.filter ? allStores.filter(subTab.filter) : allStores

  const filtered = bySubTab.filter(s => {
    if (hideNoPhone && !s.phoneNumber) return false
    if (hideSentToday && sentTodayIds.has(s.id)) return false
    if (search) {
      const q = search.toLowerCase()
      return s.storeName?.toLowerCase().includes(q) || s.storeCode?.toLowerCase().includes(q)
    }
    return true
  })

  const sectionSel = filtered.filter(s => selected.has(s.id))
  const canAddMore = selected.size < remaining

  // Cuántas de esta sección (vista completa) ya tienen WA hoy
  const sentCount   = bySubTab.filter(s => sentTodayIds.has(s.id)).length
  const noPhoneCount = bySubTab.filter(s => !s.phoneNumber).length

  const handleTabChange = (key) => { setActiveKey(key); setActiveSubIdx(0); setSearch('') }
  const handleSubChange = (idx)  => { setActiveSubIdx(idx); setSearch('') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Tabs principales */}
      <div className={styles.tabRow}>
        {available.map(s => {
          const selInSection = (dashStores[s.key] ?? []).filter(st => selected.has(st.id)).length
          return (
            <button key={s.key}
              className={`${styles.tabBtn} ${activeKey === s.key ? styles.tabBtnActive : ''}`}
              style={activeKey === s.key ? { borderColor: s.color, color: s.color } : {}}
              onClick={() => handleTabChange(s.key)}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
              <span className={styles.tabCount}
                style={activeKey === s.key ? { background: `${s.color}22`, color: s.color } : {}}>
                {dashStores[s.key]?.length ?? 0}
              </span>
              {selInSection > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 99,
                  background: '#22C55E22', color: '#22C55E', border: '1px solid #22C55E40',
                }}>✓{selInSection}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sub-tabs */}
      {subTabs && (
        <div className={styles.subTabRow}>
          {subTabs.map((st, idx) => {
            const count = (subTabs[idx].filter ? allStores.filter(subTabs[idx].filter) : allStores).length
            return (
              <button key={idx}
                className={`${styles.subTabBtn} ${activeSubIdx === idx ? styles.subTabBtnActive : ''}`}
                onClick={() => handleSubChange(idx)}>
                {st.label}
                <span className={styles.subTabCount}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Stats de la sección */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#6B7280' }}>
        <span>{bySubTab.length} tiendas</span>
        {noPhoneCount > 0 && <span>· {noPhoneCount} sin teléfono</span>}
        {sentCount > 0    && <span style={{ color: '#22C55E' }}>· {sentCount} ya enviados hoy</span>}
        {sectionSel.length > 0 && <span style={{ color: '#3B82F6', fontWeight: 700 }}>· {sectionSel.length} seleccionadas aquí</span>}
      </div>

      {/* Toolbar: buscar + filtros rápidos + acciones */}
      {sec && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={styles.sectionToolbar}>
            <div className={styles.searchWrap}>
              <span>🔍</span>
              <input className={styles.searchInput} placeholder="Buscar tienda o código..."
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className={styles.clearBtn} onClick={() => setSearch('')}>✕</button>}
            </div>
            <button className={styles.btnXs}
              onClick={() => onSelectAll(filtered.filter(s => s.phoneNumber && !selected.has(s.id) && !sentTodayIds.has(s.id)))}
              disabled={!canAddMore}>
              Sel. visibles
            </button>
            {sectionSel.length > 0 && (
              <button className={styles.btnXsDanger}
                onClick={() => onClear(filtered.map(s => s.id))}>
                Quitar {sectionSel.length}
              </button>
            )}
          </div>

          {/* Filtros rápidos */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setHideNoPhone(v => !v)}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontWeight: 600,
                background: hideNoPhone ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: hideNoPhone ? '#3B82F6' : '#6B7280',
                border: `1px solid ${hideNoPhone ? '#3B82F640' : '#374151'}`,
              }}>
              📞 Solo con teléfono
            </button>
            {sentCount > 0 && (
              <button
                onClick={() => setHideSentToday(v => !v)}
                style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontWeight: 600,
                  background: hideSentToday ? 'rgba(34,197,94,0.15)' : 'transparent',
                  color: hideSentToday ? '#22C55E' : '#6B7280',
                  border: `1px solid ${hideSentToday ? '#22C55E40' : '#374151'}`,
                }}>
                ✓ Ocultar enviados hoy
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de tiendas */}
      <div className={styles.storeList}>
        {filtered.map(store => {
          const isSelected   = selected.has(store.id)
          const hasPhone     = !!store.phoneNumber
          const sentToday    = sentTodayIds.has(store.id)
          const disabled     = !hasPhone || (!isSelected && !canAddMore)
          return (
            <div key={store.id}
              className={`${styles.storeRow} ${isSelected ? styles.storeRowSel : ''} ${disabled ? styles.storeRowDis : ''}`}
              onClick={() => !disabled && onToggle(store.id)}>
              <input type="checkbox" className={styles.checkbox} checked={isSelected} readOnly disabled={disabled} />
              <div className={styles.storeInfo} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className={styles.storeName}>{store.storeName}</span>
                  {sentToday && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                      background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E40',
                    }}>✓ WA enviado hoy</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  <span className={styles.storeMeta}>
                    {store.storeCode}
                    {hasPhone ? ` · ${store.phoneNumber}` : ''}
                  </span>
                  <AgingBadge aging={store.aging} />
                  <StatusBadge store={store} />
                </div>
              </div>
              {!hasPhone && <span className={styles.noPhone}>Sin tel.</span>}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className={styles.hint}>
            {bySubTab.length === 0
              ? 'Sin tiendas en esta sección'
              : 'Ninguna tienda coincide con los filtros activos'}
          </div>
        )}
      </div>
    </div>
  )
}


/* ── Conexión WhatsApp (Baileys) ── */
function StepConnection({ status, qr, onRefresh, onStart, loading, starting }) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNum}>1</span>
        <div>
          <div className={styles.stepTitle}>Conexión WhatsApp</div>
          <div className={styles.stepSub}>
            {status.connected ? 'Sesión activa' : qr ? 'Escanea el QR con WhatsApp' : 'Servicio no iniciado'}
          </div>
        </div>
        <div className={`${styles.statusDot} ${status.connected ? styles.dotGreen : qr ? styles.dotYellow : styles.dotRed}`} />
      </div>

      <div className={styles.statusRow}>
        <div className={styles.statusItem}>{status.connected ? '✅' : '⏳'} WA {status.connected ? 'conectado' : 'desconectado'}</div>
        <div className={styles.statusItem}>💬 <strong>{status.sentToday ?? 0}</strong> enviados hoy</div>
      </div>

      {/* QR para escanear */}
      {!status.connected && qr && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
          <img src={qr} alt="QR WhatsApp" style={{ width: 220, height: 220, borderRadius: 12, border: '2px solid #e2e8f0' }} />
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>El QR expira en 60 segundos · Verificando cada 2s...</p>
        </div>
      )}

      {!status.connected && !qr && (
        <div style={{ padding: '12px 0', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          Inicia el servicio para obtener el código QR
        </div>
      )}

      <div className={styles.btnRow}>
        {!status.connected && !qr && (
          <button className={styles.btnPrimary} onClick={onStart} disabled={starting}>
            {starting ? <><span className={styles.spinner} /> Iniciando...</> : '▶ Iniciar servicio WhatsApp'}
          </button>
        )}
        <button className={styles.btnSecondary} onClick={onRefresh} disabled={loading}>
          {loading ? <><span className={styles.spinner} /> Verificando...</> : '🔄 Verificar estado'}
        </button>
      </div>
    </div>
  )
}


/* ── Mensaje ── */
function StepMessage({ message, onChange, selectedStores = [], onAiMessages, onModeChange }) {
  const [mode,       setMode]       = useState('manual')  // 'manual' | 'ai'
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiError,    setAiError]    = useState(null)
  const [aiDone,     setAiDone]     = useState(false)
  const textareaRef = useRef(null)

  const preview = (message || '').replace(/\{store_name\}/g, 'Restaurante Ejemplo')

  const handleModeChange = (m) => {
    setMode(m)
    setAiDone(false)
    setAiError(null)
    onModeChange(m)
    if (m === 'ai') onAiMessages([])
  }

  const insertVariable = () => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const val   = message || ''
    const newVal = val.slice(0, start) + '{store_name}' + val.slice(end)
    onChange(newVal)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + 12, start + 12)
    }, 0)
  }

  const handleAiGenerate = async () => {
    if (!selectedStores.length) {
      setAiError('Selecciona al menos una tienda primero')
      return
    }
    setAiLoading(true)
    setAiProgress(0)
    setAiError(null)
    setAiDone(false)
    const results = []
    try {
      for (let i = 0; i < selectedStores.length; i++) {
        const store = selectedStores[i]
        if (i > 0) await new Promise(res => setTimeout(res, 2000))
        const r = await generateWhatsappMessage(
          store.storeName || 'Restaurante',
          store.aging    ?? 0,
          store.agingStage   || null,
          store.dashboardSegment || null,
          store.churnLabel   || null,
          store.avaLabel     || null,
          store.connectionPercentage != null ? Number(store.connectionPercentage) : null,
          store.currentStatus || null,
          ''
        )
        results.push({ storeId: store.id, storeName: store.storeName, message: r.data.message })
        setAiProgress(results.length)
      }
      setAiDone(true)
      onAiMessages(results)
    } catch (e) {
      setAiError(e.response?.data?.error || 'Error al generar con IA')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNum}>3</span>
        <div>
          <div className={styles.stepTitle}>Mensaje</div>
          <div className={styles.stepSub}>Elige cómo quieres crear el mensaje</div>
        </div>
      </div>

      {/* Selector de modo */}
      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${mode === 'manual' ? styles.modeBtnActive : ''}`}
          onClick={() => handleModeChange('manual')}
        >
          ✏️ Escribir mensaje
        </button>
        <button
          className={`${styles.modeBtn} ${mode === 'ai' ? styles.modeBtnActive : ''}`}
          onClick={() => handleModeChange('ai')}
          disabled={!selectedStores.length}
          title={!selectedStores.length ? 'Selecciona tiendas primero' : ''}
        >
          ✨ Generar con IA
        </button>
      </div>

      {/* Modo manual */}
      {mode === 'manual' && (
        <div className={styles.messageWrap}>
          <div className={styles.varHint}>
            Variable opcional:
            <button className={styles.varChip} onClick={insertVariable} title="Inserta el nombre de la tienda">
              {'{store_name}'}
            </button>
            <span className={styles.varHintSub}>— se reemplaza por el nombre real de cada tienda</span>
          </div>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={6}
            value={message}
            onChange={e => onChange(e.target.value)}
            placeholder="Escribe tu mensaje aquí..."
          />
          {message && (
            <div className={styles.previewBox}>
              <div className={styles.previewLabel}>Vista previa</div>
              <div className={styles.previewBubble}>{preview}</div>
            </div>
          )}
        </div>
      )}

      {/* Modo IA */}
      {mode === 'ai' && (
        <div className={styles.aiPanel}>
          <p className={styles.aiDesc}>
            La IA genera un mensaje personalizado para cada tienda según su situación actual
            (días de onboarding, AVA, estado de churn, etc.)
          </p>
          {aiError && <div className={styles.aiError}>{aiError}</div>}
          {aiDone && <div className={styles.aiSuccess}>✅ {aiProgress} mensajes generados — revisa el panel de abajo antes de enviar</div>}
          <button
            className={styles.aiBtnBig}
            onClick={handleAiGenerate}
            disabled={aiLoading || !selectedStores.length}
          >
            {aiLoading
              ? `⏳ Generando ${aiProgress}/${selectedStores.length}...`
              : `✨ Generar IA para ${selectedStores.length} tienda${selectedStores.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Progreso ── */
function SendProgress({ progress, onClose }) {
  const pct = progress.total > 0 ? Math.round((progress.procesados / progress.total) * 100) : 0
  const dotColor = { ENVIADO:'#22C55E', ERROR:'#EF4444', NUMERO_INVALIDO:'#F59E0B', ESPERANDO:'#6B7280', ENVIANDO:'#3B82F6', COMPLETADO:'#22C55E' }
  return (
    <div className={styles.progressCard}>
      <div className={styles.progressHeader}>
        <span className={styles.progressTitle}>{progress.finalizado ? '✅ Completado' : '📤 Enviando...'}</span>
        {progress.finalizado && <button className={styles.btnSecondary} onClick={onClose}>Nueva sesión</button>}
      </div>
      <div className={styles.progressBarWrap}>
        <div className={styles.progressBarBg}>
          <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressPct}>{pct}%</span>
      </div>
      <div className={styles.progressStats}>
        <div className={styles.pStat}><span className={styles.pStatVal} style={{color:'#22C55E'}}>{progress.enviados}</span><span>Enviados</span></div>
        <div className={styles.pStat}><span className={styles.pStatVal} style={{color:'#EF4444'}}>{progress.errores}</span><span>Errores</span></div>
        <div className={styles.pStat}><span className={styles.pStatVal}>{progress.procesados}</span><span>Procesados</span></div>
        <div className={styles.pStat}><span className={styles.pStatVal}>{progress.total}</span><span>Total</span></div>
      </div>
      {progress.storeName && (
        <div className={styles.currentStore}>
          <span className={styles.currentDot} style={{ background: dotColor[progress.status] || '#6B7280' }} />
          <span className={styles.currentName}>{progress.storeName}</span>
          <span className={styles.currentStatus}>
            {progress.status === 'ESPERANDO' ? `⏳ ${progress.waitSeconds}s` : progress.status}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Página ── */
export default function WhatsappPage() {
  const [status,      setStatus]      = useState({ open:false, connected:false, sentToday:0, remaining:40, waLimit:40, phoneAgeWeeks:0, pendingSetup:false })
  const [qr,          setQr]          = useState(null)
  const [showPhoneSetup, setShowPhoneSetup] = useState(false)
  const [dashStores,  setDashStores]  = useState({})
  const [selected,    setSelected]    = useState(new Set())
  const [templates,   setTemplates]   = useState([])
  const [selTemplate, setSelTemplate] = useState(null)
  const [message,     setMessage]     = useState(() => progressStore.getSnapshot().message)
  const [chromLoad,   setChromLoad]   = useState(false)
  const [starting,    setStarting]    = useState(false)
  const [sending,     setSending]     = useState(() => progressStore.getSnapshot().sending)
  const [progress,    setProgress]    = useState(() => progressStore.getSnapshot().progress)
  const [testPhone,   setTestPhone]   = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult,  setTestResult]  = useState(null)
  const [aiMessages,  setAiMessages]  = useState(() => progressStore.getSnapshot().aiMessages)
  const [sentTodayIds, setSentTodayIds] = useState(new Set())
  const [aiRecommLoading, setAiRecommLoading] = useState(false)
  const [aiRecommMsg,    setAiRecommMsg]    = useState(null) // { type: 'ok'|'error', text }

  const loadStatus = async () => {
    try {
      const r = await getWhatsappStatus()
      setStatus(r.data)
      if (r.data.pendingSetup) setShowPhoneSetup(true)
      if (!r.data.connected) {
        const qrRes = await getWhatsappQr().catch(() => null)
        setQr(qrRes?.data?.qr || null)
      } else {
        setQr(null)
      }
    } catch {}
  }
  const loadDash = () => getDashboard().then(r => setDashStores(r.data)).catch(() => {})
  const loadSentToday = () => getWaSentToday()
    .then(r => setSentTodayIds(new Set((r.data ?? []).map(s => s.id))))
    .catch(() => {})

  useEffect(() => {
    loadStatus(); loadDash(); loadSentToday()
    getMsgTemplates().then(r => setTemplates(r.data)).catch(() => {})
    const iv = setInterval(loadStatus, 5000)
    // Reconectar estado si el usuario salió y volvió (navegación o recarga)
    const unsub = progressStore.subscribe(({ sending: s, progress: p, message: m, aiMessages: ai }) => {
      setSending(s)
      setProgress(p)
      setMessage(m)
      setAiMessages(ai)
      if (p?.finalizado) { loadStatus(); loadSentToday() }
    })
    return () => { clearInterval(iv); unsub() }
  }, [])

  // Mientras el QR está visible, hacer polling cada 2s para detectar conexión rápido
  useEffect(() => {
    if (!qr) return
    const iv = setInterval(loadStatus, 2000)
    return () => clearInterval(iv)
  }, [!!qr])

  const remaining = status.remaining ?? MAX_DIARIO

  const handleToggle = id => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else if (next.size < remaining) next.add(id)
    return next
  })

  const handleSelectAll = stores => setSelected(prev => {
    const next = new Set(prev)
    stores.forEach(s => { if (next.size < remaining) next.add(s.id) })
    return next
  })

  const handleClearSection = ids => setSelected(prev => {
    const next = new Set(prev)
    ids.forEach(id => next.delete(id))
    return next
  })

  const handleAiRecommend = async () => {
    setAiRecommLoading(true)
    setAiRecommMsg(null)
    try {
      const res = await getAiRecommendations()
      const priorities = res.data?.priorities ?? []

      if (priorities.length === 0) {
        setAiRecommMsg({ type: 'error', text: 'La IA no generó recomendaciones — intenta de nuevo en unos segundos.' })
        return
      }

      // El backend resolvió storeCode → storeId. Usar IDs + fallback por storeCode.
      const topIds   = new Set(priorities.slice(0, 30).map(p => p.storeId).filter(Boolean))
      const topCodes = new Set(priorities.slice(0, 30).map(p => p.storeCode?.toLowerCase().trim()).filter(Boolean))

      // Deduplicar por id (una tienda puede aparecer en varios campos del dashboard)
      const allStores = [...new Map(
        Object.values(dashStores).flat()
          .filter(s => s && typeof s === 'object' && s.id)
          .map(s => [s.id, s])
      ).values()]

      // Calcular matches ANTES de setSelected (el updater de React puede ejecutarse
      // en un ciclo posterior, haciendo que leer 'added' afuera dé siempre 0)
      const toAdd = allStores.filter(s =>
        topIds.has(s.id) ||
        topCodes.has(s.storeCode?.toLowerCase().trim())
      )

      setSelected(prev => {
        const next = new Set(prev)
        toAdd.forEach(s => next.add(s.id))
        return next
      })

      const total = priorities.length
      const added = toAdd.length
      if (added === 0) {
        setAiRecommMsg({ type: 'error', text: `La IA recomendó ${total} tiendas pero ninguna coincide con tu cartera activa. Haz click en "🤖 IA Recomienda" nuevamente para regenerar.` })
        // Borrar caché del día para forzar regeneración en el próximo intento
        invalidateAiRecommendation()
      } else {
        setAiRecommMsg({ type: 'ok', text: `✓ IA seleccionó ${added} tiendas de ${total} recomendadas` })
        setTimeout(() => setAiRecommMsg(null), 4000)
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Error al consultar la IA — verifica que esté disponible.'
      setAiRecommMsg({ type: 'error', text: msg })
    } finally {
      setAiRecommLoading(false)
    }
  }

  const handleRefresh = async () => {
    setChromLoad(true)
    await loadStatus()
    setChromLoad(false)
  }

  const handleStart = async () => {
    setStarting(true)
    try {
      await openChrome()
      // Chromium puede tardar 10-30s en arrancar — hacer polling hasta que
      // aparezca QR o conexión, con timeout de 45 segundos
      const deadline = Date.now() + 45_000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2500))
        const r = await getWhatsappStatus().catch(() => null)
        if (!r) continue
        setStatus(r.data)
        if (r.data.connected || r.data.hasQr) break
      }
      // Carga final para sincronizar QR si todavía no está
      await loadStatus()
    } catch {}
    setStarting(false)
  }

  const handleSend = () => {
    if (!selected.size || !message.trim() || !status.connected) return
    const initial = { total: selected.size, procesados:0, enviados:0, errores:0, storeName:'', status:'INICIANDO', finalizado:false, waitSeconds:0 }
    progressStore.update({ sending: true, progress: initial })
    sendMasivo(Array.from(selected), message,
      () => {},
      () => { loadStatus(); loadSentToday() },
      () => {}
    )
  }

  const handleSendAi = () => {
    if (!aiMessages.length || !status.connected) return
    const initial = { total: aiMessages.length, procesados:0, enviados:0, errores:0, storeName:'', status:'INICIANDO', finalizado:false, waitSeconds:0 }
    progressStore.update({ sending: true, progress: initial })
    sendPersonalized(
      aiMessages.map(m => ({ storeId: m.storeId, message: m.message })),
      () => {},
      () => { loadStatus(); loadSentToday() },
      () => {}
    )
  }

  const handleTest = async () => {
    if (!testPhone.trim() || !message.trim()) return
    setTestSending(true); setTestResult(null)
    try {
      const r = await sendTest(testPhone.trim(), message)
      setTestResult({ ok: r.data.result === 'ENVIADO', msg: r.data.result })
    } catch { setTestResult({ ok: false, msg: 'Error de conexión' }) }
    finally { setTestSending(false) }
  }

  const canSend = status.connected && selected.size > 0 && message.trim() && !sending

  const waLimitBanner = () => {
    const limit = status.waLimit ?? 100
    if (status.pendingSetup) return null
    if (limit >= 100) return null
    const days = (status.phoneAgeWeeks ?? 0) * 7
    if (limit === 0) return (
      <div style={{ background: '#EF444415', border: '1px solid #EF4444', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#FCA5A5' }}>
        🚫 <strong>WhatsApp bloqueado</strong> — Tu SIM tiene menos de 7 días. Úsala en conversaciones normales hasta cumplir la semana.
      </div>
    )
    const color = limit <= 10 ? '#F97316' : limit <= 25 ? '#F59E0B' : '#3B82F6'
    return (
      <div style={{ background: color + '15', border: `1px solid ${color}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color }}>
        ⚠️ <strong>SIM con ~{days} días</strong> — Límite: <strong>{limit} envíos/día</strong>. Quedan <strong>{status.remaining}</strong> hoy. El límite sube automáticamente con el tiempo.
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {showPhoneSetup && (
        <WaPhoneSetupModal onSave={opt => {
          setShowPhoneSetup(false)
          setStatus(prev => ({ ...prev, waLimit: opt.limit, phoneAgeWeeks: Math.floor(opt.days / 7), pendingSetup: false, remaining: opt.limit }))
        }} />
      )}
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>WhatsApp Masivo</h1>
        <p className={styles.sub}>Delay aleatorio 10–25s entre envíos</p>
      </div>

      {waLimitBanner()}

      <div className={styles.layout}>
        <div className={styles.leftCol}>

          <StepConnection status={status} qr={qr} onRefresh={handleRefresh} onStart={handleStart} loading={chromLoad} starting={starting} />

          {/* ── Secciones de tiendas ── */}
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNum}>2</span>
              <div>
                <div className={styles.stepTitle}>Seleccionar tiendas</div>
                <div className={styles.stepSub}>
                  {selected.size > 0
                    ? <span style={{ color: '#3B82F6', fontWeight: 700 }}>{selected.size} seleccionadas · ~{Math.round(selected.size * 17.5 / 60)} min de envío</span>
                    : 'Elige las tiendas a las que deseas escribir'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={styles.btnXs}
                    style={{ background: '#7C3AED', color: '#fff', border: 'none', opacity: aiRecommLoading ? 0.7 : 1 }}
                    onClick={handleAiRecommend}
                    disabled={aiRecommLoading}>
                    {aiRecommLoading ? 'Analizando...' : '🤖 IA Recomienda'}
                  </button>
                  {selected.size > 0 && (
                    <button
                      className={styles.btnXsDanger}
                      onClick={() => setSelected(new Set())}>
                      Limpiar todo
                    </button>
                  )}
                </div>
                {aiRecommMsg && (
                  <span style={{ fontSize: '0.72rem', color: aiRecommMsg.type === 'ok' ? '#22C55E' : '#EF4444', textAlign: 'right', maxWidth: 260 }}>
                    {aiRecommMsg.text}
                  </span>
                )}
              </div>
            </div>
            <StoreSelector
              sections={SECTIONS}
              dashStores={dashStores}
              selected={selected}
              remaining={remaining}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onClear={handleClearSection}
              sentTodayIds={sentTodayIds}
            />
          </div>

          <StepMessage
            message={message} onChange={v => { setMessage(v); progressStore.update({ message: v }) }}
            selectedStores={Object.values(dashStores).flat()
              .filter(s => selected.has(s.id))
              .filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)}
            onAiMessages={msgs => { setAiMessages(msgs); progressStore.update({ aiMessages: msgs }) }}
            onModeChange={m => { if (m === 'manual') { setAiMessages([]); progressStore.update({ aiMessages: [] }) } }} />

          {/* ── Panel revisión mensajes IA ── */}
          {aiMessages.length > 0 && (
            <div className={styles.stepCard}>
              <div className={styles.stepHeader}>
                <span className={styles.stepNum}>✨</span>
                <div>
                  <div className={styles.stepTitle}>Mensajes personalizados por IA</div>
                  <div className={styles.stepSub}>{aiMessages.length} mensajes listos — edita si necesitas ajustar</div>
                </div>
                <button className={styles.btnXsDanger} onClick={() => { setAiMessages([]); progressStore.update({ aiMessages: [] }) }}>Limpiar</button>
              </div>
              <div className={styles.aiMsgList}>
                {aiMessages.map((m, i) => (
                  <div key={m.storeId} className={styles.aiMsgRow}>
                    <div className={styles.aiMsgStore}>{m.storeName}</div>
                    <textarea
                      className={styles.aiMsgTextarea}
                      rows={3}
                      value={m.message}
                      onChange={e => { const updated = aiMessages.map((x, j) => j === i ? { ...x, message: e.target.value } : x); setAiMessages(updated); progressStore.update({ aiMessages: updated }) }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Prueba ── */}
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNum}>4</span>
              <div>
                <div className={styles.stepTitle}>Mensaje de prueba</div>
                <div className={styles.stepSub}>Verifica antes de enviar masivo</div>
              </div>
            </div>
            <div className={styles.testRow}>
              <input className={styles.testInput} placeholder="Ej: 573001234567"
                value={testPhone} onChange={e => setTestPhone(e.target.value)} />
              <button className={styles.btnSecondary} onClick={handleTest}
                disabled={testSending || !testPhone || !message}>
                {testSending ? 'Enviando...' : '📤 Enviar prueba'}
              </button>
            </div>
            {testResult && (
              <div className={`${styles.testResult} ${testResult.ok ? styles.testOk : styles.testError}`}>
                {testResult.ok ? '✅' : '❌'} {testResult.msg}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div className={styles.rightCol}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTitle}>Resumen del envío</div>
            <div className={styles.summaryRow}><span>Seleccionadas</span><strong>{selected.size}</strong></div>

            <div className={styles.summaryRow}>
              <span>Chrome</span>
              <strong style={{ color: status.connected ? '#22C55E' : '#EF4444' }}>
                {status.connected ? 'Conectado' : 'Desconectado'}
              </strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Mensaje</span>
              <strong style={{ color: (message.trim() || aiMessages.length > 0) ? '#22C55E' : '#6B7280' }}>
                {aiMessages.length > 0 ? `IA (${aiMessages.length})` : message.trim() ? 'Listo' : 'Pendiente'}
              </strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Tiempo estimado</span>
              <strong>{selected.size > 0 ? `~${Math.round(selected.size * 17.5 / 60)} min` : '—'}</strong>
            </div>
            {!status.connected && <div className={styles.warnBox}>⚠️ Conecta WhatsApp Web primero</div>}
            {!message.trim() && !aiMessages.length && <div className={styles.warnBox}>Crea el mensaje a enviar</div>}
            {aiMessages.length > 0 ? (
              <button className={styles.btnSendAi} onClick={handleSendAi} disabled={!status.connected || sending}>
                {sending
                  ? <><span className={styles.spinner} /> Enviando...</>
                  : `✨ Enviar ${aiMessages.length} mensajes IA`}
              </button>
            ) : (
              <button className={styles.btnSend} onClick={handleSend} disabled={!canSend}>
                {sending
                  ? <><span className={styles.spinner} /> Enviando...</>
                  : `📤 Enviar a ${selected.size} tienda${selected.size !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          {progress && (
            <SendProgress progress={progress}
              onClose={() => { progressStore.clear(); setSelected(new Set()) }} />
          )}
        </div>
      </div>

      <WaHistory />

    </div>
  )
}
