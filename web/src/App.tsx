import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Layout from './components/Layout'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RoutinesPage  from './pages/RoutinesPage'
import ExercisesPage from './pages/ExercisesPage'
import UsersPage     from './pages/UsersPage'
import AssignmentsPage from './pages/AssignmentsPage'
import SettingsPage  from './pages/SettingsPage'
import ClientApp     from './client/ClientApp'

function RequireCoachOrAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 animate-pulse" /></div>
  if (!user || (user.role !== 'ADMIN' && user.role !== 'COACH')) return <Navigate to="/login" replace />
  return <>{children}</>
}

function SmartRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 animate-pulse" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'CLIENT') return <Navigate to="/client" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<SmartRedirect />} />

          {/* Coach / Admin dashboard */}
          <Route
            path="/dashboard"
            element={<RequireCoachOrAdmin><Layout /></RequireCoachOrAdmin>}
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="routines" element={<RoutinesPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Client mobile-first app */}
          <Route path="/client/*" element={<ClientApp />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
