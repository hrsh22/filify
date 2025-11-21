import { Routes, Route } from 'react-router-dom'
import { LandingPage } from '@/pages/landing'
import { AuthCallbackPage } from '@/pages/auth-callback'
import { AuthErrorPage } from '@/pages/auth-error'
import { DashboardPage } from '@/pages/dashboard'
import { NewProjectPage } from '@/pages/new-project'
import { ProjectDetailPage } from '@/pages/project-detail'
import { DeploymentDetailPage } from '@/pages/deployment-detail'
import { NotFoundPage } from '@/pages/not-found'
import { ProtectedRoute } from '@/routes/protected-route'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/success" element={<AuthCallbackPage />} />
      <Route path="/auth/error" element={<AuthErrorPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/deployments/:deploymentId" element={<DeploymentDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
