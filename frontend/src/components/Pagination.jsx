import styles from './Pagination.module.css'

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.ceil(total / pageSize) || 1

  if (total === 0) return null

  const from = page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  const getPageNumbers = () => {
    const delta = 2
    const left = Math.max(0, page - delta)
    const right = Math.min(totalPages - 1, page + delta)
    const nums = []
    for (let i = left; i <= right; i++) nums.push(i)
    return nums
  }

  const pages = getPageNumbers()

  return (
    <div className={styles.wrap}>
      <span className={styles.info}>{from}–{to} de {total}</span>

      <div className={styles.controls}>
        <button className={styles.btn} disabled={page === 0} onClick={() => onPageChange(0)} title="Primera página">«</button>
        <button className={styles.btn} disabled={page === 0} onClick={() => onPageChange(page - 1)} title="Anterior">‹</button>

        {pages[0] > 0 && <span className={styles.ellipsis}>…</span>}

        {pages.map(p => (
          <button
            key={p}
            className={`${styles.btn} ${p === page ? styles.active : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p + 1}
          </button>
        ))}

        {pages[pages.length - 1] < totalPages - 1 && <span className={styles.ellipsis}>…</span>}

        <button className={styles.btn} disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} title="Siguiente">›</button>
        <button className={styles.btn} disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} title="Última página">»</button>
      </div>

      {onPageSizeChange && (
        <select
          className={styles.sizeSelect}
          value={pageSize}
          onChange={e => { onPageChange(0); onPageSizeChange(Number(e.target.value)) }}
        >
          {[10, 20, 50, 100].map(s => (
            <option key={s} value={s}>{s} / pág</option>
          ))}
        </select>
      )}
    </div>
  )
}
