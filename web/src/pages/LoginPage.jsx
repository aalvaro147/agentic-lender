/* Sign-in screen (mock-up screen 01).
   After a successful sign-in, AuthProvider loads the profile; once `user` is set,
   this page redirects to the page originally requested, or /pipeline.
   Stories: WEB-11, WEB-12 */

import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { USE_MOCKS } from '../services/config'

export function LoginPage() {
  const { user, loading, authError, handleLogin } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Page the user originally asked for (set by ProtectedRoute), or the pipeline
  const from = location.state?.from?.pathname ?? '/pipeline'

  // Already signed in (or just finished signing in): leave the login page
  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault() // stop the browser reloading the page on submit
    setError('')
    setSubmitting(true)
    try {
      await handleLogin(email, password)
      // No navigate() here: the redirect above runs once the profile is loaded
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const message = error || authError

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left: product panel */}
      <section className="flex flex-col justify-between gap-10 bg-navy p-10 text-white md:w-1/2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-lg font-bold">
            AL
          </div>
          <div>
            <p className="text-lg font-semibold">Agentic Lender</p>
            <p className="text-sm text-slate-300">Broker &amp; Underwriter Portal</p>
          </div>
        </div>
        <h2 className="max-w-md text-3xl leading-tight font-semibold">
          Origination, AI underwriting and on-chain settlement in one portal.
        </h2>
        <p className="text-xs text-slate-300">Prototype · Year 3 Group Project 2026</p>
      </section>

      {/* Right: form */}
      <section className="flex flex-1 items-center justify-center p-6">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-line bg-white p-8"
        >
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted">Use your work email address.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-lg border border-slate-400 px-3"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-lg border border-slate-400 px-3"
            />
          </div>

          {message && (
            <p role="alert" className="rounded-md bg-risk-high-bg px-3 py-2 text-sm text-risk-high">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          {USE_MOCKS && (
            <div className="rounded-md bg-page p-3 text-xs text-muted">
              <p className="font-semibold">Demo accounts (password: password123)</p>
              <p>orla.hennessy@bank.example: Underwriter</p>
              <p>ciaran.oneill@broker.example: Broker</p>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}
