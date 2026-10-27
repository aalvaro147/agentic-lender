import { describe, it, expect } from 'vitest'
import { getApplications } from './applicationService'

const orla = { uid: 'mock-underwriter-01', role: 'underwriter', brokerId: null }
const ciaran = { uid: 'mock-broker-01', role: 'broker', brokerId: 'broker-01' }
const emma = { uid: 'mock-broker-02', role: 'broker', brokerId: 'broker-02' }

describe('getApplications', () => {
  it('returns every application to an underwriter', async () => {
    const apps = await getApplications(orla)
    expect(apps).toHaveLength(7)
  })

  it('returns only Ciarán’s own clients to Ciarán', async () => {
    const apps = await getApplications(ciaran)
    expect(apps).toHaveLength(3)
    expect(apps.every((a) => a.brokerId === 'broker-01')).toBe(true)
  })

  it('never returns another broker’s clients', async () => {
    const apps = await getApplications(emma)
    expect(apps.map((a) => a.borrowerName)).not.toContain('Aoife Murphy') // Ciarán's client
    expect(apps.every((a) => a.brokerId === 'broker-02')).toBe(true)
  })
})
