/* WEB-29: loan structure card */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoanStructureCard } from './LoanStructureCard'
import { EMPTY } from '../utils/format'

// Values of mock application AL-2026-0148
const ASSESSED = {
  purchasePriceMinorUnits: 39500000,
  depositMinorUnits: 5300000,
  loanAmountMinorUnits: 34200000,
  termMonths: 360,
  aprBps: 350,
  monthlyRepaymentMinorUnits: 153573,
}

describe('LoanStructureCard', () => {
  it('shows price, deposit with its share, loan, term, rate and repayment', () => {
    render(<LoanStructureCard loanStructure={ASSESSED} />)

    expect(screen.getByText('€395,000')).toBeInTheDocument()
    expect(screen.getByText('€53,000 (13.4%)')).toBeInTheDocument()
    expect(screen.getByText('€342,000')).toBeInTheDocument()
    expect(screen.getByText('30 years')).toBeInTheDocument()
    expect(screen.getByText('3.50%')).toBeInTheDocument()
    expect(screen.getByText('€1,536')).toBeInTheDocument()
  })

  it('labels the rate as the AI indicative rate and the loan amount as provisional (D11, Q1)', () => {
    render(<LoanStructureCard loanStructure={ASSESSED} />)

    expect(screen.getByText('Indicative rate (AI)')).toBeInTheDocument()
    expect(screen.getByText(/purchase price minus deposit \(provisional\)/)).toBeInTheDocument()
  })

  it('shows a dash for the rate and repayment before the AI has run', () => {
    render(
      <LoanStructureCard
        loanStructure={{ ...ASSESSED, aprBps: null, monthlyRepaymentMinorUnits: null }}
      />,
    )

    expect(screen.getAllByText(EMPTY)).toHaveLength(2)
  })
})
