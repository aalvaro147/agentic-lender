/* Coloured pills for lifecycle status and risk tier (colours from index.css @theme).
   Full class names are written out on purpose: Tailwind only generates classes
   it can find as complete strings in the source code. */

import { RISK_LABELS, STATUS_LABELS } from '../utils/statuses'

const BASE = 'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold'

const STATUS_CLASSES = {
  applied: 'bg-status-applied-bg text-status-applied',
  ai_deliberated: 'bg-status-deliberated-bg text-status-deliberated',
  underwriter_approved: 'bg-status-approved-bg text-status-approved',
  funded: 'bg-status-funded-bg text-status-funded',
  closed: 'bg-status-closed-bg text-status-closed',
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
  return (
    <span className={`${BASE} ${RISK_CLASSES[tier] ?? 'bg-page text-muted'}`}>
      {RISK_LABELS[tier] ?? tier}
    </span>
  )
}
