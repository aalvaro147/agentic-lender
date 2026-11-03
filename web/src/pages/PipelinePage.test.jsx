import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '../auth/AuthContext'
import { PipelinePage } from './PipelinePage'
import userEvent from '@testing-library/user-event'

const orla = {
  uid: 'mock-underwriter-01',
  role: 'underwriter',
  brokerId: null,
  displayName: 'Orla Hennessy',
}
const ciaran = {
  uid: 'mock-broker-01',
  role: 'broker',
  brokerId: 'broker-01',
  displayName: "Ciarán O'Neill",
}

function renderAs(profile) {
  return render(
    <AuthContext.Provider
      value={{ user: { uid: profile.uid }, profile, role: profile.role, loading: false }}
    >
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

// Data rows only (row 0 is the header)
const dataRows = () => screen.getAllByRole('row').slice(1)

describe('PipelinePage', () => {
  it('shows a broker only their own clients', async () => {
    renderAs(ciaran)

    expect(screen.getByRole('heading', { name: 'My clients' })).toBeInTheDocument()
    expect(await screen.findByText('Aoife Murphy')).toBeInTheDocument()
    expect(screen.queryByText('Tomasz Nowak')).not.toBeInTheDocument() // Emma's client
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + 3 clients
  })

  it('shows an underwriter the full portfolio', async () => {
    renderAs(orla)

    expect(screen.getByRole('heading', { name: 'Origination pipeline' })).toBeInTheDocument()
    expect(await screen.findByText('Tomasz Nowak')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(8) // header + 7 applications
  })

  it('filters by status and shows the count (WEB-20)', async () => {
    const user = userEvent.setup()
    renderAs(orla)
    await screen.findByText('Tomasz Nowak')

    await user.selectOptions(screen.getByLabelText('Status'), 'applied')

    expect(dataRows()).toHaveLength(2)
    expect(screen.getByText('Showing 2 of 7 applications')).toBeInTheDocument()
  })

  it('filters by LTV band (WEB-21)', async () => {
    const user = userEvent.setup()
    renderAs(orla)
    await screen.findByText('Tomasz Nowak')

    await user.selectOptions(screen.getByLabelText('LTV band'), 'over-90') // the "> 90%" option

    expect(dataRows()).toHaveLength(1)
    expect(screen.getByText('Rachel Kinsella')).toBeInTheDocument()
  })

  it('combines risk tier with the status filter (WEB-22)', async () => {
    const user = userEvent.setup()
    renderAs(orla)
    await screen.findByText('Tomasz Nowak')

    await user.selectOptions(screen.getByLabelText('Status'), 'AI Deliberated')
    expect(dataRows()).toHaveLength(2)

    await user.selectOptions(screen.getByLabelText('Risk tier'), 'High')
    expect(dataRows()).toHaveLength(1)
    expect(screen.getByText('Rachel Kinsella')).toBeInTheDocument()
  })

  it('searches by borrower name and by application ID (WEB-23)', async () => {
    const user = userEvent.setup()
    renderAs(orla)
    await screen.findByText('Tomasz Nowak')
    const search = screen.getByLabelText('Search')

    await user.type(search, 'walsh')
    expect(dataRows()).toHaveLength(1)
    expect(screen.getByText('Niamh Walsh')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, '0147')
    expect(dataRows()).toHaveLength(1)
    expect(screen.getByText('Tomasz Nowak')).toBeInTheDocument()
  })

  it('sorts by a column and reverses on a second click (WEB-23)', async () => {
    const user = userEvent.setup()
    renderAs(orla)
    await screen.findByText('Tomasz Nowak')
    const loanButton = screen.getByRole('button', { name: 'Loan' })

    await user.click(loanButton)
    expect(within(dataRows()[0]).getByText('Darragh Fitzgerald')).toBeInTheDocument() // €186,000
    expect(loanButton.closest('th')).toHaveAttribute('aria-sort', 'ascending')

    await user.click(loanButton)
    expect(within(dataRows()[0]).getByText('Sinéad & Mark Brennan')).toBeInTheDocument() // €472,500
    expect(loanButton.closest('th')).toHaveAttribute('aria-sort', 'descending')
  })

  it('shows an empty state when nothing matches, and clears the filters', async () => {
    const user = userEvent.setup()
    renderAs(orla)
    await screen.findByText('Tomasz Nowak')

    await user.type(screen.getByLabelText('Search'), 'no such borrower')
    expect(screen.getByText('No applications match these filters.')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(dataRows()).toHaveLength(7)
  })
})
