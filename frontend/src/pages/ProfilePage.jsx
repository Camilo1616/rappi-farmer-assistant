import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'
import { getProfile, updateNickname, uploadAvatar, getFarmers, promote, demote, assignCountry, removeCountry,
         getPerformance, changePassword, getNotes, createNote, updateNote, deleteNote,
         getCalendarStatus, connectCalendar, disconnectCalendar, syncCalendar } from '../services/profileService'
import { getLiderDashboard } from '../services/dashboardService'
import { useAuth } from '../context/AuthContext'
import styles from './ProfilePage.module.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '')

const ROLE_LABEL = { ADMIN: 'Admin', LIDER: 'Líder', COORDINATOR: 'Coordinador', FARMER_MASS: 'Farmer Mass' }
const ROLE_COLOR = { ADMIN: styles.roleAdmin, LIDER: styles.roleLider, COORDINATOR: styles.roleCoord, FARMER_MASS: styles.roleFarmer }

const COUNTRIES = ['CO','MX','AR','PE','BR','EC','CL','CR','UY','BO','PA','HN']

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [profile, setProfile]         = useState(null)
  const [farmers, setFarmers]         = useState([])
  const [liderData, setLiderData]     = useState(null)
  const [nickname, setNickname]       = useState('')
  const [editingNick, setEditingNick] = useState(false)
  const [countryInput, setCountryInput] = useState('')
  const [targetId, setTargetId]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState(null)
  const [expandedFarmer, setExpandedFarmer] = useState(null)
  const [perf,          setPerf]          = useState(null)
  const [notes,         setNotes]         = useState([])
  const [noteText,      setNoteText]      = useState('')
  const [editingNote,   setEditingNote]   = useState(null)
  const [pwdCurrent,    setPwdCurrent]    = useState('')
  const [pwdNew,        setPwdNew]        = useState('')
  const [pwdConfirm,    setPwdConfirm]    = useState('')
  const [pwdSaving,     setPwdSaving]     = useState(false)
  const [calConnected,  setCalConnected]  = useState(false)
  const [calLoading,    setCalLoading]    = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const avatarRef = useRef()

  // ── IA ────────────────────────────────────────────────────────────────────
  const [aiRec,        setAiRec]        = useState(null)   // { message, priorities[] }
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiError,      setAiError]      = useState(null)
  const [chatHistory,  setChatHistory]  = useState([])     // [{role, content}]
  const [chatInput,    setChatInput]    = useState('')
  const [chatLoading,  setChatLoading]  = useState(false)
  const chatEndRef = useRef(null)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isAdmin = profile?.role === 'ADMIN'
  const isLider = profile?.role === 'LIDER'
  const isManager = isAdmin || isLider

  const load = async () => {
    try {
      const { data } = await getProfile()
      setProfile(data)
      setNickname(data.nickname ?? '')

      if (data.role === 'ADMIN' || data.role === 'LIDER') {
        const [farmersRes, liderRes] = await Promise.allSettled([getFarmers(), getLiderDashboard()])
        if (farmersRes.status === 'fulfilled') setFarmers(farmersRes.value.data)
        if (liderRes.status === 'fulfilled')   setLiderData(liderRes.value.data)
      }
    } catch (e) {
      flash('Error cargando perfil', 'err')
    }
  }

  useEffect(() => {
    load()
    getPerformance().then(r => setPerf(r.data)).catch(() => {})
    getNotes().then(r => setNotes(r.data)).catch(() => {})
    getCalendarStatus().then(r => setCalConnected(r.data.connected)).catch(() => {})
  }, [])

  const loadAiRecommendation = useCallback(async () => {
    setAiLoading(true); setAiError(null)
    try {
      const { data } = await api.get('/ai/recommend', { timeout: 30000 })
      setAiRec(data)
    } catch (e) {
      setAiError(e.response?.data?.error || 'Error al cargar recomendación IA')
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
      const { data } = await api.post('/ai/chat', {
        history: newHistory.slice(-8), // últimos 8 mensajes para no quemar tokens
        message: userMsg.content
      }, { timeout: 30000 })
      setChatHistory(h => [...h, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setChatHistory(h => [...h, { role: 'assistant', content: '⚠️ ' + (e.response?.data?.error || 'Error al responder') }])
    } finally { setChatLoading(false) }
  }, [chatInput, chatHistory, chatLoading])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const flash = (text, type = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const handleNickname = async () => {
    setSaving(true)
    try {
      await updateNickname(nickname)
      setEditingNick(false)
      flash('Apodo actualizado')
      load()
      // Refrescar saludo en el sidebar sin necesidad de re-login
      if (user) setUser({ ...user, nickname: nickname.trim() || null })
    }
    catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
    finally { setSaving(false) }
  }

  const handleAvatar = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setSaving(true)
    try { await uploadAvatar(file); flash('Foto actualizada'); load() }
    catch (e) { flash(e.response?.data?.message || 'Error al subir foto', 'err') }
    finally { setSaving(false) }
  }

  const handlePromote = async (id, name) => {
    if (!confirm(`¿Promover a ${name} como Líder?`)) return
    try { await promote(id); flash(`${name} ahora es Líder`); load() }
    catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
  }

  const handleDemote = async (id, name) => {
    if (!confirm(`¿Bajar el rol de ${name} a Farmer Mass?`)) return
    try { await demote(id); flash(`${name} ahora es Farmer Mass`); load() }
    catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
  }

  const handleAssignCountry = async () => {
    if (!targetId || !countryInput) return
    try {
      await assignCountry(targetId, countryInput)
      flash(`País ${countryInput} asignado`)
      setCountryInput(''); setTargetId(''); load()
    } catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
  }

  const handleChangePassword = async () => {
    if (!pwdCurrent || !pwdNew) return
    if (pwdNew !== pwdConfirm) { flash('Las contraseñas no coinciden', 'err'); return }
    setPwdSaving(true)
    try {
      await changePassword(pwdCurrent, pwdNew)
      flash('Contraseña actualizada')
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('')
    } catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
    finally { setPwdSaving(false) }
  }

  const handleCreateNote = async () => {
    if (!noteText.trim()) return
    try {
      const r = await createNote(noteText.trim())
      setNotes(prev => [r.data, ...prev])
      setNoteText('')
    } catch { flash('Error al guardar nota', 'err') }
  }

  const handleUpdateNote = async (id, content) => {
    try {
      await updateNote(id, content)
      setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n))
      setEditingNote(null)
    } catch { flash('Error al actualizar nota', 'err') }
  }

  const handleDeleteNote = async (id) => {
    try {
      await deleteNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch { flash('Error al eliminar nota', 'err') }
  }

  const handleRemoveCountry = async (id, code) => {
    try { await removeCountry(id, code); flash(`País ${code} removido`); load() }
    catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
  }

  const handleConnectCalendar = async () => {
    setCalLoading(true)
    // Limpiar resultado anterior para evitar falsos positivos
    localStorage.removeItem('calendar_auth_result')
    try {
      const { data } = await connectCalendar()
      window.open(data.authUrl, 'google-calendar-auth', 'width=520,height=620')

      // Escucha el resultado via storage event (funciona aunque COOP bloquee window.opener)
      const onStorage = async (e) => {
        if (e.key !== 'calendar_auth_result') return
        window.removeEventListener('storage', onStorage)
        clearTimeout(timeout)
        localStorage.removeItem('calendar_auth_result')
        const status = (e.newValue || '').split('_')[0]
        if (status === 'connected') {
          setCalConnected(true)
          flash('Google Calendar conectado ✅')
        } else {
          flash('Error al conectar Google Calendar', 'err')
        }
        setCalLoading(false)
      }

      window.addEventListener('storage', onStorage)

      // Timeout de seguridad: 5 minutos
      const timeout = setTimeout(() => {
        window.removeEventListener('storage', onStorage)
        setCalLoading(false)
      }, 300000)

    } catch (e) {
      flash('Error al iniciar conexión', 'err')
      setCalLoading(false)
    }
  }

  const handleDisconnectCalendar = async () => {
    if (!confirm('¿Desconectar Google Calendar?')) return
    try { await disconnectCalendar(); setCalConnected(false); flash('Google Calendar desconectado') }
    catch (e) { flash('Error al desconectar', 'err') }
  }

  const handleSyncCalendar = async () => {
    setCalLoading(true)
    try {
      const { data } = await syncCalendar()
      flash(`Sync completado: ${data.activated ?? 0} tiendas activadas`)
    } catch (e) {
      flash(e.response?.data?.message || 'Error en sync', 'err')
    } finally { setCalLoading(false) }
  }

  if (!profile) return (
    <div className={styles.loading}><div className={styles.spinner} /> Cargando perfil...</div>
  )

  const myCountries = profile.countryCode ? profile.countryCode.split(',').filter(Boolean) : []

  return (
    <div className={styles.page}>
      {msg && <div className={`${styles.flash} ${msg.type === 'err' ? styles.flashErr : styles.flashOk}`}>{msg.text}</div>}

      {/* ── Mi perfil ── */}
      <section className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Mi perfil</h2>
          <button onClick={toggleTheme} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 14px',
            background: 'var(--bg-input)',
            border: '1.5px solid var(--border)',
            borderRadius: 99,
            fontSize: 12, fontWeight: 700,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'border-color 0.18s, color 0.18s',
            fontFamily: 'inherit',
          }}>
            {theme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro'}
          </button>
        </div>

        <div className={styles.profileRow}>
          <div className={styles.avatarWrap} onClick={() => avatarRef.current?.click()} title="Cambiar foto">
            {profile.avatarUrl
              ? <img src={`${API_BASE}${profile.avatarUrl}`} alt="avatar" className={styles.avatarImg} />
              : <div className={styles.avatarFallback}>{profile.fullName?.[0]?.toUpperCase()}</div>}
            <div className={styles.avatarOverlay}>📷</div>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={handleAvatar} />
          </div>

          <div className={styles.profileInfo}>
            <p className={styles.profileName}>{profile.fullName}</p>
            <p className={styles.profileEmail}>{profile.email}</p>
            <div className={styles.profileMeta}>
              <span className={`${styles.roleTag} ${ROLE_COLOR[profile.role] ?? ''}`}>
                {ROLE_LABEL[profile.role] ?? profile.role}
              </span>
              {profile.farmerCode && <span className={styles.metaChip}>🆔 {profile.farmerCode}</span>}
              {myCountries.map(c => (
                <span key={c} className={styles.metaChip}>🌎 {c}</span>
              ))}
              {profile.nickname && <span className={styles.metaChip}>✨ {profile.nickname}</span>}
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Apodo</label>
          {editingNick ? (
            <div className={styles.fieldRow}>
              <input className={styles.input} value={nickname} onChange={e => setNickname(e.target.value)}
                placeholder="Ej: El Rápido" maxLength={30} />
              <button className={styles.btnPrimary} onClick={handleNickname} disabled={saving}>Guardar</button>
              <button className={styles.btnGhost} onClick={() => setEditingNick(false)}>Cancelar</button>
            </div>
          ) : (
            <div className={styles.fieldRow}>
              <span className={styles.fieldValue}>{profile.nickname || <em className={styles.emptyItalic}>Sin apodo</em>}</span>
              <button className={styles.btnGhost} onClick={() => setEditingNick(true)}>Editar</button>
            </div>
          )}
        </div>
      </section>

      {/* ── Dashboard de equipo (Líder / Admin) ── */}
      {isManager && liderData && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Rendimiento del equipo hoy</h2>
          <div className={styles.statsGrid}>
            <StatBox label="Gestiones"  value={liderData.totalGestiones}  color="#3B82F6" />
            <StatBox label="Efectivas"  value={liderData.totalEfectivas}  color="#22C55E" />
            <StatBox label="No contacto" value={liderData.totalNoContacto} color="#F97316" />
            <StatBox label="Total tiendas" value={liderData.totalStores}   color="#A855F7" />
            <StatBox label="Onboarding" value={liderData.totalOnboarding} color="#FF441F" />
            <StatBox label="Churn"      value={liderData.totalChurn}      color="#EF4444" />
            <StatBox label="Saludables" value={liderData.totalSaludables} color="#22C55E" />
            <StatBox label="Bases ✅"   value={liderData.basesCompletadas} color="#22C55E" />
          </div>
        </section>
      )}

      {/* ── Equipo / Farmers (solo Líder y Admin) ── */}
      {isManager && (
        <section className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardTitle}>Mi equipo</h2>
            <span className={styles.badge}>{farmers.length} farmers</span>
          </div>

          {/* Asignar país — solo Admin */}
          {isAdmin && (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Asignar país a farmer</label>
              <div className={styles.fieldRow}>
                <select className={styles.input} value={targetId} onChange={e => setTargetId(e.target.value)}>
                  <option value="">Seleccionar farmer...</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.fullName} — {f.countryCode || 'sin país'}</option>
                  ))}
                </select>
                <select className={styles.inputSm} value={countryInput} onChange={e => setCountryInput(e.target.value)}>
                  <option value="">País</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className={styles.btnPrimary} onClick={handleAssignCountry}
                  disabled={!targetId || !countryInput}>Asignar</button>
              </div>
            </div>
          )}

          {/* Lista de farmers */}
          <div className={styles.farmerList}>
            {farmers.length === 0 && (
              <p className={styles.emptyMsg}>
                {isLider
                  ? `No hay farmers asignados a tus países (${myCountries.join(', ') || 'ninguno asignado'})`
                  : 'No hay farmers registrados.'}
              </p>
            )}
            {farmers.map(f => {
              const fCountries = (f.countryCode || '').split(',').filter(Boolean)
              const summary = liderData?.farmers?.find(s => s.id === f.id)
              const isExpanded = expandedFarmer === f.id
              return (
                <div key={f.id} className={styles.farmerCard}>
                  <div className={styles.farmerRow} onClick={() => setExpandedFarmer(isExpanded ? null : f.id)}>
                    <div className={styles.farmerAvatar}>
                      {f.avatarUrl
                        ? <img src={`${API_BASE}${f.avatarUrl}`} alt="" className={styles.farmerAvatarImg} />
                        : <span>{f.fullName?.[0]?.toUpperCase()}</span>}
                    </div>
                    <div className={styles.farmerInfo}>
                      <span className={styles.farmerName}>{f.fullName}</span>
                      <span className={styles.farmerSub}>{f.farmerCode} · {f.email}</span>
                    </div>
                    <div className={styles.farmerRight}>
                      <div className={styles.farmerCountries}>
                        {fCountries.map(c => <span key={c} className={styles.countryBadge}>{c}</span>)}
                      </div>
                      <span className={`${styles.roleTag} ${ROLE_COLOR[f.role] ?? ''}`}>
                        {ROLE_LABEL[f.role] ?? f.role}
                      </span>
                      <span className={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className={styles.farmerDetail}>
                      {summary && (
                        <div className={styles.farmerStats}>
                          <MiniStat label="Gestiones hoy"  value={summary.gestionesHoy}  color="#3B82F6" />
                          <MiniStat label="Efectivas"       value={summary.exitosasHoy}   color="#22C55E" />
                          <MiniStat label="No contacto"     value={summary.noContactoHoy} color="#F97316" />
                          <MiniStat label="Total tiendas"   value={summary.totalStores}   color="#A855F7" />
                          <MiniStat label="Onboarding"      value={summary.onboardingCount} color="#FF441F" />
                          <MiniStat label="Churn"           value={summary.churnCount}    color="#EF4444" />
                          <MiniStat label="Saludables"      value={summary.saludablesCount} color="#22C55E" />
                        </div>
                      )}
                      <div className={styles.farmerActions}>
                        {/* Quitar países — solo Admin */}
                        {isAdmin && fCountries.length > 0 && fCountries.map(c => (
                          <button key={c} className={styles.btnChip} onClick={() => handleRemoveCountry(f.id, c)}>
                            {c} ✕
                          </button>
                        ))}
                        {/* Promover — Admin y Líder (solo FARMER_MASS) */}
                        {f.role === 'FARMER_MASS' && (
                          <button className={styles.btnPromote} onClick={() => handlePromote(f.id, f.fullName)}>
                            ↑ Promover a Líder
                          </button>
                        )}
                        {/* Bajar rol — solo Admin */}
                        {isAdmin && f.role === 'LIDER' && (
                          <button className={styles.btnDemote} onClick={() => handleDemote(f.id, f.fullName)}>
                            ↓ Bajar a Farmer Mass
                          </button>
                        )}
                        <span className={`${styles.statusDot} ${f.accountStatus === 'ACTIVE' ? styles.statusActive : styles.statusInactive}`}>
                          {f.accountStatus === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Rendimiento personal ── */}
      {perf && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>📊 Rendimiento de la semana</h2>
          <div className={styles.perfStats}>
            <div className={styles.perfStat}>
              <span className={styles.perfVal}>{perf.efectivasSemana}</span>
              <span className={styles.perfLabel}>Efectivas</span>
              <span className={styles.perfMeta}>meta {perf.metaSemana}</span>
            </div>
            <div className={styles.perfStat}>
              <span className={styles.perfVal}>{perf.totalSemana}</span>
              <span className={styles.perfLabel}>Total gestiones</span>
            </div>
            <div className={styles.perfStat}>
              <span className={styles.perfVal} style={{ color: perf.streak > 0 ? '#F59E0B' : '#6B7280' }}>
                🔥 {perf.streak}
              </span>
              <span className={styles.perfLabel}>Días racha</span>
            </div>
          </div>
          <div className={styles.barChart}>
            {perf.days.map(d => (
              <div key={d.date} className={styles.barCol}>
                <div className={styles.barWrap}>
                  <div className={styles.bar}
                    style={{
                      height: `${Math.min(100, Math.round((d.efectivas / 15) * 100))}%`,
                      background: d.metaOk ? '#22C55E' : '#3B82F6'
                    }} />
                </div>
                <span className={styles.barVal}>{d.efectivas}</span>
                <span className={styles.barLabel}>{d.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Google Calendar (solo farmer) ── */}
      {!isManager && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>📅 Google Calendar</h2>
          <p className={styles.fieldLabel} style={{ marginBottom: 12 }}>
            Conecta tu cuenta de Google para sincronizar automáticamente las activaciones de Handoff.
          </p>
          <div className={styles.fieldRow}>
            <span className={`${styles.metaChip}`} style={{ background: calConnected ? '#dcfce7' : '#fee2e2', color: calConnected ? '#166534' : '#991b1b' }}>
              {calConnected ? '✅ Conectado' : '❌ No conectado'}
            </span>
            {!calConnected ? (
              <button className={styles.btnPrimary} onClick={handleConnectCalendar} disabled={calLoading}>
                {calLoading ? 'Abriendo...' : 'Conectar Google Calendar'}
              </button>
            ) : (
              <>
                <button className={styles.btnGhost} onClick={handleSyncCalendar} disabled={calLoading}>
                  {calLoading ? 'Sincronizando...' : '🔄 Sincronizar ahora'}
                </button>
                <button className={styles.btnDemote} onClick={handleDisconnectCalendar}>
                  Desconectar
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* ── Cambio de contraseña ── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>🔐 Cambiar contraseña</h2>
        <div className={styles.pwdForm}>
          <input className={styles.input} type="password" placeholder="Contraseña actual"
            value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)} />
          <input className={styles.input} type="password" placeholder="Nueva contraseña (mín. 6 caracteres)"
            value={pwdNew} onChange={e => setPwdNew(e.target.value)} />
          <input className={styles.input} type="password" placeholder="Confirmar nueva contraseña"
            value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} />
          <button className={styles.btnPrimary} onClick={handleChangePassword}
            disabled={pwdSaving || !pwdCurrent || !pwdNew || !pwdConfirm}>
            {pwdSaving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </section>

      {/* ── Asistente IA ── */}
      <section className={styles.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h2 className={styles.cardTitle} style={{ margin:0 }}>🤖 Asistente IA — Recomendados hoy</h2>
          <button onClick={loadAiRecommendation} disabled={aiLoading} style={{
            padding:'7px 16px', borderRadius:8, border:'none',
            background: aiLoading ? 'var(--bg-input)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
            color: aiLoading ? 'var(--text-secondary)' : '#fff',
            fontWeight:700, fontSize:12, cursor: aiLoading ? 'default' : 'pointer'
          }}>
            {aiLoading ? '⏳ Analizando...' : aiRec ? '🔄 Actualizar' : '✨ Analizar mi cartera'}
          </button>
        </div>

        {aiError && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(239,68,68,0.08)',
            color:'#EF4444', fontSize:13, marginBottom:12 }}>{aiError}</div>
        )}

        {!aiRec && !aiLoading && !aiError && (
          <p style={{ color:'var(--text-secondary)', fontSize:13, textAlign:'center', padding:'24px 0' }}>
            Haz clic en "Analizar mi cartera" para que la IA revise tus tiendas y te diga qué atacar hoy.
          </p>
        )}

        {aiRec && (
          <>
            <div style={{
              padding:'14px 18px', borderRadius:10,
              background:'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(109,40,217,0.04))',
              border:'1px solid rgba(124,58,237,0.18)',
              color:'var(--text-primary)', fontSize:14, lineHeight:1.6, marginBottom:18
            }}>
              {aiRec.message}
            </div>

            {aiRec.priorities?.length > 0 && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:'2px solid var(--border)' }}>
                      {['Tienda','Canal','Prioridad','Por qué','Acción hoy'].map(h => (
                        <th key={h} style={{ textAlign:'left', padding:'8px 10px',
                          color:'var(--text-secondary)', fontWeight:700, fontSize:11,
                          textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aiRec.priorities.map((p, i) => (
                      <tr key={p.storeCode ?? i} style={{
                        borderBottom:'1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg-input)'
                      }}>
                        <td style={{ padding:'9px 10px', fontWeight:600, color:'var(--text-primary)' }}>
                          <div>{p.storeName}</div>
                          <div style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:400 }}>{p.storeCode}</div>
                        </td>
                        <td style={{ padding:'9px 10px', color:'var(--text-secondary)', fontSize:12 }}>
                          {p.channel ?? '—'}
                        </td>
                        <td style={{ padding:'9px 10px' }}>
                          <span style={{
                            display:'inline-block', padding:'3px 10px', borderRadius:99,
                            fontSize:11, fontWeight:700,
                            background: p.priority === 'ALTA' ? 'rgba(239,68,68,0.12)' :
                                        p.priority === 'MEDIA' ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
                            color: p.priority === 'ALTA' ? '#EF4444' :
                                   p.priority === 'MEDIA' ? '#F97316' : '#22C55E'
                          }}>{p.priority}</span>
                        </td>
                        <td style={{ padding:'9px 10px', color:'var(--text-secondary)', fontSize:12, maxWidth:220 }}>
                          {p.reason}
                        </td>
                        <td style={{ padding:'9px 10px', color:'var(--text-primary)', fontSize:12, maxWidth:200 }}>
                          {p.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Mini chat con IA ── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle} style={{ marginBottom:12 }}>💬 Chat con tu asistente</h2>
        <p style={{ color:'var(--text-secondary)', fontSize:12, marginBottom:16, marginTop:0 }}>
          Pregunta sobre tu cartera: "¿qué tiendas atacar hoy?", "tiendas sin AVA", "cuáles llevan más de 7 días sin gestión"...
        </p>

        <div style={{
          height:340, overflowY:'auto', display:'flex', flexDirection:'column', gap:10,
          padding:'12px 4px', marginBottom:12,
          borderRadius:10, background:'var(--bg-input)', border:'1px solid var(--border)'
        }}>
          {chatHistory.length === 0 && (
            <div style={{ textAlign:'center', color:'var(--text-secondary)', fontSize:13, margin:'auto' }}>
              Empieza preguntando algo sobre tu cartera 👆
            </div>
          )}
          {chatHistory.map((m, i) => (
            <div key={i} style={{
              display:'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              padding:'0 10px'
            }}>
              <div style={{
                maxWidth:'78%', padding:'10px 14px', borderRadius:12,
                background: m.role === 'user'
                  ? 'linear-gradient(135deg,#7C3AED,#6D28D9)'
                  : 'var(--bg-card)',
                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize:13, lineHeight:1.6,
                border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                whiteSpace:'pre-wrap'
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div style={{ padding:'0 10px' }}>
              <div style={{
                display:'inline-block', padding:'10px 16px', borderRadius:12,
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', fontSize:13
              }}>⏳ Pensando...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
            placeholder="Escribe tu pregunta..."
            style={{
              flex:1, padding:'10px 14px', borderRadius:8,
              border:'1.5px solid var(--border)',
              background:'var(--bg-input)', color:'var(--text-primary)',
              fontSize:13, outline:'none'
            }}
          />
          <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
            padding:'10px 20px', borderRadius:8, border:'none',
            background: chatLoading || !chatInput.trim()
              ? 'var(--bg-input)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
            color: chatLoading || !chatInput.trim() ? 'var(--text-secondary)' : '#fff',
            fontWeight:700, fontSize:13, cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer'
          }}>Enviar</button>
          {chatHistory.length > 0 && (
            <button onClick={() => setChatHistory([])} style={{
              padding:'10px 14px', borderRadius:8, border:'1.5px solid var(--border)',
              background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer'
            }}>Limpiar</button>
          )}
        </div>
      </section>

      {/* ── Notas personales ── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>📝 Notas personales</h2>
        <div className={styles.noteInput}>
          <textarea className={styles.noteTextarea} rows={3}
            placeholder="Escribe un recordatorio o nota..."
            value={noteText} onChange={e => setNoteText(e.target.value)} />
          <button className={styles.btnPrimary} onClick={handleCreateNote} disabled={!noteText.trim()}>
            Guardar nota
          </button>
        </div>
        <div className={styles.noteList}>
          {notes.length === 0 && <p className={styles.noNotes}>Sin notas aún</p>}
          {notes.map(n => (
            <div key={n.id} className={styles.noteItem}>
              {editingNote === n.id
                ? <NoteEditor note={n} onSave={content => handleUpdateNote(n.id, content)}
                    onCancel={() => setEditingNote(null)} />
                : <>
                    <p className={styles.noteContent}>{n.content}</p>
                    <div className={styles.noteMeta}>
                      <span className={styles.noteDate}>{n.updatedAt?.slice(0, 16).replace('T', ' ')}</span>
                      <button className={styles.noteBtnEdit} onClick={() => setEditingNote(n.id)}>✏️ Editar</button>
                      <button className={styles.noteBtnDel} onClick={() => handleDeleteNote(n.id)}>🗑️</button>
                    </div>
                  </>
              }
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}

function NoteEditor({ note, onSave, onCancel }) {
  const [text, setText] = useState(note.content)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
      <textarea className={styles.noteTextarea} rows={3} value={text}
        onChange={e => setText(e.target.value)} autoFocus />
      <div style={{ display:'flex', gap:8 }}>
        <button className={styles.btnPrimary} onClick={() => onSave(text)} disabled={!text.trim()}>Guardar</button>
        <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div className={styles.statBox}>
      <span className={styles.statValue} style={{ color }}>{value ?? 0}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div className={styles.miniStat}>
      <span className={styles.miniValue} style={{ color }}>{value ?? 0}</span>
      <span className={styles.miniLabel}>{label}</span>
    </div>
  )
}
