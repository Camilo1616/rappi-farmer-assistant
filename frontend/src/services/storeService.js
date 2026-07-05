import api from './api'

export const getStores = (params) => api.get('/stores', { params })
export const getStore = (id) => api.get(`/stores/${id}`)
export const globalSearchStores = (q) => api.get('/stores/global-search', { params: { q } })
export const getPriorities = (farmerIds) =>
  api.get('/priorities', { params: { farmerIds: farmerIds.join(',') } })

export const updateStorePhone = (id, phoneNumber) =>
  api.patch(`/stores/${id}/phone`, { phoneNumber })
