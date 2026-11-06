import api from './api'

export const getDay = (date) => api.get('/despacho/day', { params: { date } }).then(r => r.data)
export const setHarvest = (date, category, boxes) =>
  api.put('/despacho/harvest', { date, category, boxes }).then(r => r.data)
export const setDiscard = (date, category, boxes) =>
  api.put('/despacho/discard', { date, category, boxes }).then(r => r.data)
export const setLine = (date, clientId, category, orderedBoxes, deliveredBoxes) =>
  api.put('/despacho/line', { date, clientId, category, orderedBoxes, deliveredBoxes }).then(r => r.data)
export const setPrice = (category, price) => api.put('/despacho/prices', { category, price }).then(r => r.data)
export const createSector = (name) => api.post('/despacho/sectors', { name }).then(r => r.data)
export const createClient = (data) => api.post('/despacho/clients', data).then(r => r.data)

export const getPortfolio = (date) => api.get('/despacho/portfolio', { params: { date } }).then(r => r.data)
export const addPayment = (data) => api.post('/despacho/payments', data).then(r => r.data)
export const deletePayment = (id, date) => api.delete(`/despacho/payments/${id}`, { params: { date } }).then(r => r.data)

export const getReport = (from, to) => api.get('/despacho/report', { params: { from, to } }).then(r => r.data)
export const searchClients = (q, date) => api.get('/despacho/clients/search', { params: { q, date } }).then(r => r.data)

// ── Cultivos, viajes y utilidad ──
export const getCultivoDay = (date) => api.get('/cultivos/day', { params: { date } }).then(r => r.data)
export const createCrop = (name) => api.post('/cultivos', { name }).then(r => r.data)
export const setCropPrice = (cropId, category, price) => api.put('/cultivos/prices', { cropId, category, price }).then(r => r.data)
export const setIntake = (date, cropId, category, boxes) => api.put('/cultivos/intake', { date, cropId, category, boxes }).then(r => r.data)

export const getTripDay = (date) => api.get('/viajes/day', { params: { date } }).then(r => r.data)
export const createTrip = (data) => api.post('/viajes', data).then(r => r.data)
export const deleteTrip = (id, date) => api.delete(`/viajes/${id}`, { params: { date } }).then(r => r.data)
export const addTripEntry = (data) => api.post('/viajes/entries', data).then(r => r.data)
export const deleteTripEntry = (id, date) => api.delete(`/viajes/entries/${id}`, { params: { date } }).then(r => r.data)
export const savePreset = (data, date) => api.put('/viajes/presets', data, { params: { date } }).then(r => r.data)
export const deletePreset = (id, date) => api.delete(`/viajes/presets/${id}`, { params: { date } }).then(r => r.data)

export const getProfit = (from, to) => api.get('/despacho/profit', { params: { from, to } }).then(r => r.data)
