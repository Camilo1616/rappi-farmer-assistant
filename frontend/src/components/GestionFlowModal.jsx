import { useState } from 'react'
import { registerManagement } from '../services/dashboardService'
import AdsPalancaForm, { adsToString } from './AdsPalancaForm'
import MarkdownPalancaForm, { markdownToString, markdownIsValid } from './MarkdownPalancaForm'
import CatalogoPalancaForm, { catalogoToString, catalogoIsValid } from './CatalogoPalancaForm'
import ChurnPalancaForm, { churnToString, churnIsValid } from './ChurnPalancaForm'
import TopRestaurantesPalancaForm, { topToString, topIsValid } from './TopRestaurantesPalancaForm'
import PainsPalancaForm, { painsToString, painsIsValid } from './PainsPalancaForm'
import SprintsPalancaForm, { sprintsToString, sprintsIsValid } from './SprintsPalancaForm'
import styles from './GestionFlowModal.module.css'

const MEDIOS = ['WhatsApp', 'Llamada', 'Videollamada', 'Correo']
const MEET_LINK = 'meet.google.com/ndx-qaxn-qcs'
const PALANCAS  = ['Ads', 'Markdown', 'Catálogo', 'Churn', 'Top Restaurantes', 'Pains', 'Sprints']

export default function GestionFlowModal({ store, onClose, onSaved }) {
  const [contactado, setContactado]   = useState(null)
  const [direccion, setDireccion]     = useState(null)
  const [medio, setMedio]             = useState(null)
  const [evidencia, setEvidencia]     = useState('')
  const [evidenciaError, setEvidenciaError] = useState('')
  const [meetLink, setMeetLink]       = useState('')
  const [meetError, setMeetError]     = useState('')
  const [comentario, setComentario]   = useState('')
  const [palancas, setPalancas]       = useState([])
  const [adsData, setAdsData]         = useState({})
  const [markdownData, setMarkdownData]   = useState({})
  const [catalogoData, setCatalogoData]   = useState({})
  const [churnData, setChurnData]         = useState({})
  const [topData, setTopData]             = useState({})
  const [painsData, setPainsData]         = useState({})
  const [sprintsData, setSprintsData]     = useState({})
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const togglePalanca = p =>
    setPalancas(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const evidenciaLabel = medio === 'WhatsApp' ? 'Número de WhatsApp'
                       : medio === 'Llamada'  ? 'Número de teléfono'
                       : medio === 'Correo'   ? 'Correo electrónico'
                       : null

  const evidenciaPlaceholder = medio === 'WhatsApp' || medio === 'Llamada' ? '+57 300 000 0000'
                             : medio === 'Correo' ? 'ejemplo@correo.com'
                             : ''

  const canSubmit = () => {
    if (!contactado) return false
    if (contactado === 'no') return comentario.trim().length > 0
    if (!direccion || !medio) return false
    if (medio === 'Videollamada') {
      if (!meetLink.trim() || meetError) return false
    } else {
      if (!evidencia.trim() || evidenciaError) return false
    }
    if (palancas.includes('Markdown') && !markdownIsValid(markdownData)) return false
    if (palancas.includes('Catálogo') && !catalogoIsValid(catalogoData)) return false
    if (palancas.includes('Churn')           && !churnIsValid(churnData)) return false
    if (palancas.includes('Top Restaurantes') && !topIsValid(topData))       return false
    if (palancas.includes('Pains')            && !painsIsValid(painsData))   return false
    if (palancas.includes('Sprints')          && !sprintsIsValid(sprintsData)) return false
    return comentario.trim().length > 0
  }

  const handleMedioChange = m => {
    setMedio(m); setEvidencia(''); setEvidenciaError(''); setMeetLink(''); setMeetError('')
  }

  const handleEvidencia = val => {
    setEvidencia(val)
    if (!val.trim()) { setEvidenciaError('Este campo es obligatorio'); return }
    if ((medio === 'WhatsApp' || medio === 'Llamada') && !/[\d\s+\-()]{6,}/.test(val)) {
      setEvidenciaError('Ingresa un número válido')
    } else if (medio === 'Correo' && !val.includes('@')) {
      setEvidenciaError('Ingresa un correo válido')
    } else {
      setEvidenciaError('')
    }
  }

  const handleMeetLink = val => {
    setMeetLink(val)
    const clean = val.trim().toLowerCase().replace(/^https?:\/\//, '')
    if (val.trim() && !clean.startsWith('meet.google.')) {
      setMeetError('El link debe ser de Google Meet (meet.google.com/...)')
    } else {
      setMeetError('')
    }
  }

  const handleSave = async () => {
    if (!canSubmit()) return
    setSaving(true); setError('')
    try {
      const managementType = contactado === 'no'
        ? 'NO_CONTACTO'
        : medio === 'WhatsApp'     ? 'WHATSAPP'
        : medio === 'Llamada'      ? 'LLAMADA'
        : medio === 'Videollamada' ? 'VIDEO_LLAMADA'
        : medio === 'Correo'       ? 'CORREO'
        : 'OTRO'

      const resultType = contactado === 'no' ? 'NO_CONTACTO' : 'EFECTIVA'

      const evidenciaStr = medio === 'Videollamada' ? meetLink : evidencia
      const palancasStr = palancas.map(p =>
        p === 'Ads'      ? adsToString(adsData)      || 'Ads'      :
        p === 'Markdown' ? markdownToString(markdownData) || 'Markdown' :
        p === 'Catálogo' ? catalogoToString(catalogoData) || 'Catálogo' :
        p === 'Churn'            ? churnToString(churnData) || 'Churn'            :
        p === 'Top Restaurantes' ? topToString(topData)       || 'Top Restaurantes' :
        p === 'Pains'            ? painsToString(painsData)   || 'Pains'            :
        p === 'Sprints'          ? sprintsToString(sprintsData) || 'Sprints'        :
        p
      ).join(', ')
      const fullComment = [
        contactado === 'si' ? `[${direccion?.toUpperCase()}] [${medio}] [${evidenciaStr}]` : '[NO CONTACTADO]',
        palancasStr ? `Palancas: ${palancasStr}` : '',
        comentario.trim(),
      ].filter(Boolean).join(' | ')

      await registerManagement(store.id, { managementType, resultType, comments: fullComment })
      onSaved?.()
    } catch (e) {
      setError(e.response?.data?.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  const step = !contactado ? 0
    : contactado === 'no'  ? 3
    : !direccion           ? 1
    : !medio               ? 2
    : 3

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <p className={styles.storeName}>{store.storeName}</p>
            <p className={styles.storeCode}>{store.storeCode}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* Paso 0 — ¿Fue contactado? */}
          <div className={styles.field}>
            <label className={styles.label}>¿El aliado fue contactado?</label>
            <div className={styles.bigOptions}>
              <button
                className={`${styles.bigOption} ${contactado === 'si' ? styles.bigOptionYes : ''}`}
                onClick={() => { setContactado('si'); setDireccion(null); setMedio(null) }}
              >
                <span className={styles.bigIcon}>✅</span>
                <span>Sí, fue contactado</span>
              </button>
              <button
                className={`${styles.bigOption} ${contactado === 'no' ? styles.bigOptionNo : ''}`}
                onClick={() => { setContactado('no'); setDireccion(null); setMedio(null) }}
              >
                <span className={styles.bigIcon}>❌</span>
                <span>No fue contactado</span>
              </button>
            </div>
          </div>

          {/* Paso 1 — Detalles del contacto (solo si fue contactado) */}
          {contactado === 'si' && (
            <div className={styles.field}>
              <label className={styles.label}>Detalles del contacto</label>
              <div className={styles.chips}>
                {['Inbound', 'Outbound'].map(d => (
                  <button
                    key={d}
                    className={`${styles.chip} ${direccion === d ? styles.chipActive : ''}`}
                    onClick={() => setDireccion(d)}
                  >{d}</button>
                ))}
              </div>
            </div>
          )}

          {/* Paso 2 — Medio de contacto */}
          {contactado === 'si' && direccion && (
            <div className={styles.field}>
              <label className={styles.label}>Medio de contacto</label>
              <div className={styles.chips}>
                {MEDIOS.map(m => (
                  <button
                    key={m}
                    className={`${styles.chip} ${medio === m ? styles.chipActive : ''}`}
                    onClick={() => handleMedioChange(m)}
                  >{m}</button>
                ))}
              </div>

              {/* Evidencia según el medio */}
              {medio && medio !== 'Videollamada' && (
                <div className={styles.meetWrap}>
                  <label className={styles.sublabel}>{evidenciaLabel} <span className={styles.required}>*</span></label>
                  <input
                    className={`${styles.meetInput} ${evidenciaError ? styles.meetInputError : ''}`}
                    type="text"
                    placeholder={evidenciaPlaceholder}
                    value={evidencia}
                    onChange={e => handleEvidencia(e.target.value)}
                  />
                  {evidenciaError && <p className={styles.meetErrorMsg}>⚠ {evidenciaError}</p>}
                </div>
              )}

              {medio === 'Videollamada' && (
                <div className={styles.meetWrap}>
                  <label className={styles.sublabel}>Link de la videollamada <span className={styles.required}>*</span></label>
                  <input
                    className={`${styles.meetInput} ${meetError ? styles.meetInputError : ''}`}
                    type="text"
                    placeholder={MEET_LINK}
                    value={meetLink}
                    onChange={e => handleMeetLink(e.target.value)}
                  />
                  {meetError && <p className={styles.meetErrorMsg}>⚠ {meetError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Comentario */}
          {(contactado === 'no' || (contactado === 'si' && medio)) && (
            <div className={styles.field}>
              <label className={styles.label}>
                Comentario <span className={styles.required}>*</span>
              </label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Describe el resultado de la gestión..."
              />
            </div>
          )}

          {/* Palancas — solo si fue contactado */}
          {contactado === 'si' && medio && (
            <div className={styles.field}>
              <label className={styles.label}>Palancas <span className={styles.optional}>(opcional)</span></label>
              <div className={styles.palancasGrid}>
                {PALANCAS.map(p => (
                  <button
                    key={p}
                    className={`${styles.palanca} ${palancas.includes(p) ? styles.palancaActive : ''}`}
                    onClick={() => togglePalanca(p)}
                  >{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* Detalle Ads */}
          {palancas.includes('Ads') && (
            <AdsPalancaForm value={adsData} onChange={setAdsData} />
          )}

          {/* Detalle Markdown */}
          {palancas.includes('Markdown') && (
            <MarkdownPalancaForm value={markdownData} onChange={setMarkdownData} />
          )}

          {/* Detalle Catálogo */}
          {palancas.includes('Catálogo') && (
            <CatalogoPalancaForm value={catalogoData} onChange={setCatalogoData} />
          )}

          {/* Detalle Churn */}
          {palancas.includes('Churn') && (
            <ChurnPalancaForm value={churnData} onChange={setChurnData} store={store} />
          )}

          {/* Detalle Top Restaurantes */}
          {palancas.includes('Top Restaurantes') && (
            <TopRestaurantesPalancaForm value={topData} onChange={setTopData} />
          )}

          {/* Detalle Pains */}
          {palancas.includes('Pains') && (
            <PainsPalancaForm value={painsData} onChange={setPainsData} />
          )}

          {/* Detalle Sprints */}
          {palancas.includes('Sprints') && (
            <SprintsPalancaForm value={sprintsData} onChange={setSprintsData} />
          )}

          {error && <p className={styles.error}>⚠ {error}</p>}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={!canSubmit() || saving}
          >
            {saving ? 'Guardando...' : 'Registrar gestión'}
          </button>
        </div>
      </div>
    </div>
  )
}
