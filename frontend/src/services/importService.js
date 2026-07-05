import api from './api'

export const clearStores = () => api.post('/import/clear')

export const downloadTemplate = () =>
  api.get('/import/template', { responseType: 'blob' })

export const getImportStatus = () => api.get('/import/status')

export const uploadExcel = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/import/excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
    },
  })
}
