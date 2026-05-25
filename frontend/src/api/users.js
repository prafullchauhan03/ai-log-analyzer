import api from './axios'

export const getUsers       = (params) => api.get('/users',              { params })
export const getMe          = ()        => api.get('/users/me')
export const updateMe       = (data)    => api.patch('/users/me',         data)
export const changePassword = (data)    => api.patch('/users/me/password', data)
export const changeRole     = (id, role) => api.patch(`/users/${id}/role`, { role })
export const deleteUser     = (id)      => api.delete(`/users/${id}`)
