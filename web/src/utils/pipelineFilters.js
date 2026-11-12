/* Pipeline filtering, search and sorting.
   Pure functions (no React), so they are easy to test and reuse.
   Stories: WEB-20 (status), WEB-21 (LTV band), WEB-22 (risk tier), WEB-23 (search + sort) */

import { RISK_LABELS, STATUS_LABELS } from './statuses'

/* ----------------------- LTV BANDS (WEB-21) ----------------------- */

// The ONE place the LTV band limits are defined, in basis points (8000 = 80%).
// `maxBps` is inclusive. 90% = Central Bank of Ireland LTV limit for first-time and
// second/subsequent buyers.
export const LTV_BANDS = [
  { id: 'up-to-80', label: '≤ 80%', maxBps: 8000 },
  { id: '80-to-90', label: '> 80% to 90%', maxBps: 9000 },
  { id: 'over-90', label: '> 90%', maxBps: Infinity },
]

// No LTV yet (AI has not run) → no band, so a band filter hides the application
export function getLtvBand(ltvBps) {
  if (ltvBps === null || ltvBps === undefined) return undefined
  return LTV_BANDS.find((band) => ltvBps <= band.maxBps)
}

/* ----------------------- FILTERS (WEB-20, 21, 22, 23) ----------------------- */

export const EMPTY_FILTERS = { search: '', status: 'all', ltvBand: 'all', riskTier: 'all' }

export function hasActiveFilters(filters) {
  return Object.keys(EMPTY_FILTERS).some((key) => filters[key] !== EMPTY_FILTERS[key])
}

// Keeps only the applications that match EVERY active filter
export function filterApplications(applications, filters) {
  const term = filters.search.trim().toLowerCase()

  return applications.filter((app) => {
    if (filters.status !== 'all' && app.status !== filters.status) return false
    if (filters.riskTier !== 'all' && app.riskTier !== filters.riskTier) return false
    if (filters.ltvBand !== 'all' && getLtvBand(app.ltvBps)?.id !== filters.ltvBand) return false
    if (term) {
      const matchesName = (app.borrowerName ?? '').toLowerCase().includes(term)
      const matchesId = app.id.toLowerCase().includes(term)
      if (!matchesName && !matchesId) return false
    }
    return true
  })
}

/* ----------------------- SORTING (WEB-23) ----------------------- */

// Status and risk sort in their natural order (lifecycle, low → high), not alphabetically
const STATUS_ORDER = Object.keys(STATUS_LABELS)
const RISK_ORDER = Object.keys(RISK_LABELS)

// For each sortable column: the value to compare
const SORT_VALUE = {
  id: (app) => app.id,
  borrowerName: (app) => app.borrowerName,
  brokerName: (app) => app.brokerName,
  loanAmountMinorUnits: (app) => app.loanAmountMinorUnits,
  ltvBps: (app) => app.ltvBps,
  lti: (app) => app.lti,
  dtiBps: (app) => app.dtiBps,
  riskTier: (app) => (app.riskTier ? RISK_ORDER.indexOf(app.riskTier) : null),
  status: (app) => STATUS_ORDER.indexOf(app.status),
  submittedAt: (app) => app.submittedAt, // ISO dates sort correctly as text
}

export const DEFAULT_SORT = { key: 'submittedAt', direction: 'desc' }

// Returns a NEW sorted array; the original is never changed
export function sortApplications(applications, sort) {
  const valueOf = SORT_VALUE[sort.key]
  if (!valueOf) return [...applications]
  const factor = sort.direction === 'asc' ? 1 : -1

  return [...applications].sort((a, b) => {
    const va = valueOf(a)
    const vb = valueOf(b)

    // Missing values ("—", e.g. no AI result yet) always go last, in both directions
    const aMissing = va === null || va === undefined
    const bMissing = vb === null || vb === undefined
    if (aMissing !== bMissing) return aMissing ? 1 : -1
    if (aMissing) return a.id.localeCompare(b.id)

    const result = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'en-IE')
    // Equal values: fall back to application ID so the order is always the same
    return result !== 0 ? result * factor : a.id.localeCompare(b.id)
  })
}

// Clicking the same column flips the direction; a new column starts ascending
export function nextSort(current, key) {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key, direction: 'asc' }
}
