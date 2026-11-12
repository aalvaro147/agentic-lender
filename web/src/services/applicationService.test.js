import { describe, it, expect } from 'vitest'
import { getApplications, getApplication } from './applicationService'

// Profiles as AL-Core stores them: a broker is identified by their uid (no brokerId field)
const orla = { uid: 'mock-underwriter-01', role: 'underwriter' }
const ciaran = { uid: 'mock-broker-01', role: 'broker' }
const emma = { uid: 'mock-broker-02', role: 'broker' }

describe('getApplications', () => {
  it('returns every application to an underwriter', async () => {
    const apps = await getApplications(orla)
    expect(apps).toHaveLength(8)
  })

  it('returns only Ciarán’s own clients to Ciarán', async () => {
    const apps = await getApplications(ciaran)
    expect(apps).toHaveLength(3)
    expect(apps.every((a) => a.brokerId === 'mock-broker-01')).toBe(true)
  })

  it('never returns another broker’s clients', async () => {
    const apps = await getApplications(emma)
    expect(apps.map((a) => a.borrowerName)).not.toContain('Aoife Murphy') // Ciarán's client
    expect(apps.every((a) => a.brokerId === 'mock-broker-02')).toBe(true)
  })

  it('returns pipeline rows built by the mapper, not raw Firestore documents', async () => {
    const [aoife] = (await getApplications(ciaran)).filter((a) => a.id === 'AL-2026-0148')
    expect(aoife).toMatchObject({
      borrowerName: 'Aoife Murphy',
      brokerName: "Ciarán O'Neill",
      status: 'AI_DELIBERATED',
      loanAmountMinorUnits: 34200000,
    })
    expect(aoife).not.toHaveProperty('financialSpecs')
  })
})

describe('getApplication (WEB-26)', () => {
  it('returns the loan file of an application the user may open', async () => {
    const file = await getApplication(ciaran, 'AL-2026-0148')
    expect(file).toMatchObject({ id: 'AL-2026-0148', borrowerName: 'Aoife Murphy' })
    expect(file.property).toMatchObject({ location: 'Co. Cork', berRating: 'B2' })
  })

  it('lets an underwriter open any application', async () => {
    expect(await getApplication(orla, 'AL-2026-0147')).not.toBeNull()
  })

  it('returns null for another broker’s application, the same as an unknown ID (D5)', async () => {
    expect(await getApplication(ciaran, 'AL-2026-0147')).toBeNull() // Emma's client
    expect(await getApplication(ciaran, 'AL-2026-9999')).toBeNull()
  })
})
