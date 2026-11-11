/* Collateral assessment card on the loan file (mock-up screen 03).
   Story: WEB-27 (asking price compared with the ML valuation).
   Decisions: D8 (LTV shown only as the AI calculated it), D9 (neutral badge until the AI
   sends an overvaluation flag), D10 (asking price only before the AI has run). */

import { barWidths, compareAskingToValuation } from '../utils/collateral'
import { formatBps, formatCents, formatSignedCents } from '../utils/format'

const DIRECTION_TEXT = {
  above: 'above',
  below: 'below',
}

// TEMP(AI-OVERVALUED): neutral styling for every difference. When the AI returns a
// structured overvaluation flag, use the warning colours for flagged applications.
function DifferenceBadge({ comparison }) {
  const text =
    comparison.direction === 'equal'
      ? 'Asking price equals valuation'
      : `Asking price ${formatBps(Math.abs(comparison.differenceBps))} ${DIRECTION_TEXT[comparison.direction]} valuation`

  return (
    <span className="rounded-full bg-status-applied-bg px-3 py-1 text-sm font-semibold text-status-applied">
      {text}
    </span>
  )
}

// One labelled amount with a horizontal bar under it (the bar is decoration only)
function AmountBar({ label, note, amount, width, barClass }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p>
          {label}
          {note && <span className="ml-2 text-sm text-muted">{note}</span>}
        </p>
        <p className="font-semibold tabular-nums">{formatCents(amount)}</p>
      </div>
      <div aria-hidden="true" className="mt-2 h-3 overflow-hidden rounded-full bg-page">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function CollateralCard({ collateral }) {
  const comparison = compareAskingToValuation(
    collateral.askingPriceMinorUnits,
    collateral.valuationMinorUnits,
  )
  const widths = barWidths(collateral.askingPriceMinorUnits, collateral.valuationMinorUnits)
  const modelNote = collateral.isMockValuation
    ? `Mock valuation · ${collateral.valuationModelVersion ?? 'AI engine'}`
    : collateral.valuationModelVersion

  return (
    <section
      aria-labelledby="collateral-heading"
      className="rounded-lg border border-line bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="collateral-heading" className="text-xl font-semibold">
          Collateral assessment
        </h2>
        {comparison && <DifferenceBadge comparison={comparison} />}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <AmountBar
          label="Seller's asking price"
          amount={collateral.askingPriceMinorUnits}
          width={widths.asking}
          barClass="bg-status-applied"
        />
        {comparison ? (
          <AmountBar
            label="ML valuation (AVM)"
            note={modelNote}
            amount={collateral.valuationMinorUnits}
            width={widths.valuation}
            barClass="bg-brand"
          />
        ) : (
          <p className="text-sm text-muted">Valuation pending AI assessment.</p>
        )}
      </div>

      {comparison && (
        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Difference</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatSignedCents(comparison.differenceMinorUnits)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">LTV (AI)</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatBps(collateral.ltvBps)}
            </dd>
            <dd className="text-xs text-muted">On the lower of asking price and valuation</dd>
          </div>
        </dl>
      )}
    </section>
  )
}
