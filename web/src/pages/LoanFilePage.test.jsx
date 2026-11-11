/* WEB-26 / WEB-30: loan file page */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthContext } from '../auth/AuthContext'
import { LoanFilePage } from './LoanFilePage'

const orla = { uid: 'mock-underwriter-01', role: 'underwriter', displayName: 'Orla Hennessy' }
const ciaran = { uid: 'mock-broker-01', role: 'broker', displayName: "Ciarán O'Neill" }

function openAs(profile, applicationId) {
  return render(
    <AuthContext.Provider
      value={{ user: { uid: profile.uid }, profile, role: profile.role, loading: false }}
    >
      <MemoryRouter initialEntries={[`/applications/${applicationId}`]}>
        <Routes>
          <Route path="/applications/:id" element={<LoanFilePage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('LoanFilePage', () => {
  it('shows the borrower summary and headline figures to an underwriter (WEB-26)', async () => {
    openAs(orla, 'AL-2026-0148')

    expect(await screen.findByRole('heading', { name: 'Aoife Murphy' })).toBeInTheDocument()
    expect(screen.getByText('AI Deliberated')).toBeInTheDocument()
    expect(screen.getByText('Medium risk')).toBeInTheDocument()
    expect(screen.getByText(/Broker: Ciarán O'Neill/)).toBeInTheDocument()
    expect(screen.getByText(/Submitted 08 Oct 2026/)).toBeInTheDocument()
    expect(screen.getByText('€342,000')).toBeInTheDocument()
    expect(screen.getByText('89.3%')).toBeInTheDocument()
    expect(screen.getByText('3.98\u00D7')).toBeInTheDocument()
    expect(screen.getByText('24.9%')).toBeInTheDocument()
  })

  it('shows the property specification (WEB-30)', async () => {
    openAs(orla, 'AL-2026-0148')
    const property = await screen.findByRole('region', { name: 'Property' })

    expect(within(property).getByText('Co. Cork')).toBeInTheDocument()
    expect(within(property).getByText('Semi-detached house')).toBeInTheDocument()
    expect(within(property).getByText('3')).toBeInTheDocument()
    expect(within(property).getByText('110 m²')).toBeInTheDocument()
    expect(within(property).getByText('B2')).toBeInTheDocument()
  })

  it('shows labelled placeholders for sections built in later stories (D7)', async () => {
    openAs(orla, 'AL-2026-0148')
    await screen.findByRole('heading', { name: 'Aoife Murphy' })

    for (const [title, story] of [
      ['Collateral assessment', 'WEB-27'],
      ['Debt-to-income breakdown', 'WEB-28'],
      ['Loan structure', 'WEB-29'],
      ['Lifecycle', 'WEB-31'],
    ]) {
      const section = screen.getByRole('region', { name: title })
      expect(within(section).getByText(`Coming in ${story}`)).toBeInTheDocument()
    }
  })

  it('shows "—" and "Waiting for AI assessment" before the AI has run (D2)', async () => {
    openAs(orla, 'AL-2026-0146')
    await screen.findByRole('heading', { name: 'Sinéad & Mark Brennan' })

    expect(screen.getAllByText('Waiting for AI assessment')).toHaveLength(3)
    expect(screen.queryByText(/risk$/)).not.toBeInTheDocument()
  })

  it('shows a broker their own client without the broker line, linking back to "My clients"', async () => {
    openAs(ciaran, 'AL-2026-0148')

    expect(await screen.findByRole('heading', { name: 'Aoife Murphy' })).toBeInTheDocument()
    expect(screen.queryByText(/Broker:/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My clients' })).toHaveAttribute('href', '/pipeline')
  })

  it('treats another broker’s application exactly like an unknown ID (WEB-15, D5)', async () => {
    openAs(ciaran, 'AL-2026-0147') // Emma's client

    expect(
      await screen.findByRole('heading', { name: 'Application not found' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Tomasz Nowak')).not.toBeInTheDocument()
  })

  it('shows "Application not found" for an unknown ID (WEB-26)', async () => {
    openAs(orla, 'AL-2026-9999')

    expect(
      await screen.findByRole('heading', { name: 'Application not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to pipeline' })).toHaveAttribute(
      'href',
      '/pipeline',
    )
  })
})
