// Store singleton — sobrevive la navegación entre módulos.
// WhatsappPage lo lee al montarse para reconectar el progreso visual.

const store = {
  sending: false,
  progress: null,
  listeners: new Set(),

  update(patch) {
    Object.assign(store, patch)
    store.listeners.forEach(fn => fn({ sending: store.sending, progress: store.progress }))
  },

  subscribe(fn) {
    store.listeners.add(fn)
    return () => store.listeners.delete(fn)
  },

  getSnapshot() {
    return { sending: store.sending, progress: store.progress }
  },
}

export default store
