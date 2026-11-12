/* WEB-27 / WEB-29: asking price vs valuation, bar widths, deposit share */

import { describe, expect, it } from 'vitest'
import { barWidths, compareAskingToValuation, depositShareBps } from './collateral'

describe('compareAskingToValuation (WEB-27)', () => {
  it('measures an asking price above the valuation (mock AL-2026-0148)', () => {
    expect(compareAskingToValuation(39500000, 38315000)).toEqual({
      differenceMinorUnits: 1185000,
      differenceBps: 309,
      direction: 'above',
    })
  })

  it('measures an asking price below or equal to the valuation', () => {
    expect(compareAskingToValuation(38000000, 40000000)).toEqual({
      differenceMinorUnits: -2000000,
      differenceBps: -500,
      direction: 'below',
    })
    expect(compareAskingToValuation(30000000, 30000000).direction).toBe('equal')
  })

  it('returns null without a valuation (AI has not run, D10)', () => {
    expect(compareAskingToValuation(39500000, null)).toBeNull()
    expect(compareAskingToValuation(39500000, 0)).toBeNull()
  })
})

describe('barWidths (WEB-27)', () => {
  it('fills the bar for the larger value and scales the other', () => {
    expect(barWidths(39500000, 38315000)).toEqual({ asking: 100, valuation: 97 })
    expect(barWidths(30000000, null)).toEqual({ asking: 100, valuation: 0 })
  })
})

describe('depositShareBps (WEB-29, D12)', () => {
  it('gives the deposit as a share of the purchase price', () => {
    expect(depositShareBps(5300000, 39500000)).toBe(1342) // 13.4%
    expect(depositShareBps(null, 39500000)).toBeNull()
  })
})
