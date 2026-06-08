import { useState, useEffect, useRef } from 'react'
import { getProfile, updateNickname, uploadAvatar, getFarmers, promote, demote, assignCountry, removeCountry,
         getPerformance, changePassword, getNotes, createNote, updateNote, deleteNote,
         getCalendarStatus, connectCalendar, disconnectCalendar, syncCalendar } from '../services/profileService'
import { getLiderDashboard } from '../services/dashboardService'
import styles from './ProfilePage.module.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '')

const ROLE_LABEL = { ADMIN: 'Admin', LIDER: 'Líder', COORDINATOR: 'Coordinador', FARMER_MASS: 'Farmer Mass' }
const ROLE_COLOR = { ADMIN: styles.roleAdmin, LIDER: styles.roleLider, COORDINATOR: styles.roleCoord, FARMER_MASS: styles.roleFarmer }

const COUNTRIES = ['CO','MX','AR','PE','BR','EC','CL','CR','UY','BO','PA','HN']

export default function ProfilePage() {
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
  const avatarRef = useRef()

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

  const flash = (text, type = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const handleNickname = async () => {
    setSaving(true)
    try { await updateNickname(nickname); setEditingNick(false); flash('Apodo actualizado'); load() }
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
    try {
      const { data } = await connectCalendar()
      const popup = window.open(data.authUrl, 'google-calendar-auth', 'width=520,height=620')
      const handler = (e) => {
        if (e.data === 'connected') {
          setCalConnected(true)
          flash('Google Calendar conectado')
          popup?.close()
        } else if (e.data === 'error') {
          flash('Error al conectar Google Calendar', 'err')
          popup?.close()
        }
        window.removeEventListener('message', handler)
        setCalLoading(false)
      }
      window.addEventListener('message', handler)
      // Si el usuario cierra el popup sin autorizar
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval)
          window.removeEventListener('message', handler)
          setCalLoading(false)
        }
      }, 800)
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
        <h2 className={styles.cardTitle}>Mi perfil</h2>

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
