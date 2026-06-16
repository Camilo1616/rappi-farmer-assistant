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

function RobotSVG({ hovered, open, blink, walkPhase = 0 }) {
  const eyeRy      = blink ? 0.5 : 6.5
  const eyeColor   = hovered ? '#F59E0B' : '#C4B5FD'
  const antennaClr = hovered ? '#F59E0B' : '#A78BFA'

  const SKIN   = '#FBBF8C'
  const SKIN_S = '#F59E5A'
  const SHIRT  = hovered ? '#7C3AED' : '#6D28D9'
  const SHIRT_S= hovered ? '#5B21B6' : '#4C1D95'
  const PANTS  = '#1E3A5F'
  const PANTS_S= '#152B47'
  const SHOE   = '#111827'
  const SHOE_H = '#374151'

  // ── Ciclo de marcha (vista frontal) ──────────────────────────────
  // liftL: qué tan levantada está la pierna izquierda (0=abajo, 1=arriba)
  // liftR: opuesto
  const liftL = Math.max(0,  Math.sin(walkPhase))  // 0–1
  const liftR = Math.max(0, -Math.sin(walkPhase))  // 0–1

  // Pierna izq: rodilla sube y se abre, pie sube y toca el suelo
  const lKX = 37 + liftL * 4;   const lKY = 127 - liftL * 14
  const lFX = 35 + liftL * 6;   const lFY = 141 - liftL * 20
  // Pierna der: opuesta
  const rKX = 63 - liftR * 4;   const rKY = 127 - liftR * 14
  const rFX = 65 - liftR * 6;   const rFY = 141 - liftR * 20

  // Leve rebote del cuerpo (sube en cada paso)
  const bodyBob = -(liftL + liftR) * 2.5

  // ── Brazos ────────────────────────────────────────────────────────
  let lEbX, lEbY, lHdX, lHdY, rEbX, rEbY, rHdX, rHdY
  if (hovered) {
    // Arriba celebrando
    lEbX=8;  lEbY=68; lHdX=5;  lHdY=50
    rEbX=92; rEbY=68; rHdX=95; rHdY=50
  } else if (open) {
    // Wave
    lEbX=6;  lEbY=78; lHdX=2;  lHdY=62
    rEbX=94; rEbY=78; rHdX=98; rHdY=62
  } else {
    // Brazo opuesto a pierna: izq baja cuando pierna izq sube
    const aL = liftL * 12   // cuánto sube el brazo der (y baja el izq)
    const aR = liftR * 12
    lEbX = 16;  lEbY = 90 + aR * 0.3
    lHdX = 11;  lHdY = 106 + aR - aL * 0.5
    rEbX = 84;  rEbY = 90 + aL * 0.3
    rHdX = 89;  rHdY = 106 + aL - aR * 0.5
  }

  const mouthD = hovered
    ? 'M36 52 Q50 63 64 52'
    : open ? 'M36 52 Q50 58 64 52'
    : 'M38 52 Q50 57 62 52'

  return (
    <svg width="100" height="148" viewBox={`0 ${-bodyBob} 100 148`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={hovered ? '#8B5CF6' : '#7C3AED'}/>
          <stop offset="100%" stopColor="#4C1D95"/>
        </linearGradient>
        <linearGradient id="shirtG" x1="50" y1="68" x2="50" y2="114" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={SHIRT}/>
          <stop offset="100%" stopColor={SHIRT_S}/>
        </linearGradient>
        <linearGradient id="pantsG" x1="50" y1="112" x2="50" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={PANTS}/>
          <stop offset="100%" stopColor={PANTS_S}/>
        </linearGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Sombra piso */}
      <ellipse cx="50" cy="146" rx="22" ry="3.5" fill="#0003"/>

      {/* ── ANTENA ── */}
      <line x1="50" y1="11" x2="50" y2="3" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="50" cy="2.5" r="3.5" fill={antennaClr} filter="url(#glow2)" style={{transition:'fill 0.2s'}}>
        {hovered && <animate attributeName="r" values="3.5;5.2;3.5" dur="0.45s" repeatCount="indefinite"/>}
      </circle>

      {/* ── CABEZA ROBOT ── */}
      <rect x="15" y="11" width="70" height="52" rx="14" fill="url(#hg2)" stroke="#A78BFA" strokeWidth="1.5"/>
      <rect x="19" y="15" width="30" height="13" rx="6" fill="#fff" fillOpacity="0.08"/>
      {/* Oreja izq */}
      <rect x="7"  y="23" width="9" height="16" rx="4.5" fill="#5B21B6" stroke="#A78BFA" strokeWidth="1"/>
      <rect x="9"  y="27" width="5" height="8"  rx="2.5" fill="#A78BFA" fillOpacity="0.4"/>
      {/* Oreja der */}
      <rect x="84" y="23" width="9" height="16" rx="4.5" fill="#5B21B6" stroke="#A78BFA" strokeWidth="1"/>
      <rect x="86" y="27" width="5" height="8"  rx="2.5" fill="#A78BFA" fillOpacity="0.4"/>
      {/* Ojo izq */}
      <ellipse cx="34" cy="34" rx="8.5" ry={eyeRy} fill="#1E0A3C" style={{transition:'ry 0.1s'}}/>
      <ellipse cx="34" cy="34" rx="6.5" ry={Math.max(eyeRy-2,0)} fill={eyeColor} style={{transition:'all 0.1s'}}/>
      <circle  cx="37" cy="31" r="2"    fill="#fff" fillOpacity="0.75"/>
      {/* Ojo der */}
      <ellipse cx="66" cy="34" rx="8.5" ry={eyeRy} fill="#1E0A3C" style={{transition:'ry 0.1s'}}/>
      <ellipse cx="66" cy="34" rx="6.5" ry={Math.max(eyeRy-2,0)} fill={eyeColor} style={{transition:'all 0.1s'}}/>
      <circle  cx="69" cy="31" r="2"    fill="#fff" fillOpacity="0.75"/>
      {/* Boca */}
      <path d={mouthD} stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" style={{transition:'d 0.25s'}}/>
      {hovered && <rect x="44" y="53" width="12" height="4" rx="2" fill="#fff" fillOpacity="0.35"/>}

      {/* ── CUELLO — piel ── */}
      <rect x="43" y="63" width="14" height="10" rx="5" fill={SKIN}/>
      <rect x="43" y="68" width="14" height="5"  rx="2" fill={SKIN_S} fillOpacity="0.4"/>

      {/* ── CAMISA — torso ── */}
      {/* Manga izq (camisa) */}
      <path d={`M27 72 L${lEbX+4} ${lEbY} L${lEbX} ${lEbY} L24 72 Z`}
        fill={SHIRT_S} style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      {/* Manga der (camisa) */}
      <path d={`M73 72 L${rEbX-4} ${rEbY} L${rEbX} ${rEbY} L76 72 Z`}
        fill={SHIRT_S} style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      {/* Torso */}
      <rect x="24" y="68" width="52" height="46" rx="10" fill="url(#shirtG)"/>
      {/* Cuello camisa (V-neck) */}
      <path d="M42 68 L50 78 L58 68" fill={SHIRT_S} fillOpacity="0.5"/>
      {/* Pliegue camisa */}
      <line x1="50" y1="78" x2="50" y2="114" stroke={SHIRT_S} strokeWidth="1.2" strokeOpacity="0.35"/>
      {/* Bolsillo izq */}
      <rect x="29" y="80" width="13" height="11" rx="3" fill={SHIRT_S} fillOpacity="0.35" stroke="#A78BFA" strokeWidth="0.6"/>
      {/* Botón */}
      <circle cx="35.5" cy="97" r="2"  fill={SHIRT_S} stroke="#A78BFA" strokeWidth="0.5"/>
      <circle cx="35.5" cy="105" r="2" fill={SHIRT_S} stroke="#A78BFA" strokeWidth="0.5"/>

      {/* ── BRAZOS — piel ── */}
      {/* Upper arm izq */}
      <line x1="26" y1="74" x2={lEbX} y2={lEbY}
        stroke={SKIN_S} strokeWidth="12" strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      <line x1="26" y1="74" x2={lEbX} y2={lEbY}
        stroke={SKIN}  strokeWidth="8"  strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      {/* Forearm izq */}
      <line x1={lEbX} y1={lEbY} x2={lHdX} y2={lHdY}
        stroke={SKIN_S} strokeWidth="10" strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      <line x1={lEbX} y1={lEbY} x2={lHdX} y2={lHdY}
        stroke={SKIN}   strokeWidth="6"  strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      {/* Mano izq */}
      <circle cx={lHdX} cy={lHdY} r="6.5" fill={SKIN}  style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      <circle cx={lHdX} cy={lHdY} r="6.5" fill={SKIN_S} fillOpacity="0.3" style={{transition:'all 0.3s'}}/>
      {hovered && <text x={lHdX} y={lHdY+4} textAnchor="middle" fontSize="8" style={{userSelect:'none'}}>✌️</text>}

      {/* Upper arm der */}
      <line x1="74" y1="74" x2={rEbX} y2={rEbY}
        stroke={SKIN_S} strokeWidth="12" strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      <line x1="74" y1="74" x2={rEbX} y2={rEbY}
        stroke={SKIN}  strokeWidth="8"  strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      {/* Forearm der */}
      <line x1={rEbX} y1={rEbY} x2={rHdX} y2={rHdY}
        stroke={SKIN_S} strokeWidth="10" strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      <line x1={rEbX} y1={rEbY} x2={rHdX} y2={rHdY}
        stroke={SKIN}   strokeWidth="6"  strokeLinecap="round" style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      {/* Mano der */}
      <circle cx={rHdX} cy={rHdY} r="6.5" fill={SKIN}   style={{transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)'}}/>
      <circle cx={rHdX} cy={rHdY} r="6.5" fill={SKIN_S} fillOpacity="0.3" style={{transition:'all 0.3s'}}/>
      {hovered && <text x={rHdX} y={rHdY+4} textAnchor="middle" fontSize="8" style={{userSelect:'none'}}>🤙</text>}

      {/* ── CINTURÓN ── */}
      <rect x="24" y="112" width="52" height="7" rx="3.5" fill="#92400E"/>
      <rect x="44" y="112.5" width="12" height="6" rx="2" fill="#B45309"/>
      <rect x="47" y="113.5" width="6" height="4"  rx="1.5" fill="#F59E0B"/>

      {/* ── PANTALÓN — parte superior ── */}
      <rect x="24" y="117" width="52" height="6" fill="url(#pantsG)"/>
      <line x1="50" y1="117" x2="50" y2="123" stroke={PANTS_S} strokeWidth="1"/>

      {/* Pierna izq — muslo */}
      <line x1="37" y1="123" x2={lKX} y2={lKY}
        stroke={PANTS_S} strokeWidth="14" strokeLinecap="round"/>
      <line x1="37" y1="123" x2={lKX} y2={lKY}
        stroke={PANTS}   strokeWidth="10" strokeLinecap="round"/>
      {/* Pierna izq — pantorrilla */}
      <line x1={lKX} y1={lKY} x2={lFX} y2={lFY}
        stroke={PANTS_S} strokeWidth="12" strokeLinecap="round"/>
      <line x1={lKX} y1={lKY} x2={lFX} y2={lFY}
        stroke={PANTS}   strokeWidth="8"  strokeLinecap="round"/>
      {/* Zapato izq */}
      <ellipse cx={lFX - 2} cy={lFY + 1} rx="11" ry="4.5" fill={SHOE}/>
      <ellipse cx={lFX - 4} cy={lFY}     rx="7"  ry="2.8" fill={SHOE_H} fillOpacity="0.4"/>

      {/* Pierna der — muslo */}
      <line x1="63" y1="123" x2={rKX} y2={rKY}
        stroke={PANTS_S} strokeWidth="14" strokeLinecap="round"/>
      <line x1="63" y1="123" x2={rKX} y2={rKY}
        stroke={PANTS}   strokeWidth="10" strokeLinecap="round"/>
      {/* Pierna der — pantorrilla */}
      <line x1={rKX} y1={rKY} x2={rFX} y2={rFY}
        stroke={PANTS_S} strokeWidth="12" strokeLinecap="round"/>
      <line x1={rKX} y1={rKY} x2={rFX} y2={rFY}
        stroke={PANTS}   strokeWidth="8"  strokeLinecap="round"/>
      {/* Zapato der */}
      <ellipse cx={rFX + 2} cy={rFY + 1} rx="11" ry="4.5" fill={SHOE}/>
      <ellipse cx={rFX}     cy={rFY}     rx="7"  ry="2.8" fill={SHOE_H} fillOpacity="0.4"/>
    </svg>
  )
}

function RobotButton({ open, dragging, onMouseDown, onClick, walkPhase, walkDir }) {
  const [hovered, setHovered] = useState(false)
  const [tipIdx,  setTipIdx]  = useState(0)
  const [blink,   setBlink]   = useState(false)
  const [pulse,   setPulse]   = useState(false)

  useEffect(() => {
    if (open) return
    const id = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 4000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    const doBlink = () => { setBlink(true); setTimeout(() => setBlink(false), 120) }
    const id = setInterval(doBlink, Math.random() * 2500 + 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (open) return
    const id = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 800) }, 4500)
    return () => clearInterval(id)
  }, [open])

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
        userSelect: 'none', position: 'relative',
        filter: open
          ? 'drop-shadow(0 0 18px #7C3AED99)'
          : hovered
          ? 'drop-shadow(0 6px 20px #7C3AED88)'
          : 'drop-shadow(0 4px 14px #0006)',
        transition: 'filter 0.25s',
      }}
    >
      {/* Burbuja de tip */}
      {!open && (
        <div style={{
          position: 'relative',
          background: hovered
            ? 'linear-gradient(135deg,#6D28D9,#7C3AED)'
            : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
          color: '#fff', borderRadius: 12, padding: '5px 12px',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          marginBottom: 6,
          boxShadow: hovered ? '0 4px 20px #7C3AED88' : '0 2px 12px #7C3AED55',
          transform: hovered ? 'scale(1.07) translateY(-3px)' : 'scale(1)',
          animation: hovered ? 'none' : 'bubbleBounce 2.8s ease-in-out infinite',
          transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {TIPS[tipIdx]}
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: '6px solid #7C3AED',
          }} />
        </div>
      )}

      {/* Anillo de pulso */}
      {pulse && !open && (
        <div style={{
          position: 'absolute', bottom: 4, left: '50%',
          width: 80, height: 80, marginLeft: -40,
          borderRadius: '50%', border: '2px solid #A78BFA',
          animation: 'ringPulse 0.8s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      {/* Robot SVG completo */}
      <div style={{
        transform: `scaleX(${walkDir < 0 ? -1 : 1}) ${hovered ? 'scale(1.08) translateY(-4px)' : open ? 'scale(1.04)' : 'scale(1)'}`,
        transition: hovered || open ? 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }}>
        <RobotSVG hovered={hovered} open={open} blink={blink} walkPhase={walkPhase} />
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
  const [walkPhase,   setWalkPhase]    = useState(0)
  const [walkDir,     setWalkDir]      = useState(1)
  const rateLimitTimer = useRef(null)
  const walkRef    = useRef({ dir: 1, phase: 0, dy: 0.45 })
  const rafRef     = useRef(null)
  const dragStart  = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    setPos({ x: 40, y: window.innerHeight * 0.6 })
    // dirección diagonal inicial
    walkRef.current.dy = 0.45
  }, [])

  // Caminata diagonal — rebota en los 4 bordes, cubre toda la pantalla
  useEffect(() => {
    if (open || dragging) { cancelAnimationFrame(rafRef.current); return }
    let lastTs = null
    const tick = ts => {
      if (lastTs === null) { lastTs = ts; rafRef.current = requestAnimationFrame(tick); return }
      const dt = Math.min(ts - lastTs, 50)
      lastTs = ts
      walkRef.current.phase += 0.006 * dt
      const speed = 0.048 * dt
      setPos(prev => {
        let nx = prev.x + walkRef.current.dir * speed
        let ny = prev.y + walkRef.current.dy  * speed
        const maxX = window.innerWidth  - 110
        const maxY = window.innerHeight - 175
        if (nx >= maxX) { nx = maxX; walkRef.current.dir = -1; setWalkDir(-1) }
        if (nx <= 0)    { nx = 0;    walkRef.current.dir =  1; setWalkDir( 1) }
        if (ny >= maxY) { ny = maxY; walkRef.current.dy  = -Math.abs(walkRef.current.dy) }
        if (ny <= 0)    { ny = 0;    walkRef.current.dy  =  Math.abs(walkRef.current.dy) }
        return { x: nx, y: ny }
      })
      setWalkPhase(walkRef.current.phase)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [open, dragging])

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
          walkPhase={walkPhase}
          walkDir={walkDir}
        />

        {/* Panel */}
        {open && (
          <div style={{
            position: 'absolute', top: 188, left: 0,
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
          0%{transform:scale(1);opacity:0.8}
          100%{transform:scale(2.4);opacity:0}
        }
        @keyframes robotFloat {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-6px)}
        }
        @keyframes robotWork {
          0%{transform:translateY(0) rotate(-8deg)}
          100%{transform:translateY(-6px) rotate(8deg)}
        }
      `}</style>
    </>
  )
}
