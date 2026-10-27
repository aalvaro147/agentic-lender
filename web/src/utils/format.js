/* Display formatting used across AL-Web (Irish English, euro). */

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

export const formatEuro = (amount) => euro.format(amount) // 342000 → €342,000
export const formatPercent = (value) => `${value.toFixed(1)}%` // 90 → 90.0%
export const formatMultiple = (value) => `${value.toFixed(2)}×` // 3.98 → 3.98×
export const formatDate = (isoDate) => shortDate.format(new Date(isoDate)) // → 08 Oct 2026
