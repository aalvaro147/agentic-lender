import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext } from '../auth/AuthContext'
import { PipelinePage } from './PipelinePage'

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

describe('PipelinePage', () => {
  it('shows a broker only their own clients', async () => {
    renderAs({
      uid: 'mock-broker-01',
      role: 'broker',
      brokerId: 'broker-01',
      displayName: "Ciarán O'Neill",
    })

    expect(screen.getByRole('heading', { name: 'My clients' })).toBeInTheDocument()
    expect(await screen.findByText('Aoife Murphy')).toBeInTheDocument()
    expect(screen.queryByText('Tomasz Nowak')).not.toBeInTheDocument() // Emma's client
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + 3 clients
  })

  it('shows an underwriter the full portfolio', async () => {
    renderAs({
      uid: 'mock-underwriter-01',
      role: 'underwriter',
      brokerId: null,
      displayName: 'Orla Hennessy',
    })

    expect(screen.getByRole('heading', { name: 'Origination pipeline' })).toBeInTheDocument()
    expect(await screen.findByText('Tomasz Nowak')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(8) // header + 7 applications
  })
})
