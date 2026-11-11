import { describe, it, expect } from 'vitest'
import {
  EMPTY_FILTERS,
  filterApplications,
  getLtvBand,
  hasActiveFilters,
  nextSort,
  sortApplications,
} from './pipelineFilters'
import { toPipelineRow } from '../services/applicationMapper'
import mockApplications from '../mocks/applications.json'
import mockUsers from '../mocks/users.json'

// The rows the pipeline really filters: mock documents passed through the mapper
const usersById = Object.fromEntries(mockUsers.map((u) => [u.uid, u]))
const applications = mockApplications.map((doc) => toPipelineRow(doc, usersById))

const filter = (changes) => filterApplications(applications, { ...EMPTY_FILTERS, ...changes })
const ids = (apps) => apps.map((a) => a.id)

describe('getLtvBand (WEB-21)', () => {
  it('puts each LTV (in basis points) in the right band, with the upper limit included', () => {
    expect(getLtvBand(8000).id).toBe('up-to-80')
    expect(getLtvBand(8001).id).toBe('80-to-90')
    expect(getLtvBand(9000).id).toBe('80-to-90')
    expect(getLtvBand(9001).id).toBe('over-90')
  })

  it('gives no band when there is no LTV yet (D2)', () => {
    expect(getLtvBand(null)).toBeUndefined()
  })
})

describe('filterApplications', () => {
  it('returns every application when no filter is set', () => {
    expect(filter({})).toHaveLength(8)
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('filters by lifecycle status (WEB-20)', () => {
    expect(ids(filter({ status: 'APPLIED' }))).toEqual(['AL-2026-0146', 'AL-2026-0142'])
    expect(ids(filter({ status: 'REJECTED' }))).toEqual(['AL-2026-0149'])
  })

  it('filters by LTV band (WEB-21)', () => {
    expect(ids(filter({ ltvBand: 'over-90' }))).toEqual(['AL-2026-0144', 'AL-2026-0149'])
    expect(ids(filter({ ltvBand: 'up-to-80' }))).toEqual(['AL-2026-0145', 'AL-2026-0143'])
  })

  it('combines risk tier with status and LTV filters (WEB-22)', () => {
    expect(ids(filter({ status: 'AI_DELIBERATED', riskTier: 'high' }))).toEqual(['AL-2026-0144'])
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
    const asc = sortApplications(applications, { key: 'loanAmountMinorUnits', direction: 'asc' })
    const desc = sortApplications(applications, { key: 'loanAmountMinorUnits', direction: 'desc' })
    expect(asc[0].loanAmountMinorUnits).toBe(18600000) // €186,000
    expect(desc[0].loanAmountMinorUnits).toBe(47250000) // €472,500
  })

  it('sorts risk from low to high and status in lifecycle order, not alphabetically', () => {
    const byRisk = sortApplications(applications, { key: 'riskTier', direction: 'asc' })
    expect(byRisk.map((a) => a.riskTier)).toEqual([
      'low',
      'low',
      'medium',
      'medium',
      'high',
      'high',
      null,
      null,
    ])
    const byStatus = sortApplications(applications, { key: 'status', direction: 'asc' })
    expect(byStatus[0].status).toBe('APPLIED')
    expect(byStatus.at(-1).status).toBe('REJECTED')
  })

  it('puts applications without an AI result last in both directions (D2)', () => {
    const asc = sortApplications(applications, { key: 'ltvBps', direction: 'asc' })
    const desc = sortApplications(applications, { key: 'ltvBps', direction: 'desc' })
    expect(ids(asc.slice(-2))).toEqual(['AL-2026-0142', 'AL-2026-0146'])
    expect(ids(desc.slice(-2))).toEqual(['AL-2026-0142', 'AL-2026-0146'])
    expect(desc[0].id).toBe('AL-2026-0144') // highest LTV first
  })

  it('never changes the original array', () => {
    const before = ids(applications)
    sortApplications(applications, { key: 'ltvBps', direction: 'asc' })
    expect(ids(applications)).toEqual(before)
  })

  it('flips direction on the same column and starts ascending on a new one', () => {
    expect(nextSort({ key: 'ltvBps', direction: 'asc' }, 'ltvBps')).toEqual({
      key: 'ltvBps',
      direction: 'desc',
    })
    expect(nextSort({ key: 'ltvBps', direction: 'desc' }, 'dtiBps')).toEqual({
      key: 'dtiBps',
      direction: 'asc',
    })
  })
})
