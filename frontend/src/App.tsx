import { lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { EmptyState, Spinner } from './components/ui'
import { isAdmin, isStaff, useAuth } from './lib/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Vote from './pages/Vote'
import WinnerDetail from './pages/WinnerDetail'
import Winners from './pages/Winners'
import { ShieldAlert } from 'lucide-react'

// Chart-heavy and staff-only pages load on demand
const AdminOverview = lazy(() => import('./pages/admin/Overview'))
const Audit = lazy(() => import('./pages/admin/Audit'))
const Campaigns = lazy(() => import('./pages/admin/Campaigns'))
const Comments = lazy(() => import('./pages/admin/Comments'))
const Departments = lazy(() => import('./pages/admin/Departments'))
const Employees = lazy(() => import('./pages/admin/Employees'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Profile = lazy(() => import('./pages/Profile'))

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Guard({ allow, children }: { allow: boolean; children: ReactNode }) {
  if (!allow) {
    return (
      <EmptyState icon={ShieldAlert} title="Access denied">
        You do not have permission to access this page.
      </EmptyState>
    )
  }
  return children
}

export default function App() {
  const { user } = useAuth()
  const staff = isStaff(user)
  const admin = isAdmin(user)
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="vote" element={<Vote />} />
        <Route path="winners" element={<Winners />} />
        <Route path="winners/:campaignId" element={<WinnerDetail />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="me" element={<Profile />} />
        <Route path="people/:id" element={<Profile />} />
        <Route path="admin" element={<Guard allow={staff}><AdminOverview /></Guard>} />
        <Route path="admin/campaigns" element={<Guard allow={staff}><Campaigns /></Guard>} />
        <Route path="admin/comments" element={<Guard allow={staff}><Comments /></Guard>} />
        <Route path="admin/employees" element={<Guard allow={staff}><Employees /></Guard>} />
        <Route path="admin/departments" element={<Guard allow={admin}><Departments /></Guard>} />
        <Route path="admin/settings" element={<Guard allow={admin}><Settings /></Guard>} />
        <Route path="admin/audit" element={<Guard allow={admin}><Audit /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
