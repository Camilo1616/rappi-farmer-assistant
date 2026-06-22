import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../services/api'
import rappiMascot from '../assets/rappi-mascot.jpeg'
import { useAuth } from '../context/AuthContext'
import { getCached, setCache, invalidateCache } from '../services/aiRecommCache'

/* ── Markdown renderer ──────────────────────────────────────────────────── */
function Md({ children, onRowCtx }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children: c }) => (
          <div style={{ overflowX: 'auto', marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>{c}</table>
          </div>
        ),
        thead: ({ children: c }) => <thead>{c}</thead>,
        tbody: ({ children: c }) => <tbody>{c}</tbody>,
        tr: ({ children: c }) => (
          <tr
            onContextMenu={onRowCtx ? e => { const txt = e.currentTarget.textContent || ''; onRowCtx(e, txt) } : undefined}
            style={{ cursor: onRowCtx ? 'context-menu' : 'default' }}
          >{c}</tr>
        ),
        th: ({ children: c }) => (
          <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '2px solid rgba(124,58,237,0.35)', color: '#7C3AED', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c}</th>
        ),
        td: ({ children: c }) => (
          <td style={{ padding: '4px 6px', borderBottom: '1px solid rgba(128,128,128,0.15)', fontSize: 11, color: 'var(--text-primary,#111)', verticalAlign: 'top' }}>{c}</td>
        ),
        p:      ({ children: c }) => <p style={{ margin: '0 0 5px 0', lineHeight: 1.5, fontSize: 12 }}>{c}</p>,
        ul:     ({ children: c }) => <ul style={{ margin: '0 0 5px 0', paddingLeft: 16, fontSize: 12 }}>{c}</ul>,
        ol:     ({ children: c }) => <ol style={{ margin: '0 0 5px 0', paddingLeft: 16, fontSize: 12 }}>{c}</ol>,
        li:     ({ children: c }) => <li style={{ marginBottom: 2 }}>{c}</li>,
        strong: ({ children: c }) => <strong style={{ fontWeight: 700 }}>{c}</strong>,
        code:   ({ children: c }) => <code style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 3, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace' }}>{c}</code>,
        h3:     ({ children: c }) => <h3 style={{ fontSize: 12, fontWeight: 700, margin: '7px 0 3px 0' }}>{c}</h3>,
        h4:     ({ children: c }) => <h4 style={{ fontSize: 11, fontWeight: 700, margin: '5px 0 2px 0' }}>{c}</h4>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const TIPO_OPTS = [
  { value: 'WHATSAPP', label: '💬 WhatsApp' },
  { value: 'LLAMADA',  label: '📞 Llamada'  },
  { value: 'SAC',      label: '📧 Correo'   },
]
const RESULTADO_OPTS = [
  { value: 'EFECTIVA',    label: '✅ Efectiva',    color: '#22C55E' },
  { value: 'NO_CONTACTO', label: '📵 No contacto', color: '#94A3B8' },
]

function InfoRow({ label, value, accent }) {
  if (!value || value === '—' || value === '-') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
      <span style={{ fontSize: 10, color: 'var(--text-secondary,#888)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700,
        color: accent || 'var(--text-primary,#111)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

/* ── StoreContextMenu ───────────────────────────────────────────────────── */
function StoreContextMenu({ menu, onClose, onManaged }) {
  const [tipo,       setTipo]       = useState('LLAMADA')
  const [resultado,  setResultado]  = useState('')
  const [comentario, setComentario] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState(null)

  useEffect(() => {
    if (menu.visible) { setTipo('LLAMADA'); setResultado(''); setComentario(''); setSaved(false); setSaveError(null) }
  }, [menu.storeCode, menu.visible])

  if (!menu.visible) return null
  const d = menu.data

  const left = Math.min(menu.x + 8, window.innerWidth  - 380)
  const top  = Math.min(menu.y,     window.innerHeight - 580)

  const hasHo     = d?.hadHandoff === 'true' || d?.hadHandoff === true
  const aging     = d?.aging ? parseInt(d.aging) : null
  const agingColor = aging != null ? (aging <= 7 ? '#EF4444' : aging <= 14 ? '#F97316' : '#22C55E') : '#94A3B8'
  const ava        = d?.connectionPct && d.connectionPct !== '—' ? parseFloat(d.connectionPct) : null
  const avaColor   = ava != null ? (ava < 30 ? '#EF4444' : ava < 60 ? '#F97316' : '#22C55E') : '#94A3B8'

  const handleSave = async () => {
    if (!resultado || !d?.id) return
    setSaving(true); setSaveError(null)
    try {
      await api.post(`/stores/${d.id}/management`, {
        managementType: tipo,
        resultType:     resultado,
        comments:       comentario.trim() || null,
      })
      setSaved(true)
      if (onManaged) onManaged(menu.storeCode)
      setResultado(''); setComentario('')
      setTimeout(() => onClose(), 1800)
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', left, top, zIndex: 99999,
      width: 360,
      background: 'var(--bg-card,#fff)',
      border: '1.5px solid rgba(124,58,237,0.35)',
      borderRadius: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(124,58,237,0.12)',
      fontSize: 12,
      userSelect: 'text',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#7C3AED18,#6D28D908)', borderBottom: '1px solid rgba(124,58,237,0.15)', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {menu.loading
            ? <div style={{ height: 16, background: 'rgba(128,128,128,0.15)', borderRadius: 4, marginBottom: 4 }} />
            : <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary,#111)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d ? d.storeName : '⚠️ No encontrada'}
              </div>
          }
          {d && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(124,58,237,0.12)', color: '#7C3AED', borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{d.storeCode}</span>
              {aging != null && <span style={{ background: agingColor + '18', color: agingColor, borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{aging}d · {d.agingStage || '—'}</span>}
              <span style={{ background: hasHo ? '#22C55E18' : '#EF444418', color: hasHo ? '#22C55E' : '#EF4444', borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{hasHo ? '✅ HO' : '❌ Sin HO'}</span>
              {ava != null && <span style={{ background: avaColor + '18', color: avaColor, borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>AVA {ava}%</span>}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary,#888)', padding: 2, flexShrink: 0, lineHeight: 1 }}>✕</button>
      </div>

      {menu.loading && <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-secondary,#888)' }}><div style={{ fontSize: 20, marginBottom: 6 }}>⏳</div>Buscando tienda...</div>}
      {!menu.loading && !d && <div style={{ padding: '16px 14px', color: 'var(--text-secondary,#888)', textAlign: 'center', fontSize: 12 }}>Tienda no encontrada en la base de datos.</div>}

      {!menu.loading && d && (
        <div>
          <div style={{ padding: '8px 14px 4px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#7C3AED', letterSpacing: '0.8px', marginBottom: 4 }}>📋 Información</div>
            <InfoRow label="Canal"      value={d.channel} />
            <InfoRow label="Teléfono"   value={d.phoneNumber} />
            <InfoRow label="Brand ID"   value={d.brandId} />
            <InfoRow label="Onboarding" value={d.onboardingDate} />
            <InfoRow label="Estado"     value={d.currentStatus} accent={d.currentStatus?.toLowerCase().includes('churn') ? '#EF4444' : undefined} />
            <InfoRow label="Último FU"  value={d.lastFollowUp} />
            <InfoRow label="FU 30d"     value={d.followUpLast30d} accent={d.followUpLast30d === 'NO' ? '#EF4444' : '#22C55E'} />
            <InfoRow label="Gestionar"  value={d.gestionar} accent={d.gestionar?.toUpperCase() === 'IS' ? '#EF4444' : '#7C3AED'} />
          </div>
          <div style={{ height: 1, background: 'rgba(124,58,237,0.15)', margin: '6px 0' }} />
          <div style={{ padding: '8px 14px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#7C3AED', letterSpacing: '0.8px', marginBottom: 8 }}>⚡ Registrar gestión</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
              {TIPO_OPTS.map(o => (
                <button key={o.value} onClick={() => setTipo(o.value)} style={{ padding: '3px 8px', borderRadius: 6, border: '1.5px solid', borderColor: tipo === o.value ? '#7C3AED' : 'var(--border,#e5e7eb)', background: tipo === o.value ? '#7C3AED' : 'transparent', color: tipo === o.value ? '#fff' : 'var(--text-secondary,#888)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{o.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
              {RESULTADO_OPTS.map(o => (
                <button key={o.value} onClick={() => setResultado(o.value)} style={{ padding: '3px 8px', borderRadius: 6, border: '1.5px solid', borderColor: resultado === o.value ? o.color : 'var(--border,#e5e7eb)', background: resultado === o.value ? o.color + '22' : 'transparent', color: resultado === o.value ? o.color : 'var(--text-secondary,#888)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{o.label}</button>
              ))}
            </div>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Comentario..." rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 7, border: '1.5px solid var(--border,#e5e7eb)', background: 'var(--bg-input,#f9f9f9)', color: 'var(--text-primary,#111)', fontSize: 11, resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 7 }} />
            {saveError && <div style={{ color: '#EF4444', fontSize: 11, marginBottom: 6 }}>⚠️ {saveError}</div>}
            {saved     && <div style={{ color: '#22C55E', fontSize: 11, marginBottom: 6 }}>✅ Gestión registrada</div>}
            <button onClick={handleSave} disabled={!resultado || !comentario.trim() || saving} style={{ width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', background: !resultado || !comentario.trim() || saving ? 'var(--bg-input,#e5e7eb)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: !resultado || !comentario.trim() || saving ? 'var(--text-secondary,#888)' : '#fff', fontWeight: 800, fontSize: 12, cursor: !resultado || !comentario.trim() || saving ? 'default' : 'pointer', transition: 'all 0.15s' }}>
              {saving ? '⏳ Guardando...' : '💾 Registrar gestión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Robot Button ───────────────────────────────────────────────────────── */
function buildTips(name) {
  const n = name ? `, ${name}` : ''
  return [
    '¿Qué ataco hoy? 🎯',
    'Tengo tu cartera lista 📋',
    '¡Hagámoslo! 💪',
    'Checa tus IS 👀',
    'Onboarding crítico ⚠️',
    `Soy tu copiloto${n} 🚀`,
    `Hoy te ayudo${n} a priorizar, escribir WA y cerrar más tiendas 🏪`,
  ]
}

function RobotSVG({ hovered, blink, look }) {
  const SIZE = 120
  const leftEye  = { cx: SIZE * 0.38, cy: SIZE * 0.41 }
  const rightEye = { cx: SIZE * 0.62, cy: SIZE * 0.41 }
  const eyeR = 7, pupilR = 3.5
  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
      <img src={rappiMascot} alt="Rappi" style={{ width: SIZE, height: SIZE, objectFit: 'contain', filter: hovered ? 'drop-shadow(0 0 8px #FF441F88)' : 'none', transition: 'filter 0.25s' }} />
      <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={SIZE} height={SIZE}>
        {[leftEye, rightEye].map((eye, i) => (
          <g key={i}>
            <ellipse cx={eye.cx} cy={eye.cy} rx={eyeR} ry={blink ? 1 : eyeR} fill="white" style={{ transition: 'ry 0.06s' }} />
            {!blink && <circle cx={eye.cx + (look?.dx ?? 0)} cy={eye.cy + (look?.dy ?? 0)} r={pupilR} fill="#1a1a1a" style={{ transition: 'cx 0.18s, cy 0.18s' }} />}
            {!blink && <circle cx={eye.cx + (look?.dx ?? 0) + 1.5} cy={eye.cy + (look?.dy ?? 0) - 1.5} r={1} fill="white" opacity={0.8} />}
          </g>
        ))}
      </svg>
    </div>
  )
}

function RobotButton({ open, dragging, onMouseDown, onClick, farmerName }) {
  const [hovered, setHovered] = useState(false)
  const [tipIdx,  setTipIdx]  = useState(0)
  const [blink,   setBlink]   = useState(false)
  const [pulse,   setPulse]   = useState(false)
  const [look,    setLook]    = useState({ dx: 0, dy: 0 })
  const buttonRef = useRef(null)
  const tips = buildTips(farmerName)

  useEffect(() => {
    if (open) return
    const id = setInterval(() => setTipIdx(i => (i + 1) % tips.length), 4000)
    return () => clearInterval(id)
  }, [open, tips.length])

  useEffect(() => {
    const doBlink = () => {
      setBlink(true); setTimeout(() => setBlink(false), 90)
      setTimeout(() => setBlink(true), 220); setTimeout(() => setBlink(false), 310)
    }
    let id
    const schedule = () => { id = setTimeout(() => { doBlink(); schedule() }, Math.random() * 2000 + 1200) }
    schedule()
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const onMove = e => {
      const el = buttonRef.current; if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx)
      const dist  = Math.min(3, Math.hypot(e.clientX - cx, e.clientY - cy) / 30)
      setLook({ dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    if (open) return
    const id = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 800) }, 4500)
    return () => clearInterval(id)
  }, [open])

  return (
    <div ref={buttonRef} onMouseDown={onMouseDown} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      title="Asistente IA — arrastra para mover"
      style={{ cursor: dragging ? 'grabbing' : 'grab', display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', position: 'relative', filter: open ? 'drop-shadow(0 0 18px #7C3AED99)' : hovered ? 'drop-shadow(0 6px 20px #7C3AED88)' : 'drop-shadow(0 4px 14px #0006)', transition: 'filter 0.25s' }}
    >
      {!open && (
        <div style={{ position: 'relative', background: hovered ? 'linear-gradient(135deg,#6D28D9,#7C3AED)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', borderRadius: 12, padding: '5px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', marginBottom: 6, boxShadow: hovered ? '0 4px 20px #7C3AED88' : '0 2px 12px #7C3AED55', transform: hovered ? 'scale(1.07) translateY(-3px)' : 'scale(1)', animation: hovered ? 'none' : 'bubbleBounce 2.8s ease-in-out infinite', transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
          {tips[tipIdx]}
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #7C3AED' }} />
        </div>
      )}
      {pulse && !open && (
        <div style={{ position: 'absolute', bottom: 4, left: '50%', width: 110, height: 110, marginLeft: -55, borderRadius: '50%', border: '2px solid #A78BFA', animation: 'ringPulse 0.8s ease-out forwards', pointerEvents: 'none' }} />
      )}
      <div style={{ transform: hovered ? 'scale(1.08) translateY(-4px)' : open ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <RobotSVG hovered={hovered} blink={blink} look={look} />
      </div>
    </div>
  )
}

/* ── Tarjeta de prioridad ───────────────────────────────────────────────── */
const PRIORITY_CONFIG = {
  ALTA:  { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  label: 'ALTA',  dot: '🔴' },
  MEDIA: { color: '#F97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.22)', label: 'MEDIA', dot: '🟡' },
  BAJA:  { color: '#22C55E', bg: 'rgba(34,197,94,0.05)',  border: 'rgba(34,197,94,0.2)',   label: 'BAJA',  dot: '🟢' },
}

function PriorityCard({ p, isManaged, result, onManage }) {
  const cfg    = PRIORITY_CONFIG[p.priority] ?? PRIORITY_CONFIG.MEDIA
  const isEfectiva   = result === 'EFECTIVA'
  const isNoContacto = result === 'NO_CONTACTO'

  if (isManaged) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: isEfectiva ? 'rgba(34,197,94,0.06)' : 'rgba(148,163,184,0.06)', border: `1px solid ${isEfectiva ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.2)'}`, opacity: 0.7, marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{isEfectiva ? '✅' : '📵'}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{p.storeName}</span>
        <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600 }}>{p.storeCode}</span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 700, background: isEfectiva ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)', color: isEfectiva ? '#16A34A' : '#64748B' }}>
          {isEfectiva ? 'Efectiva' : isNoContacto ? 'No contacto' : 'Gestionada'}
        </span>
      </div>
    )
  }

  return (
    <div
      onClick={p.storeCode ? e => { e.stopPropagation(); onManage(e) } : undefined}
      style={{
        borderRadius: 10, marginBottom: 6, overflow: 'hidden',
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        cursor: p.storeCode ? 'pointer' : 'default',
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => { if (p.storeCode) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${cfg.color}22` } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {/* Top row: priority + name + code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px 4px' }}>
        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: cfg.color + '18', color: cfg.color, letterSpacing: '0.5px', flexShrink: 0 }}>
          {cfg.dot} {cfg.label}
        </span>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.storeName}</span>
        <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>{p.storeCode}</span>
      </div>

      {/* Reason + Action */}
      <div style={{ padding: '0 10px 6px' }}>
        <p style={{ margin: '0 0 3px 0', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          📌 {p.reason}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: cfg.color, fontWeight: 700, lineHeight: 1.4 }}>
          → {p.action}
        </p>
      </div>

      {/* Footer: click hint */}
      {p.storeCode && (
        <div style={{ borderTop: `1px solid ${cfg.border}`, padding: '4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 9, color: cfg.color, fontWeight: 700, opacity: 0.8 }}>
            Toca para gestionar →
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Tab de recomendaciones ─────────────────────────────────────────────── */
function RecTab({ aiRec, aiLoading, aiError, rateLimit, setRateLimit, loadRec, managedCodes, onManage }) {
  const [search, setSearch] = useState('')

  const total    = aiRec?.priorities?.length ?? 0
  const managed  = Object.keys(aiRec?.managedResults ?? {}).length + [...managedCodes].filter(c => !aiRec?.managedResults?.[c]).length
  const alta     = aiRec?.priorities?.filter(p => p.priority === 'ALTA' && !aiRec.managedResults?.[p.storeCode]).length ?? 0
  const progress = total > 0 ? Math.min(100, Math.round((managed / total) * 100)) : 0

  if (aiLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, padding: 24 }}>
      <div style={{ fontSize: 40, animation: 'robotWork 0.7s infinite alternate' }}>🤖</div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#7C3AED' }}>Analizando tu cartera...</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>La IA está revisando prioridades,<br/>onboarding crítico y más.</div>
      <div style={{ width: 160, height: 4, background: 'rgba(124,58,237,0.15)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg,#7C3AED,#A78BFA)', borderRadius: 99, animation: 'loadingBar 1.4s ease-in-out infinite' }} />
      </div>
    </div>
  )

  if (rateLimit.active) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px 16px', gap: 10 }}>
      <div style={{ fontSize: 44, animation: 'robotWork 0.7s infinite alternate' }}>🤖</div>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#7C3AED' }}>Trabajando con otros farmers...</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>La IA está ocupada ahora mismo.<br/>Se reintentará automáticamente en:</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED18,#6D28D908)', border: '3px solid #7C3AED55', fontSize: 24, fontWeight: 900, color: '#7C3AED' }}>
        {rateLimit.secondsLeft}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>segundos</div>
      <button onClick={() => { setRateLimit({ active: false, secondsLeft: 0 }); loadRec(true) }}
        style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
        ↺ Reintentar ahora
      </button>
    </div>
  )

  if (aiError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24, gap: 10 }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', lineHeight: 1.5 }}>{aiError}</div>
      <button onClick={loadRec} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>↺ Reintentar</button>
    </div>
  )

  if (!aiRec) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24, gap: 12 }}>
      <div style={{ fontSize: 44 }}>🎯</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textAlign: 'center' }}>Plan de acción del día</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, maxWidth: 240 }}>
        La IA analiza tu cartera completa: onboarding crítico, AVA baja, churn y más. Genera tu plan en segundos.
      </div>
      <button onClick={loadRec} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px #7C3AED55' }}>
        ✨ Analizar cartera ahora
      </button>
    </div>
  )

  if (aiRec.allDone) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '28px 20px', gap: 10 }}>
      <div style={{ fontSize: 52 }}>🎉</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: '#22C55E' }}>¡Todo gestionado hoy!</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
        Atendiste todas las tiendas sugeridas.<br/>Excelente trabajo hoy. 💪
      </div>
      <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', fontSize: 13, fontWeight: 700, color: '#16A34A' }}>
        {total} tiendas gestionadas ✅
      </div>
    </div>
  )

  const priorities = aiRec.priorities ?? []

  const q = search.trim().toLowerCase()
  const filtered = q
    ? priorities.filter(p =>
        p.storeName?.toLowerCase().includes(q) ||
        p.storeCode?.toLowerCase().includes(q) ||
        p.reason?.toLowerCase().includes(q)
      )
    : priorities

  const pending  = filtered.filter(p => !aiRec.managedResults?.[p.storeCode] && !managedCodes.has(p.storeCode))
  const done     = filtered.filter(p =>  aiRec.managedResults?.[p.storeCode] ||  managedCodes.has(p.storeCode))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Stats bar */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Mensaje de la IA */}
        <div style={{ fontSize: 11.5, color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(109,40,217,0.03))', border: '1px solid rgba(124,58,237,0.15)' }}>
          {aiRec.message}
        </div>
        {/* Métricas rápidas */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <StatPill value={total}   label="Total"    color="#7C3AED" />
          <StatPill value={alta}    label="Urgentes" color="#EF4444" />
          <StatPill value={managed} label="Hechas"   color="#22C55E" />
          <StatPill value={pending.length} label="Pendientes" color="#F97316" />
        </div>
        {/* Barra de progreso */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(124,58,237,0.1)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#22C55E' : 'linear-gradient(90deg,#7C3AED,#A78BFA)', borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>{progress}%</span>
        </div>
        {/* Buscador inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px' }}>
          <span style={{ fontSize: 12, opacity: 0.5 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tienda, código o motivo..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 11 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>
          )}
        </div>
        {q && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>}
      </div>

      {/* Lista de prioridades */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {q && filtered.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center', padding: 20 }}>Sin resultados para "{search}"</div>
        )}
        {/* Pendientes primero */}
        {pending.map((p, i) => (
          <PriorityCard
            key={p.storeCode ?? i}
            p={p}
            isManaged={false}
            result={null}
            onManage={e => onManage(p.storeCode, e)}
          />
        ))}
        {/* Gestionadas al final */}
        {done.map((p, i) => (
          <PriorityCard
            key={`done-${p.storeCode ?? i}`}
            p={p}
            isManaged={true}
            result={aiRec.managedResults?.[p.storeCode]}
            onManage={null}
          />
        ))}
      </div>
    </div>
  )
}

function StatPill({ value, label, color }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 6px', borderRadius: 8, background: color + '10', border: `1px solid ${color}25` }}>
      <span style={{ fontSize: 15, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 1 }}>{label}</span>
    </div>
  )
}

/* ── Componente principal ───────────────────────────────────────────────── */
const PANEL_W = 460
const PANEL_H = 600
const ROBOT_H = 128 // altura del robot (sin burbuja, que se oculta cuando está abierto)

export default function AiAssistant() {
  const { user } = useAuth()
  const farmerName = user?.nickname || user?.fullName?.split(' ')[0] || null

  const [open,         setOpen]        = useState(false)
  const [tab,          setTab]         = useState('rec')
  const [aiRec,        setAiRec]       = useState(() => getCached())
  const [aiLoading,    setAiLoading]   = useState(false)
  const [aiError,      setAiError]     = useState(null)
  const [chatHistory,  setChatHistory] = useState([])
  const [chatInput,    setChatInput]   = useState('')
  const [chatLoading,  setChatLoading] = useState(false)
  const [chatCooldown, setChatCooldown]= useState(false)
  const cooldownRef    = useRef(null)
  const [pos,          setPos]         = useState({ x: 24, y: 0 })
  const [dragging,     setDragging]    = useState(false)
  const [ctxMenu,      setCtxMenu]     = useState({ visible: false, x: 0, y: 0, storeCode: null, data: null, loading: false })
  const [managedCodes, setManagedCodes]= useState(new Set())
  const [rateLimit,    setRateLimit]   = useState({ active: false, secondsLeft: 0 })
  const rateLimitTimer = useRef(null)
  const dragStart      = useRef(null)
  const chatEndRef     = useRef(null)

  useEffect(() => {
    setPos({ x: window.innerWidth - 150, y: window.innerHeight - 210 })
  }, [])

  // Drag
  const onMouseDown = e => {
    e.preventDefault()
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y }
    setDragging(true)
  }
  useEffect(() => {
    if (!dragging) return
    const move = e => setPos({ x: dragStart.current.ox + (e.clientX - dragStart.current.mx), y: dragStart.current.oy + (e.clientY - dragStart.current.my) })
    const up   = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => () => { if (cooldownRef.current) clearTimeout(cooldownRef.current) }, [])

  // Rate limit countdown
  useEffect(() => {
    if (!rateLimit.active) return
    if (rateLimit.secondsLeft <= 0) { setRateLimit({ active: false, secondsLeft: 0 }); loadRec(true); return }
    rateLimitTimer.current = setTimeout(() => setRateLimit(prev => ({ ...prev, secondsLeft: prev.secondsLeft - 1 })), 1000)
    return () => clearTimeout(rateLimitTimer.current)
  }, [rateLimit.active, rateLimit.secondsLeft])

  useEffect(() => {
    if (!ctxMenu.visible) return
    const close = () => setCtxMenu(m => ({ ...m, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu.visible])

  const openCtxForCode = useCallback(async (storeCode, x, y) => {
    setCtxMenu({ visible: true, x, y, storeCode, data: null, loading: true })
    try {
      const { data } = await api.get(`/stores/by-code/${storeCode}`)
      setCtxMenu(m => ({ ...m, data, loading: false }))
    } catch {
      setCtxMenu(m => ({ ...m, loading: false, data: null }))
    }
  }, [])

  const onRowCtx = useCallback(async (e, rowTextOrCode) => {
    e.preventDefault(); e.stopPropagation()
    const direct    = /^[A-Z]{2}_?\d{4,}$/i.test(rowTextOrCode)
    const storeCode = direct ? rowTextOrCode.toUpperCase() : (rowTextOrCode.match(/[A-Z]{2}_?\d{4,}/i)?.[0]?.toUpperCase() ?? null)
    if (!storeCode) return
    openCtxForCode(storeCode, e.clientX, e.clientY)
  }, [openCtxForCode])

  const handleCardManage = useCallback((storeCode, e) => {
    const x = e?.clientX ?? window.innerWidth  / 2 - 180
    const y = e?.clientY ?? window.innerHeight / 2 - 200
    openCtxForCode(storeCode, x, y)
  }, [openCtxForCode])

  const loadRec = useCallback(async (force = false) => {
    // Servir desde caché si existe y no se fuerza recarga
    if (!force) {
      const cached = getCached()
      if (cached) { setAiRec(cached); if (cached.managedResults) setManagedCodes(new Set(Object.keys(cached.managedResults))); return }
    }
    setAiLoading(true); setAiError(null)
    try {
      const res  = await api.get('/ai/recommend', { timeout: 45000 })
      const data = res.data
      if (data.rateLimited) { setRateLimit({ active: true, secondsLeft: data.retryAfterSeconds || 30 }); return }
      setCache(data)
      setAiRec(data)
      if (data.managedResults) setManagedCodes(new Set(Object.keys(data.managedResults)))
    } catch (e) {
      const d = e.response?.data
      if (e.response?.status === 429 || d?.rateLimited) setRateLimit({ active: true, secondsLeft: d?.retryAfterSeconds || 30 })
      else setAiError(d?.error || 'Error al cargar recomendación')
    } finally { setAiLoading(false) }
  }, [])

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading || chatCooldown) return
    const userMsg    = { role: 'user', content: chatInput.trim() }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory); setChatInput(''); setChatLoading(true)
    try {
      const { data } = await api.post('/ai/chat', { history: newHistory.slice(-2), message: userMsg.content }, { timeout: 30000 })
      setChatHistory(h => [...h, { role: 'assistant', content: data.reply }])
    } catch (e) {
      const msg = e.response?.status === 429
        ? '⏳ Límite de velocidad — espera unos segundos e intenta de nuevo.'
        : '⚠️ ' + (e.response?.data?.error || 'Error al conectar con la IA')
      setChatHistory(h => [...h, { role: 'assistant', content: msg }])
    } finally {
      setChatLoading(false); setChatCooldown(true)
      cooldownRef.current = setTimeout(() => setChatCooldown(false), 8000)
    }
  }, [chatInput, chatHistory, chatLoading])

  const toggleOpen = () => {
    if (!open) { setOpen(true); if (!aiRec && tab === 'rec') loadRec() }
    else setOpen(false)
  }

  const switchTab = (k) => {
    setTab(k)
    if (k === 'rec' && !aiRec && !aiLoading) loadRec()
  }

  // ── Posición del panel: arriba o abajo del robot ──────────────────────
  const openAbove  = pos.y + ROBOT_H + PANEL_H > window.innerHeight
  // Offset horizontal para que el panel no salga de pantalla
  const panelLeft  = Math.min(pos.x, window.innerWidth - PANEL_W) - pos.x
  const panelVertical = openAbove
    ? { bottom: ROBOT_H + 8, top: 'auto' }
    : { top: ROBOT_H + 8,   bottom: 'auto' }

  return (
    <>
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}>
        <RobotButton open={open} dragging={dragging} onMouseDown={onMouseDown} onClick={!dragging ? toggleOpen : undefined} farmerName={farmerName} />

        {/* Panel */}
        {open && (
          <div style={{
            position: 'absolute',
            left: panelLeft,
            ...panelVertical,
            width: PANEL_W,
            height: PANEL_H,
            background: 'var(--bg-card)',
            border: '1.5px solid #7C3AED44',
            borderRadius: 16,
            boxShadow: '0 12px 48px #7C3AED2A, 0 2px 12px #0004',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7C3AED12,#6D28D906)', borderBottom: '1px solid #7C3AED1A', flexShrink: 0, userSelect: 'none' }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <span style={{ flex: 1, fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Asistente IA</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[['rec', '📊 Hoy'], ['chat', '💬 Chat']].map(([k, l]) => (
                  <button key={k} onClick={() => switchTab(k)} style={{ padding: '4px 11px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: tab === k ? '#7C3AED' : 'transparent', color: tab === k ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>{l}</button>
                ))}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
            </div>

            {/* Tab Rec */}
            {tab === 'rec' && (
              <RecTab
                aiRec={aiRec} aiLoading={aiLoading} aiError={aiError}
                rateLimit={rateLimit} setRateLimit={setRateLimit} loadRec={loadRec}
                managedCodes={managedCodes}
                onManage={handleCardManage}
              />
            )}

            {/* Tab Chat */}
            {tab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', paddingBottom: 2 }}>
                  💡 Clic derecho en filas de tabla · Consulta toda tu cartera
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, padding: '2px 1px' }}>
                  {chatHistory.length === 0 && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11, padding: '8px 4px' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>💬 Pregunta lo que necesites:</div>
                      {[
                        '¿Cuántas tiendas tengo en churn?',
                        '¿Qué tiendas tienen AVA menor al 40%?',
                        'Muéstrame las tiendas de 1 a 7 días sin HO',
                        '¿Cuáles son mis IS de hoy?',
                        'Dame las tiendas con más días sin seguimiento',
                      ].map(q => (
                        <div key={q} onClick={() => { if (!chatLoading && !chatCooldown) setChatInput(q) }}
                          style={{ cursor: 'pointer', padding: '5px 8px', borderRadius: 6, marginBottom: 4, background: 'var(--bg-input)', border: '1px solid var(--border)', color: '#7C3AED', fontStyle: 'italic', fontSize: 11, transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}
                        >{q}</div>
                      ))}
                    </div>
                  )}
                  {chatHistory.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '93%', padding: '8px 11px', borderRadius: 11, background: m.role === 'user' ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'var(--bg-input)', color: m.role === 'user' ? '#fff' : 'var(--text-primary)', fontSize: 12, lineHeight: 1.5, border: m.role === 'assistant' ? '1px solid var(--border)' : 'none', userSelect: 'text' }}>
                        {m.role === 'assistant' ? <Md onRowCtx={onRowCtx}>{m.content}</Md> : m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex' }}>
                      <div style={{ padding: '8px 12px', borderRadius: 11, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}>⏳ Pensando...</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                    placeholder="Pregunta algo..."
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
                  />
                  <button onClick={sendChat} disabled={chatLoading || chatCooldown || !chatInput.trim()} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: chatLoading || chatCooldown || !chatInput.trim() ? 'var(--bg-input)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: chatLoading || chatCooldown || !chatInput.trim() ? 'var(--text-secondary)' : '#fff', fontWeight: 700, fontSize: 13, cursor: chatLoading || chatCooldown || !chatInput.trim() ? 'default' : 'pointer' }}>
                    {chatCooldown ? '⏳' : '↑'}
                  </button>
                  {chatHistory.length > 0 && (
                    <button onClick={() => setChatHistory([])} style={{ padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <StoreContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(m => ({ ...m, visible: false }))}
        onManaged={code => {
          setManagedCodes(prev => new Set([...prev, code]))
          invalidateCache()
          setTimeout(() => loadRec(true), 800)
        }}
      />

      <style>{`
        @keyframes bubbleBounce { 0%,100%{transform:translateY(0) scale(1)} 40%{transform:translateY(-4px) scale(1.03)} 70%{transform:translateY(-1px) scale(0.99)} }
        @keyframes ringPulse    { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.4);opacity:0} }
        @keyframes robotWork    { 0%{transform:translateY(0) rotate(-8deg)} 100%{transform:translateY(-6px) rotate(8deg)} }
        @keyframes loadingBar   { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>
    </>
  )
}
