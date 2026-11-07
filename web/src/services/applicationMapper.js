/* WEB-08: turns an AL-Core Firestore document (applications/{applicationId}) into the
   row the pipeline displays. Mock mode and live mode both go through this function,
   so the mocks test the same code path as real Firestore data.

   Source of truth: al-core-ledger/firebase/schemas/applications.schema.json
   Units stay as AL-Core stores them (cents, basis points); converting them for
   display is the formatters' job (utils/format.js).
   Missing values become null (shown as "—"), never 0. */

// TEMP(Q4-RISK): AL-Core and the AI engine have no risk tier yet (decision D3).
// Until the AI returns one, the tier is derived from the AI recommendation.
// Replace with aiAssessment's own risk field when the AI provides it.
const RISK_BY_RECOMMENDATION = {
  APPROVE: 'low',
  CONDITIONALLY_APPROVE: 'medium',
  DECLINE: 'high',
}

// Firestore returns a Timestamp object; mocks store an ISO string
function toIsoString(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return String(value)
}

// "Cork" → "Co. Cork" (AL-Core stores the county only, no town)
function toLocation(county) {
  if (!county) return null
  return county.startsWith('Co.') ? county : `Co. ${county}`
}

// TEMP(Q1-LOAN): AL-Core has no loan-amount field. Until Core confirms one,
// loan = asking price − deposit. Replace with the agreed field (needed for the
// settlement request's loan.principalMinorUnits).
function toLoanAmount(propertySpecs, financialSpecs) {
  const asking = propertySpecs?.askingPriceMinorUnits
  const deposit = financialSpecs?.depositMinorUnits
  if (!Number.isInteger(asking) || !Number.isInteger(deposit)) return null
  const loan = asking - deposit
  return loan > 0 ? loan : null
}

// TEMP(Q3-NAMES): names come from users/{uid}.displayName. With the current rules
// only an underwriter can read other users' profiles, so a live broker gets null.
// Update when Core changes the rules or adds a display-name field.
function displayNameOf(uid, usersById) {
  if (!uid) return null
  return usersById[uid]?.displayName ?? null
}

/**
 * @param {object} doc        Firestore data, plus `id` (document ID) when read live
 * @param {object} usersById  { [uid]: { displayName } }, the profiles the user may read
 */
export function toPipelineRow(doc, usersById = {}) {
  const ai = doc.aiAssessment ?? null
  const recommendation = ai?.recommendation ?? null

  return {
    id: doc.applicationId ?? doc.id,
    status: doc.status,
    borrowerId: doc.borrowerId,
    borrowerName: displayNameOf(doc.borrowerId, usersById),
    brokerId: doc.brokerId ?? null,
    brokerName: displayNameOf(doc.brokerId, usersById),
    location: toLocation(doc.propertySpecs?.county),
    loanAmountMinorUnits: toLoanAmount(doc.propertySpecs, doc.financialSpecs),

    // Calculated by the AI engine only (decision D2): null until AI_DELIBERATED
    ltvBps: ai?.valuation?.ltvBps ?? null,
    // TEMP(AI-FIELDS): AL-Core only says affordability is an object. These names come
    // from the AI engine (mock-0.2) and may change when it is aligned with Core.
    dtiBps: ai?.affordability?.dtiBps ?? null,
    lti: ai?.affordability?.loanToIncomeMultiple ?? null,
    recommendation,
    riskTier: RISK_BY_RECOMMENDATION[recommendation] ?? null,

    submittedAt: toIsoString(doc.createdAt),
  }
}
