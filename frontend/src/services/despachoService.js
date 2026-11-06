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
