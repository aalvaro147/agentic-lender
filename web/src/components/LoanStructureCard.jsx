/* Loan structure card on the loan file (mock-up screen 03).
   Story: WEB-29 (loan amount, deposit and LTV shown together; LTV is in the
   headline figures and the collateral card).
   Decisions: D11 (rate = the AI's indicative rate), D12 (deposit share of the price). */

import { depositShareBps } from '../utils/collateral'
import { formatBps, formatCents, formatTerm } from '../utils/format'

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={strong ? 'font-semibold' : 'text-muted'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  )
}

export function LoanStructureCard({ loanStructure }) {
  const share = depositShareBps(
    loanStructure.depositMinorUnits,
    loanStructure.purchasePriceMinorUnits,
  )
  const deposit =
    share === null
      ? formatCents(loanStructure.depositMinorUnits)
      : `${formatCents(loanStructure.depositMinorUnits)} (${formatBps(share)})`

  return (
    <section
      aria-labelledby="loan-structure-heading"
      className="rounded-lg border border-line bg-white p-6"
    >
      <h2 id="loan-structure-heading" className="text-xl font-semibold">
        Loan structure
      </h2>
      <dl className="mt-4">
        <Row label="Purchase price" value={formatCents(loanStructure.purchasePriceMinorUnits)} />
        <Row label="Deposit" value={deposit} />
        <Row label="Loan requested" value={formatCents(loanStructure.loanAmountMinorUnits)} />
        <Row label="Term" value={formatTerm(loanStructure.termMonths)} />
        <Row label="Indicative rate (AI)" value={formatBps(loanStructure.aprBps, 2)} />
        <Row
          label="Monthly repayment"
          value={formatCents(loanStructure.monthlyRepaymentMinorUnits)}
          strong
        />
      </dl>
      {/* TEMP(Q1-LOAN): remove this note when the loan-amount field is agreed */}
      <p className="mt-3 text-xs text-muted">
        Loan requested = purchase price minus deposit (provisional).
      </p>
    </section>
  )
}
