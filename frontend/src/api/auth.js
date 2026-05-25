import api from './axios'

export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password })

export const registerUser = (username, email, password) =>
  api.post('/auth/register', { username, email, password })
