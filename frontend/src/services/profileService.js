import api from './api'

export const getProfile    = ()             => api.get('/profile')
export const updateNickname = (nickname)    => api.patch('/profile/nickname', { nickname })
export const uploadAvatar  = (file)         => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/profile/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const getPerformance  = ()                      => api.get('/profile/performance')
export const changePassword  = (currentPassword, newPassword) => api.put('/profile/password', { currentPassword, newPassword })
export const getNotes        = ()                      => api.get('/profile/notes')
export const createNote      = (content)               => api.post('/profile/notes', { content })
export const updateNote      = (id, content)           => api.put(`/profile/notes/${id}`, { content })
export const deleteNote      = (id)                    => api.delete(`/profile/notes/${id}`)
export const getFarmers    = ()             => api.get('/profile/farmers')
export const promote       = (id)           => api.patch(`/profile/${id}/promote`)
export const demote        = (id)           => api.patch(`/profile/${id}/demote`)
export const assignCountry = (id, code)     => api.patch(`/profile/${id}/country`, { countryCode: code })
export const removeCountry = (id, code)     => api.delete(`/profile/${id}/country/${code}`)
