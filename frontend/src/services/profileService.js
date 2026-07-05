import api from './api'

export const getProfile     = ()          => api.get('/profile')
export const updateNickname = (nickname)  => api.patch('/profile/nickname', { nickname })
export const uploadAvatar   = (file)      => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/profile/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const changePassword = (currentPassword, newPassword) => api.put('/profile/password', { currentPassword, newPassword })
export const getUsers  = ()   => api.get('/profile/users')
export const promote   = (id) => api.patch(`/profile/${id}/promote`)
export const demote    = (id) => api.patch(`/profile/${id}/demote`)
