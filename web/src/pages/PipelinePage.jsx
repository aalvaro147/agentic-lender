/* Origination pipeline (mock-up screens 02a and 02b).
   Underwriters see every application; brokers see only their referred clients,
   because getApplications() filters by the signed-in profile.
   Filters and search: Sprint 2 (E2).
   Story: WEB-15 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ROLES } from '../auth/roles'
import { getApplications } from '../services/applicationService'
import { RiskBadge, StatusBadge } from '../components/Badges'
import { STATUS_LABELS } from '../utils/statuses'
import { formatDate, formatEuro, formatMultiple, formatPercent } from '../utils/format'

export function PipelinePage() {
  const { profile, role } = useAuth()
  const isBroker = role === ROLES.BROKER

  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* ----------------------- LOAD DATA ----------------------- */

  useEffect(() => {
    let cancelled = false

    getApplications(profile)
      .then((data) => {
        if (cancelled) return
        // newest first (ISO dates sort correctly as text)
        setApplications([...data].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)))
      })
      .catch(() => {
        if (!cancelled) setError('Could not load applications. Please try again later.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  /* ----------------------- SUMMARY COUNTS ----------------------- */

  // { applied: 2, ai_deliberated: 2, ... }
  const countsByStatus = applications.reduce((counts, app) => {
    counts[app.status] = (counts[app.status] ?? 0) + 1
    return counts
  }, {})

  /* ----------------------- RENDER ----------------------- */

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">
          {isBroker ? 'My clients' : 'Origination pipeline'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isBroker ? 'Applications you referred' : 'Portfolio-wide view'} · {applications.length}{' '}
          applications
        </p>
      </header>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(STATUS_LABELS).map(([code, label]) => (
          <div key={code} className="rounded-lg border border-line bg-white px-4 py-3">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{countsByStatus[code] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Loading / error / empty / table */}
      {loading && (
        <p role="status" className="text-muted">
          Loading applications…
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-risk-high-bg px-3 py-2 text-sm text-risk-high">
          {error}
        </p>
      )}

      {!loading && !error && applications.length === 0 && (
        <p className="text-muted">No applications yet.</p>
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[960px] border-collapse text-sm tabular-nums">
            <thead className="bg-page text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Application</th>
                <th className="px-4 py-3 font-semibold">Borrower</th>
                {!isBroker && <th className="px-4 py-3 font-semibold">Broker</th>}
                <th className="px-4 py-3 text-right font-semibold">Loan</th>
                <th className="px-4 py-3 text-right font-semibold">LTV</th>
                <th className="px-4 py-3 text-right font-semibold">LTI</th>
                <th className="px-4 py-3 text-right font-semibold">DTI</th>
                <th className="px-4 py-3 font-semibold">Risk</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      to={`/applications/${app.id}`}
                      className="text-brand hover:text-brand-dark"
                    >
                      {app.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{app.borrowerName}</p>
                    <p className="text-xs text-muted">{app.location}</p>
                  </td>
                  {!isBroker && <td className="px-4 py-3">{app.brokerName}</td>}
                  <td className="px-4 py-3 text-right">{formatEuro(app.loanAmount)}</td>
                  <td className="px-4 py-3 text-right">{formatPercent(app.ltv)}</td>
                  <td className="px-4 py-3 text-right">{formatMultiple(app.lti)}</td>
                  <td className="px-4 py-3 text-right">{formatPercent(app.dti)}</td>
                  <td className="px-4 py-3">
                    <RiskBadge tier={app.riskTier} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(app.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        LTV = loan ÷ property valuation · LTI = loan ÷ gross annual income · DTI = monthly debt
        repayments ÷ gross monthly income.
      </p>
    </div>
  )
}
