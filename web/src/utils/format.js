/* Display formatting used across AL-Web (Irish English, euro).
   AL-Core stores money as integer cents ("minor units") and rates as basis points
   (bps: 100 bps = 1%). See docs/data-contract.md.
   Every formatter shows "—" when a value is missing (e.g. no AI assessment yet).

   Temporary code is marked TEMP(<tag>). Find it all with: grep -rn "TEMP(" web/src docs
   The full list is in docs/data-contract.md → "Temporary items". */

export const EMPTY = '—'

const isMissing = (value) => value === null || value === undefined || Number.isNaN(value)

const euro = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

// timeZone UTC: "2026-10-08" always shows as 08 Oct, wherever the browser is
const shortDate = new Intl.DateTimeFormat('en-IE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/* ----------------------- MONEY ----------------------- */

// Cents from AL-Core: 34200000 → €342,000 (rounded to the nearest euro)
export const formatCents = (minorUnits) =>
  isMissing(minorUnits) ? EMPTY : euro.format(minorUnits / 100)

/* ----------------------- RATES AND RATIOS ----------------------- */

// Percent value: 90 → 90.0%
export const formatPercent = (value, decimals = 1) =>
  isMissing(value) ? EMPTY : `${value.toFixed(decimals)}%`

// Basis points: 8247 → 82.5% (LTV, DTI); formatBps(350, 2) → 3.50% (APR)
export const formatBps = (bps, decimals = 1) =>
  isMissing(bps) ? EMPTY : formatPercent(bps / 100, decimals)

// Multiple: 3.98 → 3.98×
export const formatMultiple = (value) => (isMissing(value) ? EMPTY : `${value.toFixed(2)}\u00D7`)
/* ----------------------- PROPERTY ----------------------- */

// Floor area: 110 → 110 m² (WEB-30)
export const formatArea = (squareMetres) => (isMissing(squareMetres) ? EMPTY : `${squareMetres} m²`)

/* ----------------------- DATES ----------------------- */

// "2026-10-08" or "2026-10-08T09:30:00Z" → 08 Oct 2026
export const formatDate = (isoDate) => {
  if (!isoDate) return EMPTY
  const date = new Date(isoDate)
  return Number.isNaN(date.getTime()) ? EMPTY : shortDate.format(date)
}
