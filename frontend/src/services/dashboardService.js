import api from './api'

/** @typedef {import('../types/api').components['schemas']['DashboardDataDto']} DashboardDataDto */

/** @returns {Promise<import('axios').AxiosResponse<DashboardDataDto>>} */
export const getDashboard      = () => api.get('/dashboard')
export const getLiderDashboard = () => api.get('/dashboard/lider')
export const getBasesForFarmer = () => api.get('/bases/farmer')
export const updateBaseStatus  = (assignmentId, status, farmerComment) =>
  api.patch(`/bases/assignment/${assignmentId}/status`, { status, farmerComment })
export const getNotifications       = () => api.get('/bases/notifications')
export const getUnreadCount         = () => api.get('/bases/notifications/unread-count')
export const markAllNotifRead       = () => api.post('/bases/notifications/mark-all-read')
export const registerManagement     = (storeId, body) => api.post(`/stores/${storeId}/management`, body)
export const getTodayManagements    = () => api.get('/stores/managements/today')
export const updateManagement       = (id, body) => api.put(`/stores/managements/${id}`, body)
export const deleteManagement       = (id) => api.delete(`/stores/managements/${id}`)
export const getBasesForLider       = () => api.get('/bases/lider')
export const getFarmerManagements   = (farmerId) => api.get(`/dashboard/lider/farmer/${farmerId}/managements`)
export const getStoresByBaseType    = (type, farmerIds, params = {}) =>
  api.get('/stores/by-base-type', { params: { type, farmerIds, ...params } })
export const getBaseStores          = (baseId) => api.get(`/bases/${baseId}/stores`)
export const deleteBase             = (baseId) => api.delete(`/bases/${baseId}`)
