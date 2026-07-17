import api from './api'

export const getSheetsStatus = () => api.get('/agm/status')
export const connectSheets   = () => api.get('/agm/connect')
export const disconnectSheets = () => api.delete('/agm/disconnect')

export const getCasos = (storeId) =>
  api.get('/agm/casos', { params: storeId ? { storeId } : {} })

export const guardarGestion = (payload) => api.post('/agm/gestion', payload)

// Sin storeId = "mi historial" (filtrado por rango {desde, hasta}, ISO yyyy-MM-dd).
// Con storeId = timeline completo de esa tienda (sin filtro de fecha).
export const getHistorial = (params = {}) => api.get('/agm/historial', { params })

export const getResumenHoy = () => api.get('/agm/resumen-hoy')
export const deshacerUltimoCambio = (payload) => api.post('/agm/deshacer', payload)
export const guardarFeedbackIA = (payload) => api.post('/agm/feedback', payload)
