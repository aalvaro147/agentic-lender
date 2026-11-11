/* Human-readable labels for the status codes AL-Core stores (case-sensitive).
   Source: al-core-ledger/docs/team-integration-guide.md, "Shared application lifecycle".
   Order here = order of the pipeline summary cards and of status sorting. */

export const STATUS_LABELS = {
  APPLIED: 'Applied',
  AI_DELIBERATED: 'AI Deliberated',
  UNDERWRITER_APPROVED: 'Underwriter Approved',
  FUNDED: 'Funded',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
}

// TEMP(Q4-RISK): AL-Web's own provisional tiers, derived from the AI recommendation
// in services/applicationMapper.js until the AI returns a real risk tier.
export const RISK_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
