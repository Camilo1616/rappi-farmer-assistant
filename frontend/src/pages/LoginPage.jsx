import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register, sendPin, checkEmail, forgotPassword, resetPassword, getLidersByCountry } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showForgot,   setShowForgot]   = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      setUser({ id: data.id, email: data.email, fullName: data.fullName, role: data.role })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSuccess = (data) => {
    setUser({ id: data.id, email: data.email, fullName: data.fullName, role: data.role })
    navigate('/')
  }

  return (
    <div className={styles.container}>

      {/* Panel izquierdo decorativo */}
      <div className={styles.left}>
        <div className={styles.orb + ' ' + styles.orb1} />
        <div className={styles.orb + ' ' + styles.orb2} />
        <div className={styles.orb + ' ' + styles.orb3} />

        {/* Brand */}
        <div className={styles.leftBrand}>
          <span className={styles.brandDot} />
          <span className={styles.brandName}>Rappi Farmer Assistant</span>
        </div>

        {/* Headline central */}
        <div className={styles.leftContent}>
          <div className={styles.leftBadge}>Account Manager · Herramienta interna</div>
          <h1 className={styles.leftHeadline}>
            Tu cartera,<br />
            bajo <em>control</em><br />
            total.
          </h1>
          <p className={styles.leftSub}>
            Prioriza, gestiona y activa restaurantes sin perder el hilo.
            Diseñado para el ritmo real de un AM de Rappi.
          </p>

          {/* Feature pills */}
          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>⚡</span>
              <span>WhatsApp masivo con plantillas dinámicas</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📊</span>
              <span>Dashboard de prioridades en tiempo real</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🗂️</span>
              <span>Seguimiento de onboarding día a día</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🔔</span>
              <span>Alertas de churn y Aliados &lt; 60 %</span>
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className={styles.leftFooter}>
          <div className={styles.stat}>
            <span className={styles.statValue}>500<span className={styles.statPlus}>+</span></span>
            <span className={styles.statLabel}>Restaurantes</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>40</span>
            <span className={styles.statLabel}>WhatsApp / día</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>8</span>
            <span className={styles.statLabel}>Días críticos</span>
          </div>
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div className={styles.right}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Bienvenido de vuelta</h2>
            <p className={styles.cardSub}>Ingresa con tu cuenta @rappi.com</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Correo</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>✉</span>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="nombre@rappi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Contraseña</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" className={styles.btn} disabled={loading}>
              {loading && <span className={styles.spinner} />}
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>

            <button type="button" className={styles.forgotLink}
              onClick={() => setShowForgot(true)}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>

          <div className={styles.divider}><span>¿Eres nuevo?</span></div>

          <button className={styles.btnRegister} onClick={() => setShowRegister(true)}>
            ✨ Crear cuenta
          </button>
        </div>
      </div>

      {showRegister && (
        <RegisterModal onSuccess={handleRegisterSuccess} onClose={() => setShowRegister(false)} />
      )}
      {showForgot && (
        <ForgotPasswordModal onClose={() => setShowForgot(false)} />
      )}
    </div>
  )
}

const MX_ZONES = [
  { code: 'MX-CS', label: 'Center South' },
  { code: 'MX-C',  label: 'Centro' },
  { code: 'MX-NE', label: 'North East' },
  { code: 'MX-W',  label: 'West' },
]

function RegisterModal({ onSuccess, onClose }) {
  const [step,          setStep]          = useState(1)
  const [fullName,      setFullName]      = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [confirmPwd,    setConfirmPwd]    = useState('')
  const [showPwd,       setShowPwd]       = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [country,       setCountry]       = useState('CO')
  const [pin,           setPin]           = useState('')
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [resending,     setResending]     = useState(false)
  const [emailExists,   setEmailExists]   = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [liderCode,     setLiderCode]     = useState('')
  // Paso 3 — líder MX
  const [selectedZones, setSelectedZones] = useState([])
  // Paso 3 — farmer MX
  const [lidersList,    setLidersList]    = useState([])
  const [farmLiderId,   setFarmLiderId]   = useState('')
  const [loadingLiders, setLoadingLiders] = useState(false)

  const COUNTRIES = ['CO','MX','AR','PE','BR','EC','CL','CR','UY','BO','PA','HN']
  const isLider   = liderCode.trim() !== ''
  const isMX      = country === 'MX'
  const totalSteps = isMX ? 3 : 2

  // Cargar líderes de MX cuando el farmer pasa al paso 3
  useEffect(() => {
    if (step === 3 && isMX && !isLider) {
      setLoadingLiders(true)
      getLidersByCountry('MX')
        .then(r => setLidersList(r.data))
        .catch(() => setLidersList([]))
        .finally(() => setLoadingLiders(false))
    }
  }, [step])

  const handleEmailChange = async (val) => {
    setEmail(val); setEmailExists(false)
    if (val.includes('@') && val.includes('.')) {
      setCheckingEmail(true)
      try { const r = await checkEmail(val); setEmailExists(r.data.exists) } catch {}
      finally { setCheckingEmail(false) }
    }
  }

  const handleSendPin = async (e) => {
    e.preventDefault(); setError('')
    if (!email.toLowerCase().endsWith('@rappi.com')) { setError('Solo se permiten correos corporativos @rappi.com'); return }
    if (password !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6)    { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    try { await sendPin(email); setStep(2) }
    catch (err) { setError(err.response?.data?.message || 'Error al enviar el código') }
    finally { setLoading(false) }
  }

  const handleResend = async () => {
    setResending(true); setError('')
    try { await sendPin(email) } catch { setError('Error al reenviar el código') }
    finally { setResending(false) }
  }

  // Paso 2: verificar PIN. Si es MX → ir a paso 3. Si no → registrar directamente.
  const handleVerifyPin = (e) => {
    e.preventDefault(); setError('')
    if (pin.length !== 6) { setError('El código debe tener 6 dígitos'); return }
    if (isMX) { setStep(3) } else { handleRegister() }
  }

  const handleRegister = async (extraData = {}) => {
    setLoading(true); setError('')
    try {
      const data = await register({
        fullName, email, password,
        countryCode: country,
        pin,
        liderCode: liderCode || undefined,
        ...extraData,
      })
      onSuccess(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Código incorrecto o error al crear la cuenta')
      if (err.response?.status === 400 && err.response?.data?.message?.toLowerCase().includes('código')) {
        setStep(2) // volver al PIN si el código es incorrecto
      }
    } finally {
      setLoading(false) }
  }

  const handleFinishMX = (e) => {
    e.preventDefault(); setError('')
    if (isLider) {
      if (selectedZones.length === 0) { setError('Selecciona al menos una zona de México'); return }
      handleRegister({ zones: selectedZones.join(',') })
    } else {
      if (!farmLiderId) { setError('Selecciona tu líder de zona'); return }
      handleRegister({ farmLiderId: Number(farmLiderId) })
    }
  }

  const toggleZone = (code) => setSelectedZones(prev =>
    prev.includes(code) ? prev.filter(z => z !== code) : [...prev, code])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Crear cuenta</h3>
            <div className={styles.modalSteps}>
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s, i) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className={`${styles.stepDot} ${step >= s ? styles.stepDotActive : ''}`}>{s}</span>
                  {i < totalSteps - 1 && <span className={styles.stepLine} />}
                </span>
              ))}
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* ── Paso 1: datos personales ── */}
        {step === 1 && (
          <form className={styles.modalForm} onSubmit={handleSendPin}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Nombre completo</label>
              <input className={styles.modalInput} placeholder="Ej: Cristian Ariza"
                value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Correo @rappi.com</label>
              <input className={`${styles.modalInput} ${emailExists ? styles.inputError : ''}`}
                type="email" placeholder="nombre@rappi.com"
                value={email} onChange={e => handleEmailChange(e.target.value)} required />
              {checkingEmail && <span className={styles.emailHint}>Verificando...</span>}
              {emailExists && <span className={styles.emailTaken}>⚠ Este correo ya tiene cuenta. Inicia sesión.</span>}
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>País</label>
              <select className={styles.modalInput} value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>
                Código de líder <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.78rem' }}>(opcional — déjalo vacío si eres Farmer)</span>
              </label>
              <input className={styles.modalInput} type="password"
                placeholder="Solo si eres Líder de equipo"
                value={liderCode} onChange={e => setLiderCode(e.target.value)}
                autoComplete="off" />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showPwd ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Confirmar contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showConfirm ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn}
              disabled={loading || !fullName || !email || !password || !confirmPwd || emailExists}>
              {loading ? 'Enviando código...' : '📧 Enviar código de verificación'}
            </button>
          </form>
        )}

        {/* ── Paso 2: verificar PIN ── */}
        {step === 2 && (
          <form className={styles.modalForm} onSubmit={handleVerifyPin}>
            <div className={styles.pinInfo}>
              <span className={styles.pinIcon}>📬</span>
              <p>Enviamos un código de 6 dígitos a<br /><strong>{email}</strong></p>
              <p className={styles.pinSub}>Expira en 10 minutos</p>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Código de verificación</label>
              <input className={`${styles.modalInput} ${styles.pinInput}`}
                placeholder="000000" maxLength={6}
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                autoFocus required />
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading || pin.length !== 6}>
              {loading ? 'Verificando...' : isMX ? 'Continuar →' : '✅ Crear cuenta'}
            </button>
            <button type="button" className={styles.btnResend} onClick={handleResend} disabled={resending}>
              {resending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
            </button>
          </form>
        )}

        {/* ── Paso 3: solo para México ── */}
        {step === 3 && isMX && (
          <form className={styles.modalForm} onSubmit={handleFinishMX}>
            {isLider ? (
              <>
                <div className={styles.pinInfo} style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '1.5rem' }}>🇲🇽</span>
                  <p style={{ margin: 0 }}>Selecciona las <strong>zonas de México</strong> que gestionas</p>
                  <p className={styles.pinSub}>Puedes elegir una o varias</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {MX_ZONES.map(z => (
                    <label key={z.code} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderRadius: 10, cursor: 'pointer',
                      background: selectedZones.includes(z.code) ? 'rgba(255,68,31,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${selectedZones.includes(z.code) ? '#FF441F' : 'rgba(255,255,255,0.1)'}`,
                      transition: 'all 0.15s',
                    }}>
                      <input type="checkbox" checked={selectedZones.includes(z.code)}
                        onChange={() => toggleZone(z.code)}
                        style={{ width: 16, height: 16, accentColor: '#FF441F' }} />
                      <span style={{ color: '#E5E7EB', fontWeight: 500 }}>{z.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#9CA3AF' }}>{z.code}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className={styles.pinInfo} style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '1.5rem' }}>🇲🇽</span>
                  <p style={{ margin: 0 }}>Selecciona tu <strong>líder de zona</strong> en México</p>
                  <p className={styles.pinSub}>Tu líder supervisará tu cartera y te asignará bases</p>
                </div>
                {loadingLiders ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center' }}>Cargando líderes...</p>
                ) : lidersList.length === 0 ? (
                  <p style={{ color: '#F59E0B', textAlign: 'center', fontSize: '0.85rem' }}>
                    No hay líderes registrados en MX aún. Continúa sin asignar líder.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lidersList.map(l => (
                      <label key={l.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderRadius: 10, cursor: 'pointer',
                        background: farmLiderId === String(l.id) ? 'rgba(255,68,31,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${farmLiderId === String(l.id) ? '#FF441F' : 'rgba(255,255,255,0.1)'}`,
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" name="lider" value={l.id}
                          checked={farmLiderId === String(l.id)}
                          onChange={e => setFarmLiderId(e.target.value)}
                          style={{ accentColor: '#FF441F' }} />
                        <div>
                          <div style={{ color: '#E5E7EB', fontWeight: 500 }}>{l.name}</div>
                          <div style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>{l.zones || 'MX'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading}>
              {loading ? 'Creando cuenta...' : '✅ Crear cuenta'}
            </button>
            <button type="button" className={styles.btnResend} onClick={() => { setStep(2); setError('') }}>
              ← Volver al código
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ForgotPasswordModal({ onClose }) {
  const [step,       setStep]       = useState(1)
  const [email,      setEmail]      = useState('')
  const [pin,        setPin]        = useState('')
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)

  const handleSendPin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await forgotPassword(email); setStep(2) }
    catch (err) { setError(err.response?.data?.message || 'Error al enviar código') }
    finally { setLoading(false) }
  }

  const handleVerifyPin = (e) => {
    e.preventDefault(); setError('')
    if (pin.length !== 6) { setError('El código debe tener 6 dígitos'); return }
    setStep(3)
  }

  const handleReset = async (e) => {
    e.preventDefault(); setError('')
    if (newPwd !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (newPwd.length < 6)    { setError('Mínimo 6 caracteres'); return }
    setLoading(true)
    try { await resetPassword(email, pin, newPwd); setSuccess(true) }
    catch (err) { setError(err.response?.data?.message || 'Código incorrecto o expirado') }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Recuperar contraseña</h3>
            {!success && (
              <div className={styles.modalSteps}>
                {[1,2,3].map((s,i) => (
                  <span key={s} style={{display:'flex',alignItems:'center',gap:6}}>
                    <span className={`${styles.stepDot} ${step >= s ? styles.stepDotActive : ''}`}>{s}</span>
                    {i < 2 && <span className={styles.stepLine} />}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className={styles.modalForm} style={{alignItems:'center',textAlign:'center',gap:16}}>
            <span style={{fontSize:'2.5rem'}}>✅</span>
            <p style={{color:'#D1D5DB',margin:0}}>Contraseña actualizada correctamente</p>
            <button className={styles.modalBtn} onClick={onClose}>Ir al login</button>
          </div>
        ) : step === 1 ? (
          <form className={styles.modalForm} onSubmit={handleSendPin}>
            <p style={{color:'#9CA3AF',fontSize:'0.85rem',margin:0}}>
              Ingresa tu correo registrado y te enviaremos un código.
            </p>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Correo @rappi.com</label>
              <input className={styles.modalInput} type="email" placeholder="nombre@rappi.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading || !email}>
              {loading ? 'Enviando...' : '📧 Enviar código'}
            </button>
          </form>
        ) : step === 2 ? (
          <form className={styles.modalForm} onSubmit={handleVerifyPin}>
            <div className={styles.pinInfo}>
              <span className={styles.pinIcon}>📬</span>
              <p>Código enviado a<br /><strong>{email}</strong></p>
              <p className={styles.pinSub}>Expira en 10 minutos</p>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Código de verificación</label>
              <input className={`${styles.modalInput} ${styles.pinInput}`}
                placeholder="000000" maxLength={6}
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))}
                autoFocus required />
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={pin.length !== 6}>
              Verificar código →
            </button>
          </form>
        ) : (
          <form className={styles.modalForm} onSubmit={handleReset}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Nueva contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showPwd ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} required autoFocus />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Confirmar contraseña</label>
              <div className={styles.pwdWrap}>
                <input className={styles.modalInput} type={showPwd ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
              </div>
            </div>
            {error && <div className={styles.modalError}>⚠ {error}</div>}
            <button type="submit" className={styles.modalBtn} disabled={loading || !newPwd || !confirmPwd}>
              {loading ? 'Guardando...' : '🔐 Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
