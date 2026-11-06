import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import styles from './VentasTable.module.css'

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
// Encabezados cortos como en la hoja de cálculo
const SHORT = { JUMBO: 'Jumbo', PRIMERA: '1ª', SEGUNDA: '2ª', TERCERA: '3ª', CUARTA: '4ª', QUINTA: '5ª', MADURA: 'Mad.', BOLSAS: 'Bol.' }

/** Celda numérica editable: guarda al salir del campo o con Enter (una petición por cambio, no por tecla). */
function Cell({ value, onCommit, label, cls }) {
  const commit = (el) => {
    const n = Math.max(0, parseInt(el.value, 10) || 0)
    el.value = String(n)
    if (n !== value) onCommit(n)
  }
  // key={value}: si el servidor devuelve otro valor (p. ej. rechazó por falta de stock) la celda se reinicia
  return (
    <input key={value} className={`${styles.cell} ${value === 0 ? styles.cellZero : ''} ${cls || ''}`} type="number" inputMode="numeric"
      min="0" aria-label={label} defaultValue={value} onFocus={e => e.target.select()}
      onBlur={e => commit(e.target)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
  )
}

/**
 * Tabla de ventas del día (como la hoja de cálculo): una fila por cliente y una columna por categoría.
 * mode 'entrega' edita lo despachado; mode 'pedido' edita lo pedido.
 */
export default function VentasTable({ day, mode, onModeChange, onSave }) {
  const navigate = useNavigate()
  const cats = day.stock.map(s => s.category)
  const lineOf = (c, cat) => c.lines.find(l => l.category === cat) || { ordered: 0, delivered: 0 }

  const edit = (client, cat, value) => {
    const l = lineOf(client, cat)
    if (mode === 'entrega') {
      // Si no había pedido registrado, la entrega se toma también como pedido (evita "de más" falsos)
      onSave(client.id, cat, l.ordered === 0 ? value : l.ordered, value)
    } else {
      onSave(client.id, cat, value, l.delivered)
    }
  }

  const totals = (clients) => {
    const t = Object.fromEntries(cats.map(c => [c, 0]))
    clients.forEach(c => c.lines.forEach(l => { t[l.category] += mode === 'entrega' ? l.delivered : l.ordered }))
    return t
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.seg} role="tablist" aria-label="Qué se edita">
          <button className={`${styles.segBtn} ${mode === 'entrega' ? styles.segOn : ''}`} onClick={() => onModeChange('entrega')}>Entrega</button>
          <button className={`${styles.segBtn} ${mode === 'pedido' ? styles.segOn : ''}`} onClick={() => onModeChange('pedido')}>Pedido</button>
        </div>
        <div className={styles.legend}>
          <span><span className={styles.dot} style={{ background: 'rgba(217,119,6,.5)' }} />Entregó menos de lo pedido</span>
          <span><span className={styles.dot} style={{ background: 'rgba(22,163,74,.5)' }} />Entregó de más</span>
        </div>
      </div>

      {day.sectors.length === 0 && <div className={styles.sector}><div className={styles.empty}>Aún no hay sectores. Créalos en “Administrar”.</div></div>}

      {day.sectors.map(sec => {
        const t = totals(sec.clients)
        const totalBoxes = Object.values(t).reduce((a, b) => a + b, 0)
        return (
          <section key={sec.id} className={styles.sector}>
            <div className={styles.sectorHead}>
              <div>
                <div className={styles.sectorName}>{sec.name}</div>
                <div className={styles.sectorMeta}>{sec.clients.length} cliente{sec.clients.length !== 1 ? 's' : ''} · pedido {sec.orderedBoxes} · entrega {sec.deliveredBoxes}</div>
              </div>
              <span className={styles.chip}>{money(sec.invoiceTotal)}</span>
            </div>
            {sec.clients.length === 0 ? <div className={styles.empty}>Este sector aún no tiene clientes.</div> : (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.sticky}>Cliente</th>
                      {cats.map(c => <th key={c} title={day.stock.find(s => s.category === c).label}>{SHORT[c]}</th>)}
                      <th>Cajas</th>
                      <th className={styles.moneyHead}>Factura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.clients.map(c => (
                      <tr key={c.id}>
                        <th className={styles.sticky} scope="row">
                          <button className={styles.nameBtn} onClick={() => navigate(`/despacho/cliente/${c.id}`)} title="Abrir ficha del cliente">
                            {c.name}{c.overdue && <span className={styles.mora} title="Cliente en mora"><Icon name="alert" size={14} /></span>}
                          </button>
                        </th>
                        {cats.map(cat => {
                          const l = lineOf(c, cat)
                          const diffCls = mode === 'entrega' && l.ordered > 0 && l.delivered !== l.ordered
                            ? (l.delivered < l.ordered ? styles.less : styles.more) : ''
                          return (
                            <td key={cat}>
                              <Cell value={mode === 'entrega' ? l.delivered : l.ordered} cls={diffCls}
                                label={`${c.name} ${day.stock.find(s => s.category === cat).label} ${mode}`}
                                onCommit={v => edit(c, cat, v)} />
                            </td>
                          )
                        })}
                        <td className={styles.num}>{mode === 'entrega' ? c.deliveredBoxes : c.orderedBoxes}</td>
                        <td className={styles.money}>{money(c.invoiceTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={styles.foot}>
                      <th className={styles.sticky} scope="row">Totales</th>
                      {cats.map(c => <td key={c}>{t[c] || ''}</td>)}
                      <td>{totalBoxes}</td>
                      <td className={styles.money}>{money(sec.invoiceTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )
      })}

      {day.sectors.length > 0 && (
        <div className={styles.sector}>
          <div className={styles.sectorHead}>
            <div><div className={styles.sectorName}>Enviado en total</div>
              <div className={styles.sectorMeta}>Suma de todos los sectores</div></div>
            <span className={styles.chip}>{money(day.summary.salesTotal)}</span>
          </div>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <tbody>
                <tr className={styles.foot}>
                  <th className={styles.sticky} scope="row">{mode === 'entrega' ? 'Entregado' : 'Pedido'}</th>
                  {cats.map(c => <td key={c}>{totals(day.sectors.flatMap(s => s.clients))[c] || ''}</td>)}
                  <td>{day.sectors.flatMap(s => s.clients).reduce((a, c) => a + (mode === 'entrega' ? c.deliveredBoxes : c.orderedBoxes), 0)}</td>
                  <td className={styles.money}>{money(day.summary.salesTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={styles.hint}>Toca un número para editarlo; se guarda al salir de la celda. Toca el nombre para abrir la ficha del cliente.</div>
        </div>
      )}
    </div>
  )
}
