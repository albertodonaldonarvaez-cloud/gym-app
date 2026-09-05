import { Routes, Route, Navigate } from 'react-router-dom'
import ClientLayout from './ClientLayout'
import HomePage from './pages/HomePage'
import CatalogPage from './pages/CatalogPage'
import HistoryPage from './pages/HistoryPage'
import WorkoutPage from './pages/WorkoutPage'
import ClientProfilePage from './pages/ClientProfilePage'
import { getToken, getUser } from './clientApi'

function RequireClient({ children }: { children: React.ReactNode }) {
  const token = getToken()
  const user = getUser()
  if (!token || !user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function ClientApp() {
  return (
    <RequireClient>
      <Routes>
        <Route element={<ClientLayout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="profile" element={<ClientProfilePage />} />
        </Route>
        <Route path="workout" element={<WorkoutPage />} />
      </Routes>
    </RequireClient>
  )
}
