/* WEB-24: the pipeline updates when new rows arrive, without a page refresh.
   subscribeApplications is replaced by a fake so each test can push rows, as the
   service does when Firestore reports a change. */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '../auth/AuthContext'
import { PipelinePage } from './PipelinePage'
import { subscribeApplications } from '../services/applicationService'

vi.mock('../services/applicationService', () => ({ subscribeApplications: vi.fn() }))

const orla = { uid: 'u-underwriter', role: 'underwriter', displayName: 'Orla Hennessy' }

// Pipeline rows as toPipelineRow() builds them (only the fields the table needs)
const row = (id, borrowerName, status) => ({
  id,
  status,
  borrowerId: `b-${id}`,
  borrowerName,
  brokerId: 'u-broker',
  brokerName: "Ciarán O'Neill",
  location: 'Co. Cork',
  loanAmountMinorUnits: 30000000,
  ltvBps: null,
  dtiBps: null,
  lti: null,
  recommendation: null,
  riskTier: null,
  submittedAt: '2026-11-13T10:00:00.000Z',
})

let pushRows, pushError, stop
beforeEach(() => {
  vi.clearAllMocks()
  stop = vi.fn()
  subscribeApplications.mockImplementation((profile, onRows, onError) => {
    pushRows = (rows) => act(() => onRows(rows))
    pushError = () => act(() => onError(new Error('offline')))
    return stop
  })
})

function renderPipeline() {
  return render(
    <AuthContext.Provider
      value={{ user: { uid: orla.uid }, profile: orla, role: orla.role, loading: false }}
    >
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const dataRows = () => screen.getAllByRole('row').slice(1)

describe('PipelinePage real-time updates (WEB-24)', () => {
  it('shows a new application as soon as it arrives', () => {
    renderPipeline()
    pushRows([row('AL-T-0001', 'Aoife Murphy', 'APPLIED')])
    expect(dataRows()).toHaveLength(1)

    pushRows([
      row('AL-T-0001', 'Aoife Murphy', 'APPLIED'),
      row('AL-T-0002', 'Tomasz Nowak', 'APPLIED'),
    ])

    expect(dataRows()).toHaveLength(2)
    expect(screen.getByText('Tomasz Nowak')).toBeInTheDocument()
  })

  it('keeps the active filter when a status changes', async () => {
    const user = userEvent.setup()
    renderPipeline()
    pushRows([
      row('AL-T-0001', 'Aoife Murphy', 'APPLIED'),
      row('AL-T-0002', 'Tomasz Nowak', 'APPLIED'),
    ])
    await user.selectOptions(screen.getByLabelText('Status'), 'APPLIED')
    expect(screen.getByText('Showing 2 of 2 applications')).toBeInTheDocument()

    // The AI assesses Aoife's application: it leaves the "Applied" filter
    pushRows([
      row('AL-T-0001', 'Aoife Murphy', 'AI_DELIBERATED'),
      row('AL-T-0002', 'Tomasz Nowak', 'APPLIED'),
    ])

    expect(dataRows()).toHaveLength(1)
    expect(screen.getByText('Showing 1 of 2 applications')).toBeInTheDocument()
    expect(screen.queryByText('Aoife Murphy')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('APPLIED')
  })

  it('updates the status summary cards', () => {
    renderPipeline()
    pushRows([row('AL-T-0001', 'Aoife Murphy', 'APPLIED')])
    const appliedCard = () => screen.getByText('Applied', { selector: 'p' }).nextSibling
    expect(appliedCard()).toHaveTextContent('1')

    pushRows([row('AL-T-0001', 'Aoife Murphy', 'UNDERWRITER_APPROVED')])

    expect(appliedCard()).toHaveTextContent('0')
  })

  it('stops listening when the page is closed', () => {
    const { unmount } = renderPipeline()
    expect(stop).not.toHaveBeenCalled()

    unmount()

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('shows an error message when the listener fails', () => {
    renderPipeline()
    pushError()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load applications. Please try again later.',
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument() // loading message gone
  })
})
