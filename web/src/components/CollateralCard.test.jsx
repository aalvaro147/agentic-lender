/* WEB-27: collateral assessment card */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollateralCard } from './CollateralCard'

// Values of mock application AL-2026-0148
const ASSESSED = {
  askingPriceMinorUnits: 39500000,
  valuationMinorUnits: 38315000,
  valuationModelVersion: 'mock-0.2',
  isMockValuation: true,
  ltvBps: 8926,
}

describe('CollateralCard', () => {
  it('compares asking price and valuation with a neutral badge (D9)', () => {
    render(<CollateralCard collateral={ASSESSED} />)

    expect(screen.getByText('Asking price 3.1% above valuation')).toBeInTheDocument()
    expect(screen.getByText('€395,000')).toBeInTheDocument()
    expect(screen.getByText('€383,150')).toBeInTheDocument()
    expect(screen.getByText('+€11,850')).toBeInTheDocument()
  })

  it('shows only the AI LTV and says the valuation is a mock (D8)', () => {
    render(<CollateralCard collateral={ASSESSED} />)

    expect(screen.getByText('LTV (AI)')).toBeInTheDocument()
    expect(screen.getByText('89.3%')).toBeInTheDocument()
    expect(screen.getByText('Mock valuation · mock-0.2')).toBeInTheDocument()
    expect(screen.queryByText(/LTV on asking price/)).not.toBeInTheDocument()
  })

  it('describes an asking price below or equal to the valuation', () => {
    const { rerender } = render(
      <CollateralCard collateral={{ ...ASSESSED, askingPriceMinorUnits: 36400000 }} />,
    )
    expect(screen.getByText('Asking price 5.0% below valuation')).toBeInTheDocument()
    expect(screen.getByText('-€19,150')).toBeInTheDocument()

    rerender(<CollateralCard collateral={{ ...ASSESSED, askingPriceMinorUnits: 38315000 }} />)
    expect(screen.getByText('Asking price equals valuation')).toBeInTheDocument()
  })

  it('shows the asking price only until the AI has valued the property (D10)', () => {
    render(
      <CollateralCard
        collateral={{ askingPriceMinorUnits: 30000000, valuationMinorUnits: null, ltvBps: null }}
      />,
    )

    expect(screen.getByText('€300,000')).toBeInTheDocument()
    expect(screen.getByText('Valuation pending AI assessment.')).toBeInTheDocument()
    expect(screen.queryByText(/valuation$/)).not.toBeInTheDocument()
    expect(screen.queryByText('Difference')).not.toBeInTheDocument()
  })
})
