import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows the AL-Web heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'AL-Web' })).toBeInTheDocument()
  })
})
