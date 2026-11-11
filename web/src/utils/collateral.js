/* Asking price vs ML valuation (WEB-27) and deposit share (WEB-29).
   Pure functions, no React. Amounts are AL-Core cents.
   AL-Web only subtracts and compares stored values; LTV stays with the AI (D8). */

// How far the asking price is from the valuation, as a share of the valuation.
// Returns null when either value is missing (e.g. no AI assessment yet, D10).
export function compareAskingToValuation(askingMinorUnits, valuationMinorUnits) {
  if (!Number.isInteger(askingMinorUnits) || !Number.isInteger(valuationMinorUnits)) return null
  if (valuationMinorUnits <= 0) return null

  const differenceMinorUnits = askingMinorUnits - valuationMinorUnits
  let direction = 'equal'
  if (differenceMinorUnits > 0) direction = 'above'
  if (differenceMinorUnits < 0) direction = 'below'

  return {
    differenceMinorUnits,
    // basis points of the valuation: 1185000 / 38315000 -> 309 bps (3.1%)
    differenceBps: Math.round((differenceMinorUnits * 10000) / valuationMinorUnits),
    direction,
  }
}

// Bar lengths in percent: the larger value fills the bar, the other is scaled to it
export function barWidths(askingMinorUnits, valuationMinorUnits) {
  const largest = Math.max(askingMinorUnits ?? 0, valuationMinorUnits ?? 0)
  if (largest <= 0) return { asking: 0, valuation: 0 }
  const share = (value) => (value ? Math.round((value / largest) * 1000) / 10 : 0)
  return { asking: share(askingMinorUnits), valuation: share(valuationMinorUnits) }
}

// Deposit as a share of the purchase price (WEB-29, D12), in basis points
export function depositShareBps(depositMinorUnits, purchasePriceMinorUnits) {
  if (!Number.isInteger(depositMinorUnits) || !Number.isInteger(purchasePriceMinorUnits)) {
    return null
  }
  if (purchasePriceMinorUnits <= 0) return null
  return Math.round((depositMinorUnits * 10000) / purchasePriceMinorUnits)
}
