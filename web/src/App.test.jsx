import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext } from './auth/AuthContext'
import App from './App'

describe('App routes', () => {
  it('sends a logged-out visitor from /pipeline to the sign-in page', () => {
    render(
      <AuthContext.Provider
        value={{ user: null, role: null, loading: false, handleLogin: async () => {} }}
      >
        <MemoryRouter initialEntries={['/pipeline']}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})
