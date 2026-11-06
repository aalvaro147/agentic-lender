/* Main navigation. Links come from roles.js, so each role sees only its pages.
   Shows the signed-in user and a logout button.
   Stories: WEB-13, WEB-16 */

import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { getNavItems, ROLES } from '../auth/roles'

const ROLE_LABELS = {
  [ROLES.BROKER]: 'Mortgage Broker',
  [ROLES.UNDERWRITER]: 'Underwriting Officer',
}

export function Sidebar() {
  const { profile, role, handleLogout } = useAuth()
  const navigate = useNavigate()
  const navItems = getNavItems(role)

  const onLogout = async () => {
    await handleLogout()
    // Go to a clean login page (no "return to previous page" for the next user)
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex flex-col gap-8 bg-navy px-4 py-6 text-white md:w-64 md:shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold">
          AL
        </div>
        <div>
          <p className="font-semibold">Agentic Lender</p>
          <p className="text-xs text-slate-300">
            {role === ROLES.BROKER ? 'Broker portal' : 'Lending portal'}
          </p>
        </div>
      </div>

      {/* Role-based links */}
      <nav aria-label="Main" className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm ${
                isActive
                  ? 'bg-navy-light font-semibold text-white'
                  : 'text-slate-300 hover:bg-navy-light hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Signed-in user */}
      <div className="mt-auto border-t border-navy-light px-2 pt-4">
        <p className="text-sm font-semibold">{profile?.displayName}</p>
        <p className="text-xs text-slate-300">{ROLE_LABELS[role]}</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-3 text-sm text-blue-300 hover:text-white"
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
