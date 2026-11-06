import api from './api'

export const listUsers = () => api.get('/usuarios').then(r => r.data)
export const createUser = (data) => api.post('/usuarios', data).then(r => r.data)
export const resendAccess = (id) => api.post(`/usuarios/${id}/resend`).then(r => r.data)
export const setUserActive = (id, active) => api.put(`/usuarios/${id}/active`, { active }).then(r => r.data)
export const setUserRole = (id, role) => api.put(`/usuarios/${id}/role`, { role }).then(r => r.data)
