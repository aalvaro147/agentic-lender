import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthContext } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'
import { ROLES } from './roles'

/* ----------------------- FAKE AUTH STATES ----------------------- */

const loggedOut = { user: null, role: null, loading: false }
const broker = { user: { uid: 'mock-broker-01' }, role: ROLES.BROKER, loading: false }
const underwriter = {
  user: { uid: 'mock-underwriter-01' },
  role: ROLES.UNDERWRITER,
  loading: false,
}

/* ----------------------- HELPER ----------------------- */

// Renders a tiny app at `path` with the given auth state
function renderAt(path, authValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route
            path="/pipeline"
            element={
              <ProtectedRoute page="pipeline">
                <p>Pipeline page</p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stress-test"
            element={
              <ProtectedRoute page="stressTest">
                <p>Stress test page</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/* ----------------------- TESTS ----------------------- */

describe('ProtectedRoute', () => {
  it('shows a loading message while the session is being restored', () => {
    renderAt('/pipeline', { ...loggedOut, loading: true })
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('redirects a logged-out user to the login page', () => {
    renderAt('/pipeline', loggedOut)
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Pipeline page')).not.toBeInTheDocument()
  })

  it('lets a broker open the pipeline', () => {
    renderAt('/pipeline', broker)
    expect(screen.getByText('Pipeline page')).toBeInTheDocument()
  })

  it('shows Not authorised when a broker opens the stress test page', () => {
    renderAt('/stress-test', broker)
    expect(screen.getByRole('heading', { name: 'Not authorised' })).toBeInTheDocument()
    expect(screen.queryByText('Stress test page')).not.toBeInTheDocument()
  })

  it('lets an underwriter open the stress test page', () => {
    renderAt('/stress-test', underwriter)
    expect(screen.getByText('Stress test page')).toBeInTheDocument()
  })
})
