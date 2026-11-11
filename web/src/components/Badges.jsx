/* Coloured pills for lifecycle status and risk tier (colours from index.css @theme).
   Full class names are written out on purpose: Tailwind only generates classes
   it can find as complete strings in the source code. */

import { RISK_LABELS, STATUS_LABELS } from '../utils/statuses'
import { EMPTY } from '../utils/format'

const BASE = 'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold'

const STATUS_CLASSES = {
  APPLIED: 'bg-status-applied-bg text-status-applied',
  AI_DELIBERATED: 'bg-status-deliberated-bg text-status-deliberated',
  UNDERWRITER_APPROVED: 'bg-status-approved-bg text-status-approved',
  FUNDED: 'bg-status-funded-bg text-status-funded',
  CLOSED: 'bg-status-closed-bg text-status-closed',
  REJECTED: 'bg-status-rejected-bg text-status-rejected',
}

const RISK_CLASSES = {
  low: 'bg-risk-low-bg text-risk-low',
  medium: 'bg-risk-medium-bg text-risk-medium',
  high: 'bg-risk-high-bg text-risk-high',
}

export function StatusBadge({ status }) {
  return (
    <span className={`${BASE} ${STATUS_CLASSES[status] ?? 'bg-page text-muted'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function RiskBadge({ tier }) {
  // No AI assessment yet (decision D2): plain dash instead of an empty pill
  if (!tier) return <span className="text-muted">{EMPTY}</span>

  return (
    <span className={`${BASE} ${RISK_CLASSES[tier] ?? 'bg-page text-muted'}`}>
      {RISK_LABELS[tier] ?? tier}
    </span>
  )
}
