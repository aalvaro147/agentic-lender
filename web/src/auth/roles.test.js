import { describe, it, expect } from 'vitest'
import { ROLES, canAccess, getNavItems } from './roles'

describe('roles', () => {
  it('lets underwriters open every page', () => {
    for (const page of ['pipeline', 'loanFile', 'auditConsole', 'stressTest', 'settlement']) {
      expect(canAccess(ROLES.UNDERWRITER, page)).toBe(true)
    }
  })

  it('blocks brokers from stress test and settlement', () => {
    expect(canAccess(ROLES.BROKER, 'pipeline')).toBe(true)
    expect(canAccess(ROLES.BROKER, 'stressTest')).toBe(false)
    expect(canAccess(ROLES.BROKER, 'settlement')).toBe(false)
  })

  it('shows brokers only "My clients" in the menu', () => {
    expect(getNavItems(ROLES.BROKER)).toEqual([{ path: '/pipeline', label: 'My clients' }])
  })

  it('shows underwriters three menu items in order', () => {
    expect(getNavItems(ROLES.UNDERWRITER).map((item) => item.label)).toEqual([
      'Pipeline',
      'Stress test',
      'Settlement & export',
    ])
  })

  it('denies unknown roles and unknown pages', () => {
    expect(canAccess('admin', 'pipeline')).toBe(false)
    expect(canAccess(ROLES.UNDERWRITER, 'not-a-page')).toBe(false)
    expect(getNavItems(undefined)).toEqual([])
  })
})
