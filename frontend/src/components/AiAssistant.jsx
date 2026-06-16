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

/* ── Context menu (clic derecho sobre fila de tabla) ───────────────────── */
function StoreContextMenu({ menu, onClose }) {
  if (!menu.visible) return null
  const d = menu.data

  // Ajustar posición si se sale de la pantalla
  const left = Math.min(menu.x, window.innerWidth - 310)
  const top  = Math.min(menu.y, window.innerHeight - 340)

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', left, top, zIndex: 99999,
        background: 'var(--bg-card,#fff)',
        border: '1.5px solid rgba(124,58,237,0.4)',
        borderRadius: 12,
        padding: '12px 14px',
        minWidth: 280, maxWidth: 310,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        fontSize: 12,
        userSelect: 'text',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary,#111)' }}>
          {menu.loading ? 'Cargando...' : d ? d.storeName : 'No encontrada'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary,#888)', padding: '0 2px' }}>✕</button>
      </div>

      {menu.loading && <div style={{ color: 'var(--text-secondary,#888)', fontSize: 12 }}>Buscando tienda...</div>}

      {!menu.loading && d && (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 10px', alignItems: 'start' }}>
          {[
            ['Código',        d.storeCode],
            ['Brand ID',      d.brandId],
            ['Store ID',      d.id],
            ['Teléfono',      d.phoneNumber],
            ['Canal',         d.channel],
            ['Aging',         `${d.aging} días (${d.agingStage})`],
            ['Onboarding',    d.onboardingDate],
            ['Estado',        d.currentStatus],
            ['HO activado',   d.hadHandoff ? '✅ Sí' : '❌ No'],
            ['AVA MTD',       d.connectionPct != null ? `${d.connectionPct}%` : '—'],
            ['Último FU',     d.lastFollowUp],
            ['FU 30d',        d.followUpLast30d],
            ['Gestionar',     d.gestionar],
          ].map(([label, val]) => (
            val && val !== '—' ? [
              <span key={label + '_l'} style={{ color: 'var(--text-secondary,#888)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>,
              <span key={label + '_v'} style={{ fontWeight: 600, color: 'var(--text-primary,#111)', wordBreak: 'break-all' }}>{String(val)}</span>
            ] : null
          ))}
        </div>
      )}

      {!menu.loading && !d && (
        <div style={{ color: 'var(--text-secondary,#888)', fontSize: 12 }}>
          Código no encontrado. Asegúrate de hacer clic derecho en una fila con código PE.
        </div>
      )}
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
  const [pos,         setPos]        = useState({ x: 24, y: 0 })
  const [dragging,    setDragging]   = useState(false)
  const [ctxMenu,     setCtxMenu]    = useState({ visible: false, x: 0, y: 0, storeCode: null, data: null, loading: false })
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

  // Cerrar ctx menu al hacer click en cualquier lugar
  useEffect(() => {
    if (!ctxMenu.visible) return
    const close = () => setCtxMenu(m => ({ ...m, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu.visible])

  // Clic derecho en fila de tabla → buscar tienda
  const onRowCtx = useCallback(async (e, rowText) => {
    e.preventDefault()
    e.stopPropagation()
    const match = rowText.match(/PE\d{4,}/i)
    if (!match) return
    const storeCode = match[0].toUpperCase()
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
      const { data } = await api.get('/ai/recommend', { timeout: 30000 })
      setAiRec(data)
    } catch (e) {
      setAiError(e.response?.data?.error || 'Error al cargar recomendación')
    } finally { setAiLoading(false) }
  }, [])

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user', content: chatInput.trim() }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setChatInput('')
    setChatLoading(true)
    try {
      const { data } = await api.post('/ai/chat', { history: newHistory.slice(-8), message: userMsg.content }, { timeout: 30000 })
      setChatHistory(h => [...h, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setChatHistory(h => [...h, { role: 'assistant', content: '⚠️ ' + (e.response?.data?.error || 'Error') }])
    } finally { setChatLoading(false) }
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
        <div
          onMouseDown={onMouseDown}
          onClick={!dragging ? toggleOpen : undefined}
          title="Asistente IA — arrastra para mover"
          style={{
            cursor: dragging ? 'grabbing' : 'grab',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            userSelect: 'none',
            filter: open ? 'drop-shadow(0 0 18px #7C3AED88)' : 'drop-shadow(0 4px 12px #0006)',
            transition: 'filter 0.2s',
          }}
        >
          {!open && (
            <div style={{
              background: 'linear-gradient(135deg,#7C3AED,#6D28D9)',
              color: '#fff', borderRadius: 12, padding: '5px 10px',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
              marginBottom: 4, boxShadow: '0 2px 12px #7C3AED55',
              animation: 'bounce 2s infinite',
            }}>
              ¿Qué ataco hoy? 🎯
            </div>
          )}
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: open ? 'linear-gradient(135deg,#7C3AED,#4C1D95)' : 'linear-gradient(135deg,#6D28D9,#7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 34, boxShadow: open ? '0 0 0 4px #7C3AED55, 0 8px 24px #7C3AED44' : '0 4px 20px #0004',
            border: '3px solid ' + (open ? '#A78BFA' : '#fff2'),
            transition: 'all 0.25s',
          }}>🤖</div>
        </div>

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
                    <div style={{ padding: '10px 12px', borderRadius: 9, background: 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(109,40,217,0.04))', border: '1px solid rgba(124,58,237,0.18)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                      {aiRec.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                      <button onClick={loadRec} disabled={aiLoading} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #7C3AED44', background: 'transparent', color: '#7C3AED', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        🔄 Actualizar
                      </button>
                    </div>
                    {aiRec.priorities?.length > 0 && aiRec.priorities.map((p, i) => (
                      <div key={p.storeCode ?? i} style={{
                        padding: '8px 10px', borderRadius: 9, marginBottom: 6,
                        background: i % 2 === 0 ? 'var(--bg-input)' : 'transparent',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{
                            padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 800,
                            background: p.priority === 'ALTA' ? 'rgba(239,68,68,0.12)' : p.priority === 'MEDIA' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                            color: p.priority === 'ALTA' ? '#EF4444' : p.priority === 'MEDIA' ? '#F97316' : '#22C55E',
                          }}>{p.priority}</span>
                          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{p.storeName}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{p.storeCode}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>📌 {p.reason}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>→ {p.action}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Tab: Chat */}
            {tab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', paddingBottom: 2 }}>
                  💡 Clic derecho en filas de tabla para ver detalle de tienda
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, padding: '2px 1px' }}>
                  {chatHistory.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, margin: 'auto', padding: 16 }}>
                      Pregunta sobre tu cartera:<br />
                      <span style={{ color: '#7C3AED', fontStyle: 'italic' }}>"¿Qué tiendas atacar primero?"</span>
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
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
                    padding: '8px 14px', borderRadius: 7, border: 'none',
                    background: chatLoading || !chatInput.trim() ? 'var(--bg-input)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                    color: chatLoading || !chatInput.trim() ? 'var(--text-secondary)' : '#fff',
                    fontWeight: 700, fontSize: 13, cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer',
                  }}>↑</button>
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
      <StoreContextMenu menu={ctxMenu} onClose={() => setCtxMenu(m => ({ ...m, visible: false }))} />

      <style>{`
        @keyframes bounce {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-5px)}
        }
      `}</style>
    </>
  )
}
