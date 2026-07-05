import api from './api'

export const getWhatsappStatus  = () => api.get('/whatsapp/status')
export const getWhatsappQr      = () => api.get('/whatsapp/qr')
export const openChrome         = () => api.post('/whatsapp/open')
export const closeChrome        = () => api.post('/whatsapp/close')
export const logoutSession      = () => api.post('/whatsapp/logout')
export const waitConnection     = (timeout = 60) => api.get(`/whatsapp/wait-connection?timeout=${timeout}`)
export const sendTest           = (phone, message) => api.post('/whatsapp/test', { phone, message })
