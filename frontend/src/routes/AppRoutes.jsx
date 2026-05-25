import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }   from '../context/AuthContext'
import ProtectedRoute     from '../components/ProtectedRoute'
import Login              from '../pages/Login'
import Register           from '../pages/Register'
import Dashboard          from '../pages/Dashboard'
import LiveLogs           from '../pages/LiveLogs'
import SystemHealth       from '../pages/SystemHealth'
import Alerts             from '../pages/Alerts'
import AIInsights         from '../pages/AIInsights'
import UserManagement     from '../pages/UserManagement'
import Settings           from '../pages/Settings'
import Placeholder        from '../pages/Placeholder'

const AppRoutes = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/live-logs"     element={<ProtectedRoute><LiveLogs /></ProtectedRoute>} />
        <Route path="/system-health" element={<ProtectedRoute><SystemHealth /></ProtectedRoute>} />
        <Route path="/alerts"        element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
        <Route path="/ai-insights"   element={<ProtectedRoute><AIInsights /></ProtectedRoute>} />
        <Route path="/users"         element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
        <Route path="/settings"      element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*"              element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)

export default AppRoutes
