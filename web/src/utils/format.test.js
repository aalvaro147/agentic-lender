/* WEB-08: formatters for AL-Core units (cents, basis points) */

import { describe, expect, it } from 'vitest'
import { EMPTY, formatBps, formatCents, formatDate, formatMultiple, formatPercent } from './format'

describe('formatCents', () => {
  it('turns cents into whole euros', () => {
    expect(formatCents(34200000)).toBe('€342,000')
    expect(formatCents(0)).toBe('€0')
  })

  it('rounds to the nearest euro and keeps the minus sign', () => {
    expect(formatCents(140175)).toBe('€1,402')
    expect(formatCents(-123450)).toBe('-€1,235')
  })
})

describe('formatBps', () => {
  it('shows LTV and DTI with 1 decimal by default', () => {
    expect(formatBps(8247)).toBe('82.5%')
    expect(formatBps(9000)).toBe('90.0%')
  })

  it('can show APR with 2 decimals', () => {
    expect(formatBps(350, 2)).toBe('3.50%')
  })
})

describe('existing formatters still work', () => {
  it('formats percentages, multiples and dates', () => {
    expect(formatPercent(90)).toBe('90.0%')
    expect(formatMultiple(3.98)).toBe('3.98×')
    expect(formatDate('2026-10-08')).toBe('08 Oct 2026')
  })

  it('formats a full ISO timestamp from AL-Core', () => {
    expect(formatDate('2026-10-08T09:30:00Z')).toBe('08 Oct 2026')
  })
})

describe('missing values', () => {
  it('shows a dash instead of crashing or printing 0', () => {
    for (const formatter of [formatCents, formatBps, formatPercent, formatMultiple]) {
      expect(formatter(null)).toBe(EMPTY)
      expect(formatter(undefined)).toBe(EMPTY)
    }
    expect(formatDate(null)).toBe(EMPTY)
    expect(formatDate('not a date')).toBe(EMPTY)
  })
})
