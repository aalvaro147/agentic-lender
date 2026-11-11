/* WEB-08: the mapper reads AL-Core Firestore documents correctly.
   Sample documents follow applications.schema.json; all data is synthetic. */

import { describe, expect, it } from 'vitest'
import { toPipelineRow } from './applicationMapper'

const USERS = {
  'uid-borrower-01': { displayName: 'Aoife Murphy' },
  'uid-broker-01': { displayName: "Ciarán O'Neill" },
}

// An application the AI has already assessed
const DELIBERATED = {
  applicationId: 'AL-2026-0148',
  borrowerId: 'uid-borrower-01',
  brokerId: 'uid-broker-01',
  status: 'AI_DELIBERATED',
  financialSpecs: {
    grossIncomeMinorUnits: 8600000,
    existingDebtMinorUnits: 25000,
    depositMinorUnits: 3800000,
    requestedTermMonths: 360,
  },
  propertySpecs: { askingPriceMinorUnits: 38000000, berRating: 'B2', county: 'Cork' },
  aiAssessment: {
    recommendation: 'CONDITIONALLY_APPROVE',
    createdAt: '2026-10-08T10:00:00Z',
    valuation: { estimatedValueMinorUnits: 36860000, ltvBps: 9278 },
    affordability: { dtiBps: 2810, loanToIncomeMultiple: 3.98 },
  },
  createdAt: '2026-10-08T09:30:00Z',
}

// A new application: no AI assessment yet, created by the borrower (no broker)
const APPLIED = {
  applicationId: 'AL-2026-0150',
  borrowerId: 'uid-borrower-02',
  brokerId: null,
  status: 'APPLIED',
  financialSpecs: {
    grossIncomeMinorUnits: 7000000,
    existingDebtMinorUnits: 0,
    depositMinorUnits: 3000000,
    requestedTermMonths: 300,
  },
  propertySpecs: { askingPriceMinorUnits: 30000000, berRating: 'UNKNOWN', county: 'Dublin' },
  createdAt: '2026-10-10T08:00:00Z',
}

describe('toPipelineRow', () => {
  it('maps an AI-deliberated application, keeping AL-Core units', () => {
    expect(toPipelineRow(DELIBERATED, USERS)).toEqual({
      id: 'AL-2026-0148',
      status: 'AI_DELIBERATED',
      borrowerId: 'uid-borrower-01',
      borrowerName: 'Aoife Murphy',
      brokerId: 'uid-broker-01',
      brokerName: "Ciarán O'Neill",
      location: 'Co. Cork',
      loanAmountMinorUnits: 34200000, // 380,000 asking − 38,000 deposit (TEMP Q1-LOAN)
      ltvBps: 9278,
      dtiBps: 2810,
      lti: 3.98,
      recommendation: 'CONDITIONALLY_APPROVE',
      riskTier: 'medium',
      submittedAt: '2026-10-08T09:30:00Z',
    })
  })

  it('leaves AI figures empty before the AI has run (D2)', () => {
    const row = toPipelineRow(APPLIED, USERS)
    expect(row.ltvBps).toBeNull()
    expect(row.dtiBps).toBeNull()
    expect(row.lti).toBeNull()
    expect(row.recommendation).toBeNull()
    expect(row.riskTier).toBeNull()
    expect(row.loanAmountMinorUnits).toBe(27000000) // the loan is known from intake
  })

  it('returns null names when profiles cannot be read or there is no broker (Q3)', () => {
    const row = toPipelineRow(APPLIED, USERS)
    expect(row.borrowerName).toBeNull() // uid-borrower-02 not readable
    expect(row.brokerId).toBeNull()
    expect(row.brokerName).toBeNull()
    expect(toPipelineRow(DELIBERATED).borrowerName).toBeNull() // no profiles passed at all
  })

  it('derives the provisional risk tier from the AI recommendation (D3)', () => {
    const withRecommendation = (recommendation) =>
      toPipelineRow({
        ...DELIBERATED,
        aiAssessment: { ...DELIBERATED.aiAssessment, recommendation },
      })
    expect(withRecommendation('APPROVE').riskTier).toBe('low')
    expect(withRecommendation('CONDITIONALLY_APPROVE').riskTier).toBe('medium')
    expect(withRecommendation('DECLINE').riskTier).toBe('high')
  })

  it('accepts a Firestore Timestamp and the document ID from a live read', () => {
    const { applicationId, ...live } = DELIBERATED
    const row = toPipelineRow({
      ...live,
      id: applicationId,
      createdAt: { toDate: () => new Date('2026-10-08T09:30:00Z') },
    })
    expect(row.id).toBe('AL-2026-0148')
    expect(row.submittedAt).toBe('2026-10-08T09:30:00.000Z')
  })

  it('never turns missing inputs into a zero loan amount', () => {
    const noDeposit = { ...APPLIED, financialSpecs: { ...APPLIED.financialSpecs } }
    delete noDeposit.financialSpecs.depositMinorUnits
    expect(toPipelineRow(noDeposit).loanAmountMinorUnits).toBeNull()

    const depositCoversPrice = {
      ...APPLIED,
      financialSpecs: { ...APPLIED.financialSpecs, depositMinorUnits: 30000000 },
    }
    expect(toPipelineRow(depositCoversPrice).loanAmountMinorUnits).toBeNull()
  })

  it('does not change the document it is given', () => {
    const copy = structuredClone(DELIBERATED)
    toPipelineRow(DELIBERATED, USERS)
    expect(DELIBERATED).toEqual(copy)
  })
})
