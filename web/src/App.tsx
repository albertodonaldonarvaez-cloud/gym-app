import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Layout from './components/Layout'
import LoginPage    from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import RoutinesPage  from './pages/RoutinesPage'
import ExercisesPage from './pages/ExercisesPage'

function RequireCoach({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080d1a]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 animate-pulse" />
          <p className="text-slate-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }
  if (!user || user.role !== 'COACH') return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireCoach>
                <Layout />
              </RequireCoach>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="routines"  element={<RoutinesPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
