import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../services/api'

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
        tr: ({ children: c, node }) => (
          <tr
            onContextMenu={onRowCtx ? e => {
              const txt = e.currentTarget.textContent || ''
              onRowCtx(e, txt)
            } : undefined}
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

/* ── Helpers visuales ───────────────────────────────────────────────────── */
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

/* ── Context menu (clic derecho sobre fila de tabla o tarjeta) ──────────── */
function StoreContextMenu({ menu, onClose, onManaged }) {
  const [tipo,      setTipo]      = useState('LLAMADA')
  const [resultado, setResultado] = useState('')
  const [comentario,setComentario]= useState('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Resetear form al abrir nueva tienda
  useEffect(() => {
    if (menu.visible) { setTipo('LLAMADA'); setResultado(''); setComentario(''); setSaved(false); setSaveError(null) }
  }, [menu.storeCode, menu.visible])

  if (!menu.visible) return null
  const d = menu.data

  const left = Math.min(menu.x + 8, window.innerWidth  - 380)
  const top  = Math.min(menu.y,     window.innerHeight - 580)

  const hasHo  = d?.hadHandoff === 'true' || d?.hadHandoff === true
  const aging  = d?.aging ? parseInt(d.aging) : null
  const agingColor = aging != null
    ? (aging <= 7 ? '#EF4444' : aging <= 14 ? '#F97316' : '#22C55E')
    : '#94A3B8'

  const ava = d?.connectionPct && d.connectionPct !== '—' ? parseFloat(d.connectionPct) : null
  const avaColor = ava != null ? (ava < 30 ? '#EF4444' : ava < 60 ? '#F97316' : '#22C55E') : '#94A3B8'

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
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', left, top, zIndex: 99999,
        width: 360,
        background: 'var(--bg-card,#fff)',
        border: '1.5px solid rgba(124,58,237,0.35)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(124,58,237,0.12)',
        fontSize: 12,
        userSelect: 'text',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#7C3AED18,#6D28D908)',
        borderBottom: '1px solid rgba(124,58,237,0.15)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {menu.loading
            ? <div style={{ height: 16, background: 'rgba(128,128,128,0.15)', borderRadius: 4, marginBottom: 4 }} />
            : <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary,#111)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d ? d.storeName : '⚠️ No encontrada'}
              </div>
          }
          {d && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(124,58,237,0.12)', color: '#7C3AED',
                borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{d.storeCode}</span>
              {aging != null && (
                <span style={{ background: agingColor + '18', color: agingColor,
                  borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                  {aging}d · {d.agingStage || '—'}
                </span>
              )}
              <span style={{ background: hasHo ? '#22C55E18' : '#EF444418',
                color: hasHo ? '#22C55E' : '#EF4444',
                borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                {hasHo ? '✅ HO' : '❌ Sin HO'}
              </span>
              {ava != null && (
                <span style={{ background: avaColor + '18', color: avaColor,
                  borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                  AVA {ava}%
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, color: 'var(--text-secondary,#888)', padding: 2, flexShrink: 0, lineHeight: 1 }}>✕</button>
      </div>

      {menu.loading && (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-secondary,#888)' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⏳</div>
          Buscando tienda...
        </div>
      )}

      {!menu.loading && !d && (
        <div style={{ padding: '16px 14px', color: 'var(--text-secondary,#888)', textAlign: 'center', fontSize: 12 }}>
          Código PE no encontrado en la base de datos.
        </div>
      )}

      {!menu.loading && d && (
        <div>
          {/* Info de la tienda */}
          <div style={{ padding: '8px 14px 4px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
              color: '#7C3AED', letterSpacing: '0.8px', marginBottom: 4 }}>📋 Información</div>
            <InfoRow label="Canal"      value={d.channel} />
            <InfoRow label="Teléfono"   value={d.phoneNumber} />
            <InfoRow label="Brand ID"   value={d.brandId} />
            <InfoRow label="Onboarding" value={d.onboardingDate} />
            <InfoRow label="Estado"     value={d.currentStatus}
              accent={d.currentStatus?.toLowerCase().includes('churn') ? '#EF4444' : undefined} />
            <InfoRow label="Último FU"  value={d.lastFollowUp} />
            <InfoRow label="FU 30d"     value={d.followUpLast30d}
              accent={d.followUpLast30d === 'NO' ? '#EF4444' : '#22C55E'} />
            <InfoRow label="Gestionar"  value={d.gestionar}
              accent={d.gestionar?.toUpperCase() === 'IS' ? '#EF4444' : '#7C3AED'} />
          </div>

          {/* Separador */}
          <div style={{ height: 1, background: 'rgba(124,58,237,0.15)', margin: '6px 0' }} />

          {/* Registrar gestión */}
          <div style={{ padding: '8px 14px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
              color: '#7C3AED', letterSpacing: '0.8px', marginBottom: 8 }}>⚡ Registrar gestión</div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
              {TIPO_OPTS.map(o => (
                <button key={o.value} onClick={() => setTipo(o.value)} style={{
                  padding: '3px 8px', borderRadius: 6, border: '1.5px solid',
                  borderColor: tipo === o.value ? '#7C3AED' : 'var(--border,#e5e7eb)',
                  background:  tipo === o.value ? '#7C3AED' : 'transparent',
                  color:       tipo === o.value ? '#fff' : 'var(--text-secondary,#888)',
                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}>{o.label}</button>
              ))}
            </div>

            {/* Resultado */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
              {RESULTADO_OPTS.map(o => (
                <button key={o.value} onClick={() => setResultado(o.value)} style={{
                  padding: '3px 8px', borderRadius: 6, border: '1.5px solid',
                  borderColor: resultado === o.value ? o.color : 'var(--border,#e5e7eb)',
                  background:  resultado === o.value ? o.color + '22' : 'transparent',
                  color:       resultado === o.value ? o.color : 'var(--text-secondary,#888)',
                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}>{o.label}</button>
              ))}
            </div>

            {/* Comentario */}
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder="Comentario obligatorio..."
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 8px', borderRadius: 7,
                border: '1.5px solid var(--border,#e5e7eb)',
                background: 'var(--bg-input,#f9f9f9)',
                color: 'var(--text-primary,#111)',
                fontSize: 11, resize: 'none', outline: 'none',
                fontFamily: 'inherit', marginBottom: 7,
              }}
            />

            {saveError && <div style={{ color: '#EF4444', fontSize: 11, marginBottom: 6 }}>⚠️ {saveError}</div>}
            {saved     && <div style={{ color: '#22C55E', fontSize: 11, marginBottom: 6 }}>✅ Gestión registrada</div>}

            <button
              onClick={handleSave}
              disabled={!resultado || !comentario.trim() || saving}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 8, border: 'none',
                background: !resultado || !comentario.trim() || saving
                  ? 'var(--bg-input,#e5e7eb)'
                  : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                color: !resultado || !comentario.trim() || saving ? 'var(--text-secondary,#888)' : '#fff',
                fontWeight: 800, fontSize: 12, cursor: !resultado || !comentario.trim() || saving ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {saving ? '⏳ Guardando...' : '💾 Registrar gestión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Robot Button ───────────────────────────────────────────────────────── */
const TIPS = [
  '¿Qué ataco hoy? 🎯',
  'Tengo tu cartera lista 📋',
  '¡Hagámoslo! 💪',
  'Checa tus IS 👀',
  'Onboarding crítico ⚠️',
  'Soy tu copiloto 🚀',
]

function RobotButton({ open, dragging, onMouseDown, onClick }) {
  const [hovered,  setHovered]  = useState(false)
  const [tipIdx,   setTipIdx]   = useState(0)
  const [blink,    setBlink]    = useState(false)
  const [pulse,    setPulse]    = useState(false)

  // Rotar tip cada 4s
  useEffect(() => {
    if (open) return
    const id = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 4000)
    return () => clearInterval(id)
  }, [open])

  // Parpadeo de ojos aleatorio
  useEffect(() => {
    const blink = () => {
      setBlink(true)
      setTimeout(() => setBlink(false), 150)
    }
    const id = setInterval(blink, Math.random() * 2000 + 2000)
    return () => clearInterval(id)
  }, [])

  // Pulso de anillo cada 5s
  useEffect(() => {
    if (open) return
    const id = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 700) }, 5000)
    return () => clearInterval(id)
  }, [open])

  const scale = hovered ? 1.12 : 1
  const rot   = hovered ? (open ? -8 : 8) : 0

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Asistente IA — arrastra para mover"
      style={{
        cursor: dragging ? 'grabbing' : 'grab',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Tooltip burbuja */}
      {!open && (
        <div style={{
          background: hovered
            ? 'linear-gradient(135deg,#6D28D9,#7C3AED)'
            : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
          color: '#fff', borderRadius: 12, padding: '5px 11px',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          marginBottom: 5, boxShadow: hovered ? '0 4px 18px #7C3AED77' : '0 2px 12px #7C3AED55',
          transition: 'all 0.2s',
          transform: hovered ? 'scale(1.06) translateY(-2px)' : 'scale(1)',
          animation: hovered ? 'none' : 'bubbleBounce 2.5s ease-in-out infinite',
        }}>
          {TIPS[tipIdx]}
          {/* Triángulo */}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${hovered ? '#6D28D9' : '#7C3AED'}`,
          }} />
        </div>
      )}

      {/* Anillo de pulso */}
      {pulse && !open && (
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 60, height: 60,
          borderRadius: '50%',
          border: '2px solid #A78BFA',
          animation: 'ringPulse 0.7s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* Cuerpo del robot */}
      <div style={{
        width: 62, height: 62,
        borderRadius: '50%',
        background: open
          ? 'linear-gradient(135deg,#7C3AED,#4C1D95)'
          : hovered
          ? 'linear-gradient(135deg,#8B5CF6,#7C3AED)'
          : 'linear-gradient(135deg,#6D28D9,#7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
        boxShadow: open
          ? '0 0 0 4px #7C3AED55, 0 8px 28px #7C3AED55'
          : hovered
          ? '0 0 0 3px #A78BFA88, 0 10px 30px #7C3AED66'
          : '0 4px 20px #0005',
        border: '3px solid ' + (open ? '#A78BFA' : hovered ? '#C4B5FD' : '#fff2'),
        transform: `scale(${scale}) rotate(${rot}deg)`,
        transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        filter: hovered ? 'brightness(1.1)' : 'brightness(1)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Brillo hover */}
        {hovered && (
          <div style={{
            position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.18) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
        )}
        {/* Ojos personalizados en SVG */}
        <svg width="38" height="38" viewBox="0 0 38 38" style={{ position: 'absolute' }}>
          {/* Cabeza */}
          <rect x="6" y="10" width="26" height="20" rx="6" fill="#fff" fillOpacity="0.13" />
          {/* Antena */}
          <line x1="19" y1="10" x2="19" y2="4" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" />
          <circle cx="19" cy="3" r="2" fill={hovered ? '#F59E0B' : '#A78BFA'} style={{ transition: 'fill 0.2s' }} />
          {/* Ojo izquierdo */}
          <ellipse cx="13" cy="20" rx="3.5" ry={blink ? 0.4 : 3.5} fill="#fff" style={{ transition: 'ry 0.08s' }} />
          <circle cx="13" cy="20" r={blink ? 0 : 1.5} fill={hovered ? '#F59E0B' : '#7C3AED'} style={{ transition: 'all 0.08s' }} />
          {/* Ojo derecho */}
          <ellipse cx="25" cy="20" rx="3.5" ry={blink ? 0.4 : 3.5} fill="#fff" style={{ transition: 'ry 0.08s' }} />
          <circle cx="25" cy="20" r={blink ? 0 : 1.5} fill={hovered ? '#F59E0B' : '#7C3AED'} style={{ transition: 'all 0.08s' }} />
          {/* Boca */}
          <path
            d={hovered
              ? 'M13 28 Q19 33 25 28'
              : open
              ? 'M13 28 Q19 31 25 28'
              : 'M14 28 Q19 30 24 28'}
            stroke="#A78BFA" strokeWidth="2" fill="none" strokeLinecap="round"
            style={{ transition: 'd 0.2s' }}
          />
        </svg>
      </div>
    </div>
  )
}

/* ── Componente principal ───────────────────────────────────────────────── */
export default function AiAssistant() {
  const [open,        setOpen]       = useState(false)
  const [tab,         setTab]        = useState('rec')
  const [aiRec,       setAiRec]      = useState(null)
  const [aiLoading,   setAiLoading]  = useState(false)
  const [aiError,     setAiError]    = useState(null)
  const [chatHistory, setChatHistory]= useState([])
  const [chatInput,   setChatInput]  = useState('')
  const [chatLoading, setChatLoading]= useState(false)
  const [chatCooldown,setChatCooldown]= useState(false)
  const cooldownRef = useRef(null)
  const [pos,         setPos]        = useState({ x: 24, y: 0 })
  const [dragging,    setDragging]   = useState(false)
  const [ctxMenu,     setCtxMenu]    = useState({ visible: false, x: 0, y: 0, storeCode: null, data: null, loading: false })
  const [managedCodes, setManagedCodes] = useState(new Set())
  const [rateLimit,   setRateLimit]    = useState({ active: false, secondsLeft: 0 })
  const rateLimitTimer = useRef(null)
  const dragStart  = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => { setPos({ x: 24, y: window.innerHeight * 0.28 }) }, [])

  // Drag
  const onMouseDown = e => {
    e.preventDefault()
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y }
    setDragging(true)
  }
  useEffect(() => {
    if (!dragging) return
    const move = e => {
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      setPos({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
    }
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // Limpiar cooldown timer al desmontar
  useEffect(() => () => { if (cooldownRef.current) clearTimeout(cooldownRef.current) }, [])

  // Countdown de rate limit — cuenta regresiva y auto-reintenta al llegar a 0
  useEffect(() => {
    if (!rateLimit.active) return
    if (rateLimit.secondsLeft <= 0) {
      setRateLimit({ active: false, secondsLeft: 0 })
      loadRec()
      return
    }
    rateLimitTimer.current = setTimeout(() => {
      setRateLimit(prev => ({ ...prev, secondsLeft: prev.secondsLeft - 1 }))
    }, 1000)
    return () => clearTimeout(rateLimitTimer.current)
  }, [rateLimit.active, rateLimit.secondsLeft])

  // Cerrar ctx menu al hacer click en cualquier lugar
  useEffect(() => {
    if (!ctxMenu.visible) return
    const close = () => setCtxMenu(m => ({ ...m, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu.visible])

  // Clic derecho en fila de tabla o tarjeta → buscar tienda
  const onRowCtx = useCallback(async (e, rowTextOrCode) => {
    e.preventDefault()
    e.stopPropagation()
    // Acepta código directo (ej: "PE1234") o texto de fila con código embebido
    const direct = /^PE\d{4,}$/i.test(rowTextOrCode)
    const storeCode = direct
      ? rowTextOrCode.toUpperCase()
      : (rowTextOrCode.match(/PE\d{4,}/i)?.[0]?.toUpperCase() ?? null)
    if (!storeCode) return
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, storeCode, data: null, loading: true })
    try {
      const { data } = await api.get(`/stores/by-code/${storeCode}`)
      setCtxMenu(m => ({ ...m, data, loading: false }))
    } catch {
      setCtxMenu(m => ({ ...m, loading: false, data: null }))
    }
  }, [])

  const loadRec = useCallback(async () => {
    setAiLoading(true); setAiError(null)
    try {
      const res = await api.get('/ai/recommend', { timeout: 45000 })
      const data = res.data
      if (data.rateLimited) {
        const secs = data.retryAfterSeconds || 30
        setRateLimit({ active: true, secondsLeft: secs })
        setAiLoading(false)
        return
      }
      setAiRec(data)
      if (data.managedResults) {
        setManagedCodes(new Set(Object.keys(data.managedResults)))
      }
    } catch (e) {
      const d = e.response?.data
      if (e.response?.status === 429 || d?.rateLimited) {
        const secs = d?.retryAfterSeconds || 30
        setRateLimit({ active: true, secondsLeft: secs })
      } else {
        setAiError(d?.error || 'Error al cargar recomendación')
      }
    } finally { setAiLoading(false) }
  }, [])

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading || chatCooldown) return
    const userMsg = { role: 'user', content: chatInput.trim() }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setChatInput('')
    setChatLoading(true)
    try {
      const { data } = await api.post('/ai/chat', { history: newHistory.slice(-2), message: userMsg.content }, { timeout: 30000 })
      setChatHistory(h => [...h, { role: 'assistant', content: data.reply }])
    } catch (e) {
      const msg = e.response?.status === 429
        ? '⏳ Límite de velocidad alcanzado — espera unos segundos e intenta de nuevo.'
        : '⚠️ ' + (e.response?.data?.error || 'Error al conectar con la IA')
      setChatHistory(h => [...h, { role: 'assistant', content: msg }])
    } finally {
      setChatLoading(false)
      setChatCooldown(true)
      cooldownRef.current = setTimeout(() => setChatCooldown(false), 8000)
    }
  }, [chatInput, chatHistory, chatLoading])

  const toggleOpen = () => {
    if (!open) { setOpen(true); if (!aiRec && tab === 'rec') loadRec() }
    else setOpen(false)
  }

  const PANEL_W = 440
  const PANEL_H = 540

  return (
    <>
      <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}>

        {/* Robot arrastrable */}
        <RobotButton
          open={open}
          dragging={dragging}
          onMouseDown={onMouseDown}
          onClick={!dragging ? toggleOpen : undefined}
        />

        {/* Panel */}
        {open && (
          <div style={{
            position: 'absolute', top: 68, left: 0,
            width: PANEL_W, height: PANEL_H,
            background: 'var(--bg-card)',
            border: '1.5px solid #7C3AED55',
            borderRadius: 16,
            boxShadow: '0 8px 40px #7C3AED33, 0 2px 8px #0003',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg,#7C3AED18,#6D28D908)',
              borderBottom: '1px solid #7C3AED22',
              userSelect: 'none',
            }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Asistente IA</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {[['rec', '📊 Hoy'], ['chat', '💬 Chat']].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} style={{
                    padding: '3px 10px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: tab === k ? '#7C3AED' : 'transparent',
                    color: tab === k ? '#fff' : 'var(--text-secondary)',
                  }}>{l}</button>
                ))}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
            </div>

            {/* Tab: Recomendados hoy */}
            {tab === 'rec' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', userSelect: 'text' }}>
                {aiLoading && <div style={{ textAlign: 'center', padding: 28, color: 'var(--text-secondary)', fontSize: 12 }}>⏳ Analizando cartera...</div>}
                {aiError && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12 }}>{aiError}</div>}

                {/* Rate limit — robot trabajando con otros farmers */}
                {rateLimit.active && !aiLoading && (
                  <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                    <div style={{
                      fontSize: 52, marginBottom: 8,
                      display: 'inline-block',
                      animation: 'robotWork 0.7s infinite alternate',
                    }}>🤖</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#7C3AED', marginBottom: 6 }}>
                      Trabajando con otros farmers...
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                      La IA está ocupada ahora mismo.<br />Se reintentará automáticamente en:
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 72, height: 72, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#7C3AED18,#6D28D908)',
                      border: '3px solid #7C3AED55',
                      fontSize: 24, fontWeight: 900, color: '#7C3AED',
                      marginBottom: 12,
                    }}>
                      {rateLimit.secondsLeft}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>segundos</div>
                    <button
                      onClick={() => { setRateLimit({ active: false, secondsLeft: 0 }); loadRec() }}
                      style={{
                        marginTop: 14, padding: '7px 18px', borderRadius: 8, border: 'none',
                        background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                        color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                      }}
                    >↺ Reintentar ahora</button>
                  </div>
                )}

                {!aiRec && !aiLoading && !aiError && (
                  <div style={{ textAlign: 'center', padding: 28 }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 14 }}>La IA analiza tu cartera: onboarding crítico, AVA baja y más.</p>
                    <button onClick={loadRec} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      ✨ Analizar cartera
                    </button>
                  </div>
                )}

                {aiRec && (
                  <>
                    {/* Mensaje de cierre del día */}
                    {aiRec.allDone ? (
                      <div style={{
                        textAlign: 'center', padding: '28px 16px',
                        background: 'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(16,185,129,0.04))',
                        borderRadius: 12, border: '1.5px solid rgba(34,197,94,0.3)',
                      }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#22C55E', marginBottom: 6 }}>
                          ¡Atendiste todo lo sugerido hoy!
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          Excelente trabajo. Nos vemos mañana con una nueva cartera.
                        </div>
                      </div>
                    ) : (
                    <>
                    <div style={{ padding: '10px 12px', borderRadius: 9, background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(109,40,217,0.04))', border: '1px solid rgba(124,58,237,0.18)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                      {aiRec.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        {Object.keys(aiRec.managedResults || {}).length}/{aiRec.priorities?.length || 0} gestionadas
                      </span>
                    </div>
                    {(aiRec.priorities?.length > 0) && aiRec.priorities.map((p, i) => {
                      const result = aiRec.managedResults?.[p.storeCode]
                      const isManaged = !!result || managedCodes.has(p.storeCode)
                      const isEfectiva = result === 'EFECTIVA'
                      const isNoContacto = result === 'NO_CONTACTO'
                      const managedBg = isEfectiva ? 'rgba(34,197,94,0.06)' : isNoContacto ? 'rgba(148,163,184,0.08)' : 'rgba(34,197,94,0.06)'
                      const managedBorder = isEfectiva ? 'rgba(34,197,94,0.3)' : isNoContacto ? 'rgba(148,163,184,0.3)' : 'rgba(34,197,94,0.3)'
                      return (
                        <div
                          key={p.storeCode ?? i}
                          onContextMenu={!isManaged && p.storeCode ? e => { e.preventDefault(); onRowCtx(e, p.storeCode) } : undefined}
                          title={!isManaged && p.storeCode ? 'Clic derecho → registrar gestión' : undefined}
                          style={{
                            padding: '8px 10px', borderRadius: 9, marginBottom: 6,
                            background: isManaged ? managedBg : i % 2 === 0 ? 'var(--bg-input)' : 'transparent',
                            border: `1px solid ${isManaged ? managedBorder : 'var(--border)'}`,
                            cursor: !isManaged && p.storeCode ? 'context-menu' : 'default',
                            opacity: isManaged ? 0.75 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isManaged ? 0 : 3 }}>
                            {isEfectiva
                              ? <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>✅ EFECTIVA</span>
                              : isNoContacto
                              ? <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 800, background: 'rgba(148,163,184,0.15)', color: '#64748B' }}>📵 NO CONTACTO</span>
                              : isManaged
                              ? <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>✅ GESTIONADA</span>
                              : <span style={{
                                  padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 800,
                                  background: p.priority === 'ALTA' ? 'rgba(239,68,68,0.12)' : p.priority === 'MEDIA' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                                  color: p.priority === 'ALTA' ? '#EF4444' : p.priority === 'MEDIA' ? '#F97316' : '#22C55E',
                                }}>{p.priority}</span>
                            }
                            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{p.storeName}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.storeCode}</span>
                          </div>
                          {!isManaged && <>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>📌 {p.reason}</p>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>→ {p.action}</p>
                          </>}
                        </div>
                      )
                    })}
                    </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab: Chat */}
            {tab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', paddingBottom: 2 }}>
                  💡 Clic derecho en filas de tabla · Ve toda tu cartera: churn, AVA, IS y más
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
                        <div
                          key={q}
                          onClick={() => { if (!chatLoading && !chatCooldown) { setChatInput(q) } }}
                          style={{
                            cursor: 'pointer', padding: '5px 8px', borderRadius: 6, marginBottom: 4,
                            background: 'var(--bg-input)', border: '1px solid var(--border)',
                            color: '#7C3AED', fontStyle: 'italic', fontSize: 11,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}
                        >{q}</div>
                      ))}
                    </div>
                  )}
                  {chatHistory.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '93%', padding: '8px 11px', borderRadius: 11,
                        background: m.role === 'user' ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'var(--bg-input)',
                        color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                        fontSize: 12, lineHeight: 1.5,
                        border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                        userSelect: 'text',
                      }}>
                        {m.role === 'assistant'
                          ? <Md onRowCtx={onRowCtx}>{m.content}</Md>
                          : m.content}
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
                  <button onClick={sendChat} disabled={chatLoading || chatCooldown || !chatInput.trim()} style={{
                    padding: '8px 14px', borderRadius: 7, border: 'none',
                    background: chatLoading || chatCooldown || !chatInput.trim() ? 'var(--bg-input)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                    color: chatLoading || chatCooldown || !chatInput.trim() ? 'var(--text-secondary)' : '#fff',
                    fontWeight: 700, fontSize: 13, cursor: chatLoading || chatCooldown || !chatInput.trim() ? 'default' : 'pointer',
                    title: chatCooldown ? 'Espera un momento...' : '',
                  }}>{chatCooldown ? '⏳' : '↑'}</button>
                  {chatHistory.length > 0 && (
                    <button onClick={() => setChatHistory([])} style={{ padding: '8px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context menu flotante */}
      <StoreContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(m => ({ ...m, visible: false }))}
        onManaged={code => {
        setManagedCodes(prev => new Set([...prev, code]))
        // Recargar para obtener resultado real (Efectiva/No contacto) desde el servidor
        setTimeout(() => loadRec(), 800)
      }}
      />

      <style>{`
        @keyframes bubbleBounce {
          0%,100%{transform:translateY(0) scale(1)}
          40%{transform:translateY(-4px) scale(1.03)}
          70%{transform:translateY(-1px) scale(0.99)}
        }
        @keyframes ringPulse {
          0%{transform:translateX(-50%) scale(1);opacity:0.8}
          100%{transform:translateX(-50%) scale(2.2);opacity:0}
        }
        @keyframes robotWork {
          0%{transform:translateY(0) rotate(-8deg)}
          100%{transform:translateY(-6px) rotate(8deg)}
        }
      `}</style>
    </>
  )
}
