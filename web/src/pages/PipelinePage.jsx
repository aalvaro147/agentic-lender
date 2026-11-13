/* Origination pipeline (mock-up screens 02a and 02b).
  Underwriters see every application; brokers see only their referred clients,
  because subscribeApplications() filters by the signed-in profile.
  Stories: WEB-15, WEB-18, WEB-19, WEB-25 (summary cards),
  WEB-20 / 21 / 22 (filters), WEB-23 (search + sort), WEB-08 (AL-Core data shape),
  WEB-24 (real-time updates) */

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ROLES } from '../auth/roles'
import { subscribeApplications } from '../services/applicationService'
import { RiskBadge, StatusBadge } from '../components/Badges'
import { STATUS_LABELS } from '../utils/statuses'
import { EMPTY, formatBps, formatCents, formatDate, formatMultiple } from '../utils/format'
import { PipelineFilters } from '../components/PipelineFilters'
import { SortableHeader } from '../components/SortableHeader'
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  filterApplications,
  nextSort,
  sortApplications,
} from '../utils/pipelineFilters'

export function PipelinePage() {
  const { profile, role } = useAuth()
  const isBroker = role === ROLES.BROKER

  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState(DEFAULT_SORT)

  /* ----------------------- LOAD DATA ----------------------- */

  // WEB-24: listen for changes instead of loading once. Every update replaces the rows,
  // and the filters, search and sort below are applied to the new rows automatically.
  // The returned stop function runs when the page closes, so no update arrives after
  // that (this replaces the FLT-02 "cancelled" flag).
  useEffect(() => {
    return subscribeApplications(
      profile,
      (rows) => {
        setApplications(rows)
        setError('')
        setLoading(false)
      },
      () => {
        setError('Could not load applications. Please try again later.')
        setLoading(false)
      },
    )
  }, [profile])

  /* ----------------------- DERIVED DATA ----------------------- */

  // Recalculated only when the data, filters or sort change
  const visibleApplications = useMemo(
    () => sortApplications(filterApplications(applications, filters), sort),
    [applications, filters, sort],
  )

  // Summary cards always count the whole portfolio, not just the filtered rows
  const countsByStatus = useMemo(
    () =>
      applications.reduce((counts, app) => {
        counts[app.status] = (counts[app.status] ?? 0) + 1
        return counts
      }, {}),
    [applications],
  )

  /* ----------------------- HANDLERS ----------------------- */

  const updateFilters = (changes) => setFilters((current) => ({ ...current, ...changes }))
  const clearFilters = () => setFilters(EMPTY_FILTERS)
  const changeSort = (column) => setSort((current) => nextSort(current, column))

  const headerProps = { sort, onSort: changeSort }

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

      {/* Status summary cards (WEB-25) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(STATUS_LABELS).map(([code, label]) => (
          <div key={code} className="rounded-lg border border-line bg-white px-4 py-3">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{countsByStatus[code] ?? 0}</p>
          </div>
        ))}
      </div>

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
        <>
          <PipelineFilters
            filters={filters}
            onChange={updateFilters}
            onClear={clearFilters}
            shown={visibleApplications.length}
            total={applications.length}
          />

          {visibleApplications.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-8 text-center">
              <p className="font-medium">No applications match these filters.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 font-medium text-brand hover:text-brand-dark"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full min-w-[960px] border-collapse text-sm tabular-nums">
                <thead className="bg-page text-xs text-muted">
                  <tr>
                    <SortableHeader label="Application" column="id" {...headerProps} />
                    <SortableHeader label="Borrower" column="borrowerName" {...headerProps} />
                    {!isBroker && (
                      <SortableHeader label="Broker" column="brokerName" {...headerProps} />
                    )}
                    <SortableHeader
                      label="Loan"
                      column="loanAmountMinorUnits"
                      align="right"
                      {...headerProps}
                    />
                    <SortableHeader label="LTV" column="ltvBps" align="right" {...headerProps} />
                    <SortableHeader label="LTI" column="lti" align="right" {...headerProps} />
                    <SortableHeader label="DTI" column="dtiBps" align="right" {...headerProps} />
                    <SortableHeader label="Risk" column="riskTier" {...headerProps} />
                    <SortableHeader label="Status" column="status" {...headerProps} />
                    <SortableHeader label="Submitted" column="submittedAt" {...headerProps} />
                  </tr>
                </thead>
                <tbody>
                  {visibleApplications.map((app) => (
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
                        <p className="font-medium">{app.borrowerName ?? EMPTY}</p>
                        <p className="text-xs text-muted">{app.location ?? EMPTY}</p>
                      </td>
                      {!isBroker && <td className="px-4 py-3">{app.brokerName ?? EMPTY}</td>}
                      <td className="px-4 py-3 text-right">
                        {formatCents(app.loanAmountMinorUnits)}
                      </td>
                      <td className="px-4 py-3 text-right">{formatBps(app.ltvBps)}</td>
                      <td className="px-4 py-3 text-right">{formatMultiple(app.lti)}</td>
                      <td className="px-4 py-3 text-right">{formatBps(app.dtiBps)}</td>
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
        </>
      )}

      {/* TEMP(Q1-LOAN): update this note when the loan-amount field is agreed */}
      <p className="text-xs text-muted">
        LTV, LTI, DTI and risk come from the AI assessment and show “—” until the AI has run. Loan =
        asking price - deposit (provisional, pending the group data contract).
      </p>
    </div>
  )
}
