import { Toaster } from 'react-hot-toast'
import AppRoutes from './routes/AppRoutes'
import './index.css'

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
          },
        }}
      />
    </>
  )
}

export default App
