import api from './api'

export const getSales = () => api.get('/sales').then(r => r.data)
export const createSale = (data) => api.post('/sales', data).then(r => r.data)
export const confirmSale = (id) => api.post(`/sales/${id}/confirm`).then(r => r.data)
export const assignCrop = (id, cropId) => api.put(`/sales/${id}/crop`, { cropId }).then(r => r.data)
export const createOrder = (id) => api.post(`/sales/${id}/order`).then(r => r.data)

export const getCrops = () => api.get('/sales/crops').then(r => r.data)
export const createCrop = (data) => api.post('/sales/crops', data).then(r => r.data)
export const deleteCrop = (id) => api.delete(`/sales/crops/${id}`).then(r => r.data)
export const harvestCrop = (id, kg) => api.post(`/sales/crops/${id}/harvest`, { kg }).then(r => r.data)
