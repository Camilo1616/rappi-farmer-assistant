import { useState, useEffect, useRef } from 'react'
import { getProfile, updateNickname, uploadAvatar, changePassword, getUsers, promote, demote } from '../services/profileService'
import { useAuth } from '../context/AuthContext'
import styles from './ProfilePage.module.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace('/api', '')

const ROLE_LABEL = { ADMIN: 'Admin', USER: 'Usuario' }
const ROLE_COLOR = { ADMIN: styles.roleAdmin, USER: styles.roleFarmer }

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [profile, setProfile]         = useState(null)
  const [users, setUsers]             = useState([])
  const [nickname, setNickname]       = useState('')
  const [editingNick, setEditingNick] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState(null)
  const [pwdCurrent,    setPwdCurrent]    = useState('')
  const [pwdNew,        setPwdNew]        = useState('')
  const [pwdConfirm,    setPwdConfirm]    = useState('')
  const [pwdSaving,     setPwdSaving]     = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const avatarRef = useRef()

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isAdmin = profile?.role === 'ADMIN'

  const load = async () => {
    try {
      const { data } = await getProfile()
      setProfile(data)
      setNickname(data.nickname ?? '')

      if (data.role === 'ADMIN') {
        getUsers().then(r => setUsers(r.data)).catch(() => {})
      }
    } catch (e) {
      flash('Error cargando perfil', 'err')
    }
  }

  useEffect(() => { load() }, [])

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
    if (!confirm(`¿Promover a ${name} como Administrador?`)) return
    try { await promote(id); flash(`${name} ahora es Administrador`); load() }
    catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
  }

  const handleDemote = async (id, name) => {
    if (!confirm(`¿Bajar el rol de ${name} a Usuario?`)) return
    try { await demote(id); flash(`${name} ahora es Usuario`); load() }
    catch (e) { flash(e.response?.data?.message || 'Error', 'err') }
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

  if (!profile) return (
    <div className={styles.loading}><div className={styles.spinner} /> Cargando perfil...</div>
  )

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

      {/* ── Usuarios (solo Admin) ── */}
      {isAdmin && (
        <section className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardTitle}>Usuarios</h2>
            <span className={styles.badge}>{users.length} usuarios</span>
          </div>

          <div className={styles.farmerList}>
            {users.length === 0 && <p className={styles.emptyMsg}>No hay usuarios registrados.</p>}
            {users.map(u => (
              <div key={u.id} className={styles.farmerCard}>
                <div className={styles.farmerRow}>
                  <div className={styles.farmerAvatar}>
                    {u.avatarUrl
                      ? <img src={`${API_BASE}${u.avatarUrl}`} alt="" className={styles.farmerAvatarImg} />
                      : <span>{u.fullName?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div className={styles.farmerInfo}>
                    <span className={styles.farmerName}>{u.fullName}</span>
                    <span className={styles.farmerSub}>{u.email}</span>
                  </div>
                  <div className={styles.farmerRight}>
                    <span className={`${styles.roleTag} ${ROLE_COLOR[u.role] ?? ''}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                    {u.role === 'USER' && (
                      <button className={styles.btnPromote} onClick={() => handlePromote(u.id, u.fullName)}>
                        ↑ Promover a Admin
                      </button>
                    )}
                    {u.role === 'ADMIN' && (
                      <button className={styles.btnDemote} onClick={() => handleDemote(u.id, u.fullName)}>
                        ↓ Bajar a Usuario
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

    </div>
  )
}
