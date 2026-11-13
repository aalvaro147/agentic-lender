/* WEB-24: subscribeApplications in live mode, with Firestore replaced by a fake.
   onSnapshot is captured so each test can push snapshots, as Firestore would when a
   document changes. Separate file because the config and Firestore mocks apply to the
   whole file (applicationService.test.js runs in mock mode). */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onSnapshot, query, where } from 'firebase/firestore'
import { subscribeApplications } from './applicationService'

vi.mock('./config', () => ({ USE_MOCKS: false }))
vi.mock('./firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, name) => ({ name })),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(async () => ({
    docs: [
      { id: 'u-borrower', data: () => ({ displayName: 'Aoife Murphy' }) },
      { id: 'u-broker', data: () => ({ displayName: "Ciarán O'Neill" }) },
    ],
  })),
  onSnapshot: vi.fn(),
  query: vi.fn((ref, filter) => ({ ref, filter })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
}))

const orla = { uid: 'u-underwriter', role: 'underwriter' }
const ciaran = { uid: 'u-broker', role: 'broker' }

// A Firestore snapshot holding the given AL-Core documents
const snapshotOf = (...docs) => ({
  docs: docs.map(({ applicationId, ...data }) => ({
    id: applicationId,
    data: () => ({ applicationId, ...data }),
  })),
})
const application = (status) => ({
  applicationId: 'AL-T-0001',
  borrowerId: 'u-borrower',
  brokerId: 'u-broker',
  status,
  createdAt: '2026-11-13T10:00:00Z',
})

// Handlers the service passed to onSnapshot, and the stop function it got back
let push, fail, stopListening
beforeEach(() => {
  vi.clearAllMocks()
  stopListening = vi.fn()
  onSnapshot.mockImplementation((q, next, error) => {
    push = next
    fail = error
    return stopListening
  })
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0)) // let getDocs resolve

describe('subscribeApplications in live mode (WEB-24)', () => {
  it('sends new rows every time Firestore reports a change', async () => {
    const onRows = vi.fn()
    subscribeApplications(orla, onRows, vi.fn())
    await flush()

    push(snapshotOf(application('APPLIED')))
    push(snapshotOf(application('AI_DELIBERATED')))

    expect(onRows).toHaveBeenCalledTimes(2)
    expect(onRows.mock.calls[0][0][0]).toMatchObject({ id: 'AL-T-0001', status: 'APPLIED' })
    expect(onRows.mock.calls[1][0][0]).toMatchObject({
      id: 'AL-T-0001',
      status: 'AI_DELIBERATED',
      borrowerName: 'Aoife Murphy',
    })
  })

  it('waits for the names before sending the first rows', async () => {
    const onRows = vi.fn()
    subscribeApplications(orla, onRows, vi.fn())

    push(snapshotOf(application('APPLIED'))) // arrives before getDocs(users) resolves
    expect(onRows).not.toHaveBeenCalled()

    await flush()
    expect(onRows).toHaveBeenCalledTimes(1)
    expect(onRows.mock.calls[0][0][0].borrowerName).toBe('Aoife Murphy')
  })

  it('listens to a broker query filtered by brokerId, as the Security Rules require', async () => {
    subscribeApplications(ciaran, vi.fn(), vi.fn())

    expect(where).toHaveBeenCalledWith('brokerId', '==', 'u-broker')
    expect(query).toHaveBeenCalledTimes(1)
    expect(onSnapshot.mock.calls[0][0]).toMatchObject({ filter: { field: 'brokerId' } })
  })

  it('listens to the whole collection for an underwriter', () => {
    subscribeApplications(orla, vi.fn(), vi.fn())

    expect(where).not.toHaveBeenCalled()
    expect(onSnapshot.mock.calls[0][0]).toEqual({ name: 'applications' })
  })

  it('reports a listener error through onError', async () => {
    const onError = vi.fn()
    subscribeApplications(orla, vi.fn(), onError)

    fail({ code: 'permission-denied' })
    expect(onError).toHaveBeenCalledWith({ code: 'permission-denied' })
  })

  it('stops listening and sends nothing more after the stop function is called', async () => {
    const onRows = vi.fn()
    const stop = subscribeApplications(orla, onRows, vi.fn())
    await flush()

    stop()
    push(snapshotOf(application('FUNDED')))

    expect(stopListening).toHaveBeenCalledTimes(1)
    expect(onRows).not.toHaveBeenCalled()
  })
})
