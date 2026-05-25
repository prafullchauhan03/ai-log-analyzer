import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':      { target: 'http://localhost:8000', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:8000', changeOrigin: true },
      '/infra':     { target: 'http://localhost:8000', changeOrigin: true },
      '/alerts':    { target: 'http://localhost:8000', changeOrigin: true },
      '/ai':        { target: 'http://localhost:8000', changeOrigin: true },
      '/users':     { target: 'http://localhost:8000', changeOrigin: true },
      '/settings':  { target: 'http://localhost:8000', changeOrigin: true },
      '/ws':        { target: 'ws://localhost:8000',   ws: true, changeOrigin: true },
    },
  },
})
