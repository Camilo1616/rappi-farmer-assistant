import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../services/api'

function Md({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children: c }) => (
          <div style={{ overflowX:'auto', marginBottom:8 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>{c}</table>
          </div>
        ),
        thead: ({ children: c }) => <thead>{c}</thead>,
        tbody: ({ children: c }) => <tbody>{c}</tbody>,
        tr:    ({ children: c }) => <tr>{c}</tr>,
        th:    ({ children: c }) => (
          <th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'2px solid rgba(124,58,237,0.35)', color:'#7C3AED', fontWeight:700, fontSize:11, textTransform:'uppercase', whiteSpace:'nowrap' }}>{c}</th>
        ),
        td:    ({ children: c }) => (
          <td style={{ padding:'6px 8px', borderBottom:'1px solid rgba(128,128,128,0.2)', fontSize:12, color:'var(--text-primary,#111)', verticalAlign:'top' }}>{c}</td>
        ),
        p:      ({ children: c }) => <p style={{ margin:'0 0 6px 0', lineHeight:1.55 }}>{c}</p>,
        ul:     ({ children: c }) => <ul style={{ margin:'0 0 6px 0', paddingLeft:18 }}>{c}</ul>,
        ol:     ({ children: c }) => <ol style={{ margin:'0 0 6px 0', paddingLeft:18 }}>{c}</ol>,
        li:     ({ children: c }) => <li style={{ marginBottom:3 }}>{c}</li>,
        strong: ({ children: c }) => <strong style={{ fontWeight:700 }}>{c}</strong>,
        code:   ({ children: c }) => <code style={{ background:'rgba(0,0,0,0.06)', borderRadius:4, padding:'1px 5px', fontSize:11, fontFamily:'monospace' }}>{c}</code>,
        h3:     ({ children: c }) => <h3 style={{ fontSize:13, fontWeight:700, margin:'8px 0 4px 0', color:'var(--text-primary,#111)' }}>{c}</h3>,
        h4:     ({ children: c }) => <h4 style={{ fontSize:12, fontWeight:700, margin:'6px 0 3px 0' }}>{c}</h4>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export default function AiAssistant() {
  const [open,         setOpen]         = useState(false)
  const [tab,          setTab]          = useState('rec')   // 'rec' | 'chat'
  const [aiRec,        setAiRec]        = useState(null)
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiError,      setAiError]      = useState(null)
  const [chatHistory,  setChatHistory]  = useState([])
  const [chatInput,    setChatInput]    = useState('')
  const [chatLoading,  setChatLoading]  = useState(false)
  const [pos,          setPos]          = useState({ x: 24, y: 0 })
  const [dragging,     setDragging]     = useState(false)
  const dragStart = useRef(null)
  const chatEndRef = useRef(null)

  // Posición vertical inicial: debajo de las métricas (~220px)
  useEffect(() => {
    setPos({ x: 24, y: window.innerHeight * 0.28 })
  }, [])

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

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

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

  const PANEL_W = 420
  const PANEL_H = 520

  return (
    <div style={{ position:'fixed', left: pos.x, top: pos.y, zIndex:9999, userSelect:'none' }}>

      {/* ── Robot arrastrable ── */}
      <div
        onMouseDown={onMouseDown}
        onClick={!dragging ? toggleOpen : undefined}
        title="Asistente IA — arrastra para mover"
        style={{
          cursor: dragging ? 'grabbing' : 'grab',
          display:'flex', flexDirection:'column', alignItems:'center',
          filter: open ? 'drop-shadow(0 0 18px #7C3AED88)' : 'drop-shadow(0 4px 12px #0006)',
          transition:'filter 0.2s',
        }}
      >
        {/* Globo de texto */}
        {!open && (
          <div style={{
            background:'linear-gradient(135deg,#7C3AED,#6D28D9)',
            color:'#fff', borderRadius:12, padding:'6px 12px',
            fontSize:12, fontWeight:700, whiteSpace:'nowrap',
            marginBottom:4, boxShadow:'0 2px 12px #7C3AED55',
            animation:'bounce 2s infinite'
          }}>
            ¿Qué ataco hoy? 🎯
          </div>
        )}

        {/* Cuerpo del robot */}
        <div style={{
          width:64, height:64, borderRadius:'50%',
          background: open
            ? 'linear-gradient(135deg,#7C3AED,#4C1D95)'
            : 'linear-gradient(135deg,#6D28D9,#7C3AED)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:36, boxShadow: open ? '0 0 0 4px #7C3AED55, 0 8px 24px #7C3AED44' : '0 4px 20px #0004',
          border:'3px solid ' + (open ? '#A78BFA' : '#fff2'),
          transition:'all 0.25s',
        }}>
          🤖
        </div>
      </div>

      {/* ── Panel expandido ── */}
      {open && (
        <div style={{
          position:'absolute', top:72, left:0,
          width: PANEL_W, height: PANEL_H,
          background:'var(--bg-card)',
          border:'1.5px solid #7C3AED55',
          borderRadius:16,
          boxShadow:'0 8px 40px #7C3AED33, 0 2px 8px #0003',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding:'12px 16px', display:'flex', alignItems:'center', gap:10,
            background:'linear-gradient(135deg,#7C3AED18,#6D28D908)',
            borderBottom:'1px solid #7C3AED22',
          }}>
            <span style={{ fontSize:20 }}>🤖</span>
            <span style={{ flex:1, fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>Asistente IA</span>
            {/* Tabs */}
            <div style={{ display:'flex', gap:4 }}>
              {[['rec','📊 Hoy'],['chat','💬 Chat']].map(([k,l]) => (
                <button key={k} onClick={() => setTab(k)} style={{
                  padding:'4px 12px', borderRadius:8, border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                  background: tab===k ? '#7C3AED' : 'transparent',
                  color: tab===k ? '#fff' : 'var(--text-secondary)',
                }}>{l}</button>
              ))}
            </div>
            <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', fontSize:18, lineHeight:1, padding:'0 4px' }}>✕</button>
          </div>

          {/* Tab: Recomendados */}
          {tab === 'rec' && (
            <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
              {aiLoading && <div style={{ textAlign:'center', padding:32, color:'var(--text-secondary)', fontSize:13 }}>⏳ Analizando tu cartera...</div>}
              {aiError && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,0.08)', color:'#EF4444', fontSize:13 }}>{aiError}</div>}

              {!aiRec && !aiLoading && !aiError && (
                <div style={{ textAlign:'center', padding:32 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
                  <p style={{ color:'var(--text-secondary)', fontSize:13, marginBottom:16 }}>La IA analiza tu cartera y te dice qué tiendas atacar hoy.</p>
                  <button onClick={loadRec} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#7C3AED,#6D28D9)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    ✨ Analizar mi cartera
                  </button>
                </div>
              )}

              {aiRec && (
                <>
                  <div style={{ padding:'12px 14px', borderRadius:10, background:'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(109,40,217,0.04))', border:'1px solid rgba(124,58,237,0.18)', color:'var(--text-primary)', fontSize:13, lineHeight:1.6, marginBottom:14 }}>
                    {aiRec.message}
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
                    <button onClick={loadRec} disabled={aiLoading} style={{ padding:'5px 14px', borderRadius:8, border:'1.5px solid #7C3AED44', background:'transparent', color:'#7C3AED', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      🔄 Actualizar
                    </button>
                  </div>
                  {aiRec.priorities?.length > 0 && aiRec.priorities.map((p, i) => (
                    <div key={p.storeCode ?? i} style={{
                      padding:'10px 12px', borderRadius:10, marginBottom:8,
                      background: i%2===0 ? 'var(--bg-input)' : 'transparent',
                      border:'1px solid var(--border)',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{
                          padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:800,
                          background: p.priority==='ALTA' ? 'rgba(239,68,68,0.12)' : p.priority==='MEDIA' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                          color: p.priority==='ALTA' ? '#EF4444' : p.priority==='MEDIA' ? '#F97316' : '#22C55E',
                        }}>{p.priority}</span>
                        <span style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>{p.storeName}</span>
                        <span style={{ fontSize:11, color:'var(--text-secondary)', marginLeft:'auto' }}>{p.storeCode}</span>
                      </div>
                      <p style={{ margin:0, fontSize:12, color:'var(--text-secondary)', marginBottom:3 }}>📌 {p.reason}</p>
                      <p style={{ margin:0, fontSize:12, color:'var(--text-primary)', fontWeight:600 }}>→ {p.action}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Tab: Chat */}
          {tab === 'chat' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'12px 14px', gap:10, overflow:'hidden' }}>
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, padding:'4px 2px' }}>
                {chatHistory.length === 0 && (
                  <div style={{ textAlign:'center', color:'var(--text-secondary)', fontSize:13, margin:'auto', padding:20 }}>
                    Pregunta sobre tu cartera:<br/>
                    <span style={{ color:'#7C3AED', fontStyle:'italic' }}>"¿Qué tiendas atacar primero?"</span>
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth:'92%', padding:'9px 13px', borderRadius:12,
                      background: m.role==='user' ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'var(--bg-input)',
                      color: m.role==='user' ? '#fff' : 'var(--text-primary)',
                      fontSize:13, lineHeight:1.55,
                      border: m.role==='assistant' ? '1px solid var(--border)' : 'none',
                    }}>
                      {m.role === 'assistant'
                        ? <Md>{m.content}</Md>
                        : m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display:'flex' }}>
                    <div style={{ padding:'9px 14px', borderRadius:12, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:13 }}>⏳ Pensando...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendChat()}
                  placeholder="Pregunta algo..."
                  style={{ flex:1, padding:'9px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg-input)', color:'var(--text-primary)', fontSize:13, outline:'none' }}
                />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
                  padding:'9px 16px', borderRadius:8, border:'none',
                  background: chatLoading||!chatInput.trim() ? 'var(--bg-input)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                  color: chatLoading||!chatInput.trim() ? 'var(--text-secondary)' : '#fff',
                  fontWeight:700, fontSize:13, cursor: chatLoading||!chatInput.trim() ? 'default':'pointer',
                }}>↑</button>
                {chatHistory.length > 0 && (
                  <button onClick={() => setChatHistory([])} style={{ padding:'9px 12px', borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>🗑️</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-5px)}
        }
      `}</style>
    </div>
  )
}
