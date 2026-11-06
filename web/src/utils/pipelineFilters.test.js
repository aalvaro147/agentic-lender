import { describe, it, expect } from 'vitest'
import {
  EMPTY_FILTERS,
  filterApplications,
  getLtvBand,
  hasActiveFilters,
  nextSort,
  sortApplications,
} from './pipelineFilters'
import applications from '../mocks/applications.json'

const filter = (changes) => filterApplications(applications, { ...EMPTY_FILTERS, ...changes })
const ids = (apps) => apps.map((a) => a.id)

describe('getLtvBand (WEB-21)', () => {
  it('puts each LTV in the right band, with the upper limit included', () => {
    expect(getLtvBand(80).id).toBe('up-to-80')
    expect(getLtvBand(80.1).id).toBe('80-to-90')
    expect(getLtvBand(90).id).toBe('80-to-90')
    expect(getLtvBand(90.1).id).toBe('over-90')
  })
})

describe('filterApplications', () => {
  it('returns every application when no filter is set', () => {
    expect(filter({})).toHaveLength(7)
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('filters by lifecycle status (WEB-20)', () => {
    expect(ids(filter({ status: 'applied' }))).toEqual(['AL-2026-0146', 'AL-2026-0142'])
  })

  it('filters by LTV band (WEB-21)', () => {
    expect(ids(filter({ ltvBand: 'over-90' }))).toEqual(['AL-2026-0144'])
    expect(filter({ ltvBand: 'up-to-80' })).toHaveLength(3)
  })

  it('combines risk tier with status and LTV filters (WEB-22)', () => {
    expect(ids(filter({ status: 'ai_deliberated', riskTier: 'high' }))).toEqual(['AL-2026-0144'])
    expect(filter({ riskTier: 'low', ltvBand: '80-to-90' })).toHaveLength(0)
  })

  it('searches borrower name and application ID, ignoring case and spaces (WEB-23)', () => {
    expect(ids(filter({ search: '  WALSH ' }))).toEqual(['AL-2026-0142'])
    expect(ids(filter({ search: '0147' }))).toEqual(['AL-2026-0147'])
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: 'x' })).toBe(true)
  })
})

describe('sortApplications (WEB-23)', () => {
  it('sorts numbers ascending and descending', () => {
    const asc = sortApplications(applications, { key: 'loanAmount', direction: 'asc' })
    const desc = sortApplications(applications, { key: 'loanAmount', direction: 'desc' })
    expect(asc[0].loanAmount).toBe(186000)
    expect(desc[0].loanAmount).toBe(472500)
  })

  it('sorts risk from low to high and status in lifecycle order, not alphabetically', () => {
    const byRisk = sortApplications(applications, { key: 'riskTier', direction: 'asc' })
    expect(byRisk.map((a) => a.riskTier)).toEqual([
      'low',
      'low',
      'low',
      'medium',
      'medium',
      'medium',
      'high',
    ])
    const byStatus = sortApplications(applications, { key: 'status', direction: 'asc' })
    expect(byStatus[0].status).toBe('applied')
    expect(byStatus.at(-1).status).toBe('closed')
  })

  it('never changes the original array', () => {
    const before = ids(applications)
    sortApplications(applications, { key: 'ltv', direction: 'asc' })
    expect(ids(applications)).toEqual(before)
  })

  it('flips direction on the same column and starts ascending on a new one', () => {
    expect(nextSort({ key: 'ltv', direction: 'asc' }, 'ltv')).toEqual({
      key: 'ltv',
      direction: 'desc',
    })
    expect(nextSort({ key: 'ltv', direction: 'desc' }, 'dti')).toEqual({
      key: 'dti',
      direction: 'asc',
    })
  })
})
