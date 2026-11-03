/* Filter bar above the pipeline table: search, status, LTV band and risk tier.
   Stories: WEB-20, WEB-21, WEB-22, WEB-23 */

import { LTV_BANDS, hasActiveFilters } from '../utils/pipelineFilters'
import { RISK_LABELS, STATUS_LABELS } from '../utils/statuses'

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
const LTV_OPTIONS = LTV_BANDS.map((band) => ({ value: band.id, label: band.label }))
const RISK_OPTIONS = Object.entries(RISK_LABELS).map(([value, label]) => ({ value, label }))

const FIELD = 'flex flex-[1_1_10rem] flex-col gap-1.5'
const LABEL = 'text-sm font-medium'
const CONTROL = 'h-11 rounded-lg border border-slate-400 bg-white px-3'

/* ----------------------- FILTER SELECT (used 3 times below) ----------------------- */

function FilterSelect({ id, label, allLabel, options, value, onChange }) {
  return (
    <div className={FIELD}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ----------------------- FILTER BAR ----------------------- */

// filters  – current values, e.g. { search: '', status: 'all', ltvBand: 'all', riskTier: 'all' }
// onChange – called with only the changed field, e.g. { status: 'applied' }
export function PipelineFilters({ filters, onChange, onClear, shown, total }) {
  return (
    <section
      aria-label="Filter applications"
      className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-[2_1_16rem] flex-col gap-1.5">
          <label htmlFor="pipeline-search" className={LABEL}>
            Search
          </label>
          <input
            id="pipeline-search"
            type="search"
            placeholder="Borrower name or application ID"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className={CONTROL}
          />
        </div>
        <FilterSelect
          id="pipeline-status"
          label="Status"
          allLabel="All statuses"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(status) => onChange({ status })}
        />
        <FilterSelect
          id="pipeline-ltv"
          label="LTV band"
          allLabel="All bands"
          options={LTV_OPTIONS}
          value={filters.ltvBand}
          onChange={(ltvBand) => onChange({ ltvBand })}
        />
        <FilterSelect
          id="pipeline-risk"
          label="Risk tier"
          allLabel="All tiers"
          options={RISK_OPTIONS}
          value={filters.riskTier}
          onChange={(riskTier) => onChange({ riskTier })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {/* aria-live: screen readers announce the new count when filters change */}
        <p aria-live="polite" className="text-muted">
          Showing {shown} of {total} applications
        </p>
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={onClear}
            className="font-medium text-brand hover:text-brand-dark"
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}
