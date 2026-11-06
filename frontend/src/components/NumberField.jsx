import styles from '../pages/DespachoPage.module.css'

/** Input numérico que guarda al salir del campo (evita una petición por tecla). */
export default function NumberField({ value, onCommit, label }) {
  const commit = (el) => {
    const n = Math.max(0, parseInt(el.value, 10) || 0)
    el.value = String(n)
    if (n !== value) onCommit(n)
  }
  // key={value}: si el valor del servidor cambia, el input se reinicia con el dato real
  return (
    <input key={value} className={styles.num} type="number" inputMode="numeric" min="0" aria-label={label}
      defaultValue={value} onBlur={e => commit(e.target)}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}
