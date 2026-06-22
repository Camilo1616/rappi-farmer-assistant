/**
 * Caché en memoria del resultado de /ai/recommend.
 * Sobrevive navegación entre páginas (el módulo JS no se desmonta).
 * Se invalida explícitamente al registrar una gestión o al pasar el día.
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora

let _data      = null
let _fetchedAt = null
let _dateKey   = null  // fecha del día en que se cacheó (YYYY-MM-DD)

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function getCached() {
  if (!_data) return null
  // Invalidar automáticamente si cambió el día
  if (_dateKey !== todayKey()) { _data = null; _fetchedAt = null; _dateKey = null; return null }
  // Invalidar si pasó el TTL
  if (Date.now() - _fetchedAt > CACHE_TTL_MS) { _data = null; _fetchedAt = null; return null }
  return _data
}

export function setCache(data) {
  _data      = data
  _fetchedAt = Date.now()
  _dateKey   = todayKey()
}

export function invalidateCache() {
  _data      = null
  _fetchedAt = null
  _dateKey   = null
}
