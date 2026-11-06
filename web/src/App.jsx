/* Route map for AL-Web.
   Outer ProtectedRoute (no `page`)  = must be signed in.
   Inner ProtectedRoute (with `page`) = must also have the right role (roles.js).
   Story: WEB-02 */

import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { PipelinePage } from './pages/PipelinePage'
import { LoanFilePage } from './pages/LoanFilePage'
import { AuditConsolePage } from './pages/AuditConsolePage'
import { StressTestPage } from './pages/StressTestPage'
import { SettlementPage } from './pages/SettlementPage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/pipeline" replace />} />

      {/* Signed-in area: sidebar layout around every page */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/pipeline"
            element={
              <ProtectedRoute page="pipeline">
                <PipelinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <ProtectedRoute page="loanFile">
                <LoanFilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications/:id/audit"
            element={
              <ProtectedRoute page="auditConsole">
                <AuditConsolePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stress-test"
            element={
              <ProtectedRoute page="stressTest">
                <StressTestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settlement"
            element={
              <ProtectedRoute page="settlement">
                <SettlementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settlement/:id"
            element={
              <ProtectedRoute page="settlement">
                <SettlementPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

      {/* Anything else */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
