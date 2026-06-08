import { useState, useRef, useEffect } from 'react'
import styles from './MultiSelectDropdown.module.css'

export default function MultiSelectDropdown({ options, value = [], onChange, placeholder = 'Seleccionar caso', accentColor = '#FF441F' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = val => onChange(value.includes(val) ? value.filter(x => x !== val) : [...value, val])

  return (
    <div className={styles.wrap} ref={ref}>
      {/* Tags de seleccionados */}
      {value.length > 0 && (
        <div className={styles.tags}>
          {value.map(v => (
            <span key={v} className={styles.tag} style={{ background: accentColor + '22', color: accentColor, borderColor: accentColor + '55' }}>
              {v}
              <button type="button" className={styles.tagRemove} onClick={() => toggle(v)}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Botón disparador */}
      <button type="button" className={styles.trigger} onClick={() => setOpen(o => !o)}
        style={open ? { borderColor: accentColor } : {}}>
        <span>{placeholder}</span>
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Lista desplegable */}
      {open && (
        <div className={styles.dropdown}>
          {options.map(opt => {
            const selected = value.includes(opt)
            return (
              <button key={opt} type="button"
                className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
                style={selected ? { color: accentColor } : {}}
                onClick={() => toggle(opt)}>
                <span className={styles.check} style={{ borderColor: selected ? accentColor : undefined, background: selected ? accentColor : undefined }}>
                  {selected && '✓'}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
