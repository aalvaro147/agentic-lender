// Role codes exactly as stored in Firestore users/{uid}.role (see docs/data-contract.md)
export const ROLES = Object.freeze({
  BROKER: 'broker',
  UNDERWRITER: 'underwriter',
})

const ALL_ROLES = [ROLES.BROKER, ROLES.UNDERWRITER]

// Who may open each page. Read by ProtectedRoute (blocks pages)
// and by the sidebar (hides links), so each rule lives in one place.
export const PAGE_ACCESS = Object.freeze({
  pipeline: ALL_ROLES,
  loanFile: ALL_ROLES,
  auditConsole: ALL_ROLES,
  stressTest: [ROLES.UNDERWRITER],
  settlement: [ROLES.UNDERWRITER],
})

// Sidebar links. `page` points into PAGE_ACCESS.
// `labels` lets one page have a different name per role.
const NAV_ITEMS = [
  {
    page: 'pipeline',
    path: '/pipeline',
    labels: { [ROLES.BROKER]: 'My clients', [ROLES.UNDERWRITER]: 'Pipeline' },
  },
  {
    page: 'stressTest',
    path: '/stress-test',
    labels: { [ROLES.UNDERWRITER]: 'Stress test' },
  },
  {
    page: 'settlement',
    path: '/settlement',
    labels: { [ROLES.UNDERWRITER]: 'Settlement & export' },
  },
  // Messages (WEB-48) is added in Sprint 3 if the group confirms AL-Web owns it.
]

// true if this role may open this page; false for unknown roles or pages
export function canAccess(role, page) {
  return PAGE_ACCESS[page]?.includes(role) ?? false
}

// The sidebar links for one role, already labelled for that role
export function getNavItems(role) {
  return NAV_ITEMS.filter((item) => canAccess(role, item.page)).map((item) => ({
    path: item.path,
    label: item.labels[role],
  }))
}
