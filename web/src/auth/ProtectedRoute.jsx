/* Guards routes that require a signed-in user, and optionally a specific role.

   Order of checks:
   1. Still restoring the session? → show a loading message (never redirect yet)
   2. Nobody signed in?            → redirect to /login, remembering the page asked for
   3. Wrong role for this page?    → show "Not authorised"
   4. Otherwise                    → render the page

   `page` is a key from PAGE_ACCESS in roles.js (e.g. "stressTest").
   Without `page`, any signed-in user may enter.
   Stories: WEB-14 (and WEB-13, WEB-16) */

import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { canAccess } from './roles'
import { NotAuthorisedPage } from '../pages/NotAuthorisedPage'

/* ----------------------- PROTECTED ROUTE ----------------------- */

export function ProtectedRoute({ page, children }) {
  // current user, their role, and whether the first auth check is still running
  const { user, role, loading } = useAuth()

  // the URL the user tried to open, e.g. /stress-test
  const location = useLocation()

  // 1. Session still being restored (page refresh): wait, don't redirect
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-muted">
          Checking your session…
        </p>
      </div>
    )
  }

  // 2. Not signed in: go to /login and remember where they were going.
  //    `replace` swaps the history entry so the Back button doesn't loop.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // 3. Signed in, but this role may not open this page
  if (page && !canAccess(role, page)) {
    return <NotAuthorisedPage />
  }

  // 4. Allowed: render the wrapped page, or child routes when used as a layout route
  return children ?? <Outlet />
}
