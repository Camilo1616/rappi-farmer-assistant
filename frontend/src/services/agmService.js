import api from './api'

export const getSheetsStatus = () => api.get('/agm/status')
export const connectSheets   = () => api.get('/agm/connect')
export const disconnectSheets = () => api.delete('/agm/disconnect')

export const getCasos = (storeId) =>
  api.get('/agm/casos', { params: storeId ? { storeId } : {} })

export const guardarGestion = (payload) => api.post('/agm/gestion', payload)
