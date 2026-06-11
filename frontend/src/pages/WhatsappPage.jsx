import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getDashboard } from '../services/dashboardService'
import {
  getWhatsappStatus, getWhatsappQr,
  sendTest, getMsgTemplates, sendMasivo, getWaHistory
} from '../services/whatsappService'
import { generateWhatsappMessage } from '../services/aiService'
import styles from './WhatsappPage.module.css'

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
  { key: 'onboardingCritical', label: 'Onboarding Crítico', icon: '🚨', color: '#EF4444' },
  { key: 'aliados',            label: 'Aliados AVA 8-14',   icon: '🔗', color: '#F97316' },
  { key: 'selfOnboarding',     label: 'Self-Onboarding',    icon: '🛒', color: '#8B5CF6' },
  { key: 'churnRisk',          label: 'Riesgo Churn',       icon: '⚠️', color: '#EF4444',
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


/* ── Selector de tiendas con tabs ── */
function StoreSelector({ sections, dashStores, selected, remaining, onToggle, onSelectAll, onClear }) {
  const available = sections.filter(s => (dashStores[s.key]?.length ?? 0) > 0)
  const [activeKey,    setActiveKey]    = useState(() => available[0]?.key ?? null)
  const [activeSubIdx, setActiveSubIdx] = useState(0)
  const [search,       setSearch]       = useState('')

  const sec       = sections.find(s => s.key === activeKey)
  const allStores = sec ? (dashStores[activeKey] ?? []) : []

  const subTabs  = sec?.subTabs ?? null
  const subTab   = subTabs?.[activeSubIdx]
  const stores   = subTab?.filter ? allStores.filter(subTab.filter) : allStores

  const withPhone  = stores.filter(s => s.phoneNumber)
  const filtered   = stores.filter(s =>
    !search || s.storeName?.toLowerCase().includes(search.toLowerCase()) || s.storeCode?.toLowerCase().includes(search.toLowerCase())
  )
  const sectionSel = stores.filter(s => selected.has(s.id))
  const canAddMore = selected.size < remaining

  const handleTabChange = (key) => { setActiveKey(key); setActiveSubIdx(0); setSearch('') }
  const handleSubChange = (idx)  => { setActiveSubIdx(idx); setSearch('') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tabs principales */}
      <div className={styles.tabRow}>
        {available.map(s => {
          const count = (dashStores[s.key] ?? []).filter(st => selected.has(st.id)).length
          return (
            <button key={s.key}
              className={`${styles.tabBtn} ${activeKey === s.key ? styles.tabBtnActive : ''}`}
              style={activeKey === s.key ? { borderColor: s.color, color: s.color } : {}}
              onClick={() => handleTabChange(s.key)}>
              {s.label}
              <span className={styles.tabCount} style={activeKey === s.key ? { background: `${s.color}22`, color: s.color } : {}}>
                {dashStores[s.key]?.length ?? 0}
              </span>
              {count > 0 && <span className={styles.tabSel}>✓{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Sub-tabs (solo si la sección activa los tiene) */}
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

      {/* Toolbar */}
      {sec && (
        <div className={styles.sectionToolbar}>
          <div className={styles.searchWrap}>
            <span>🔍</span>
            <input className={styles.searchInput} placeholder="Buscar tienda..." value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && <button className={styles.clearBtn} onClick={() => setSearch('')}>✕</button>}
          </div>
          <button className={styles.btnXs}
            onClick={() => onSelectAll(filtered.filter(s => s.phoneNumber && !selected.has(s.id)))}
            disabled={!canAddMore && sectionSel.length === 0}>
            Sel. todas
          </button>
          {sectionSel.length > 0 && (
            <button className={styles.btnXsDanger} onClick={() => onClear(stores.map(s => s.id))}>
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      <div className={styles.storeList}>
        {filtered.map(store => {
          const isSelected = selected.has(store.id)
          const hasPhone   = !!store.phoneNumber
          const disabled   = !hasPhone || (!isSelected && !canAddMore)
          return (
            <div key={store.id}
              className={`${styles.storeRow} ${isSelected ? styles.storeRowSel : ''} ${disabled ? styles.storeRowDis : ''}`}
              onClick={() => !disabled && onToggle(store.id)}>
              <input type="checkbox" className={styles.checkbox} checked={isSelected} readOnly disabled={disabled} />
              <div className={styles.storeInfo}>
                <span className={styles.storeName}>{store.storeName}</span>
                <span className={styles.storeMeta}>{store.storeCode} · {store.phoneNumber || '—'}</span>
              </div>
              {!hasPhone && <span className={styles.noPhone}>Sin teléfono</span>}
              {isSelected && <span className={styles.selBadge}>✓</span>}
            </div>
          )
        })}
        {filtered.length === 0 && <div className={styles.hint}>Sin tiendas en esta sección</div>}
      </div>
    </div>
  )
}


/* ── Conexión WhatsApp (Baileys) ── */
function StepConnection({ status, qr, onRefresh, loading }) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNum}>1</span>
        <div>
          <div className={styles.stepTitle}>Conexión WhatsApp</div>
          <div className={styles.stepSub}>
            {status.connected ? 'Sesión activa' : qr ? 'Escanea el QR con WhatsApp' : 'Esperando servicio...'}
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
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>El QR expira en 60 segundos</p>
        </div>
      )}

      {!status.connected && !qr && (
        <div style={{ padding: '12px 0', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          Iniciando servicio de WhatsApp...
        </div>
      )}

      <div className={styles.btnRow}>
        <button className={styles.btnSecondary} onClick={onRefresh} disabled={loading}>
          {loading ? <><span className={styles.spinner} /> Verificando...</> : '🔄 Verificar estado'}
        </button>
      </div>
    </div>
  )
}


/* ── Mensaje ── */
function StepMessage({ templates, template, onTemplate, message, onChange, selectedStores = [] }) {
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]   = useState(null)

  const preview = (message || '').replace(/\{store_name\}/g, 'Restaurante Ejemplo')
                                .replace(/\{owner_name\}/g, 'Carlos')

  const handleAiGenerate = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const sample = selectedStores[0]
      const storeName = sample?.storeName || 'Restaurante'
      const ownerName = 'Propietario'
      const agingDays = sample?.aging ?? 7
      const situation = sample
        ? `Día ${agingDays} de onboarding, estado: ${sample.currentStatus || 'seguimiento'}, etapa: ${sample.agingStage || ''}`
        : 'seguimiento general'
      const r = await generateWhatsappMessage(
        storeName,
        ownerName,
        agingDays,
        situation,
        message || templates[0]?.content || 'Hola {store_name}, te escribimos del equipo Rappi.'
      )
      onChange(r.data.message)
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
          <div className={styles.stepSub}>Usa <code>{'{store_name}'}</code> como variable</div>
        </div>
        <button
          className={styles.aiBtnSmall}
          onClick={handleAiGenerate}
          disabled={aiLoading}
          title="Generar variante con IA"
        >
          {aiLoading ? '...' : '✨ IA'}
        </button>
      </div>
      {aiError && <div className={styles.aiError}>{aiError}</div>}
      {templates.length > 0 && (
        <div className={styles.templateGrid}>
          {templates.map(t => (
            <button key={t.id}
              className={`${styles.templateBtn} ${template === t.id ? styles.templateBtnSel : ''}`}
              onClick={() => onTemplate(t)}>{t.name}</button>
          ))}
        </div>
      )}
      <div className={styles.messageWrap}>
        <textarea className={styles.textarea} rows={6} value={message}
          onChange={e => onChange(e.target.value)} placeholder="Escribe tu mensaje..." />
        <div className={styles.previewBox}>
          <div className={styles.previewLabel}>Vista previa</div>
          <div className={styles.previewBubble}>{preview || '...'}</div>
        </div>
      </div>
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
  const [status,      setStatus]      = useState({ open:false, connected:false, sentToday:0, remaining:MAX_DIARIO })
  const [qr,          setQr]          = useState(null)
  const [dashStores,  setDashStores]  = useState({})
  const [selected,    setSelected]    = useState(new Set())
  const [templates,   setTemplates]   = useState([])
  const [selTemplate, setSelTemplate] = useState(null)
  const [message,     setMessage]     = useState('')
  const [chromLoad,   setChromLoad]   = useState(false)
  const [sending,     setSending]     = useState(false)
  const [progress,    setProgress]    = useState(null)
  const [testPhone,   setTestPhone]   = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult,  setTestResult]  = useState(null)

  const loadStatus = async () => {
    try {
      const r = await getWhatsappStatus()
      setStatus(r.data)
      // Si no está conectado, pedir el QR
      if (!r.data.connected) {
        const qrRes = await getWhatsappQr().catch(() => null)
        setQr(qrRes?.data?.qr || null)
      } else {
        setQr(null)
      }
    } catch {}
  }
  const loadDash = () => getDashboard().then(r => setDashStores(r.data)).catch(() => {})

  useEffect(() => {
    loadStatus(); loadDash()
    getMsgTemplates().then(r => setTemplates(r.data)).catch(() => {})
    // Polling más frecuente cuando no está conectado (para mostrar QR actualizado)
    const iv = setInterval(loadStatus, 5000)
    return () => clearInterval(iv)
  }, [])

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

  const handleRefresh = async () => {
    setChromLoad(true)
    await loadStatus()
    setChromLoad(false)
  }

  const handleSend = () => {
    if (!selected.size || !message.trim() || !status.connected) return
    setSending(true)
    setProgress({ total: selected.size, procesados:0, enviados:0, errores:0, storeName:'', status:'INICIANDO', finalizado:false, waitSeconds:0 })
    sendMasivo(Array.from(selected), message,
      data => setProgress(data),
      data => { setProgress(data); setSending(false); loadStatus() },
      ()   => setSending(false)
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>WhatsApp Masivo</h1>
        <p className={styles.sub}>Delay aleatorio 10–25s entre envíos</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.leftCol}>

          <StepConnection status={status} qr={qr} onRefresh={handleRefresh} loading={chromLoad} />

          {/* ── Secciones de tiendas ── */}
          <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
              <span className={styles.stepNum}>2</span>
              <div>
                <div className={styles.stepTitle}>Seleccionar tiendas</div>
                <div className={styles.stepSub}>{selected.size} seleccionadas</div>
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
            />
          </div>

          <StepMessage templates={templates} template={selTemplate}
            onTemplate={t => { setSelTemplate(t.id); setMessage(t.content) }}
            message={message} onChange={setMessage}
            selectedStores={dashStores.filter(s => selected.has(s.id))} />

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
              <strong style={{ color: message.trim() ? '#22C55E' : '#6B7280' }}>
                {message.trim() ? 'Listo' : 'Pendiente'}
              </strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Tiempo estimado</span>
              <strong>{selected.size > 0 ? `~${Math.round(selected.size * 17.5 / 60)} min` : '—'}</strong>
            </div>
            {!status.connected && <div className={styles.warnBox}>⚠️ Conecta WhatsApp Web primero</div>}
            {!message.trim()   && <div className={styles.warnBox}>Escribe el mensaje a enviar</div>}
            <button className={styles.btnSend} onClick={handleSend} disabled={!canSend}>
              {sending
                ? <><span className={styles.spinner} /> Enviando...</>
                : `📤 Enviar a ${selected.size} tienda${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>

          {progress && (
            <SendProgress progress={progress}
              onClose={() => { setProgress(null); setSelected(new Set()); setSending(false) }} />
          )}
        </div>
      </div>

      <WaHistory />

    </div>
  )
}
