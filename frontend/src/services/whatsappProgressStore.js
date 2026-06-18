// Store singleton — sobrevive navegación entre módulos.
// Usa localStorage como respaldo para sobrevivir recargas de página.

const LS_KEY = 'wa_session'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {}
}

const saved = loadFromStorage()

const store = {
  sending:    saved.sending    ?? false,
  progress:   saved.progress   ?? null,
  message:    saved.message    ?? '',
  aiMessages: saved.aiMessages ?? [],
  listeners: new Set(),

  update(patch) {
    Object.assign(store, patch)
    // Persistir en localStorage (excluir listeners)
    saveToStorage({
      sending:    store.sending,
      progress:   store.progress,
      message:    store.message,
      aiMessages: store.aiMessages,
    })
    store.listeners.forEach(fn => fn(store.getSnapshot()))
  },

  subscribe(fn) {
    store.listeners.add(fn)
    return () => store.listeners.delete(fn)
  },

  getSnapshot() {
    return {
      sending:    store.sending,
      progress:   store.progress,
      message:    store.message,
      aiMessages: store.aiMessages,
    }
  },

  // Limpia todo al terminar la sesión de envío
  clear() {
    store.update({ sending: false, progress: null, message: '', aiMessages: [] })
    localStorage.removeItem(LS_KEY)
  },
}

export default store
