/* Loan file: one application in detail (mock-up screen 03).
   Stories: WEB-26 (open from the pipeline; unknown ID → "not found"),
   WEB-30 (property specification), WEB-27 (collateral), WEB-29 (loan structure),
   WEB-15 (brokers cannot open other brokers' files), WEB-36 (link to the AI audit console).
   Decisions: D5 (another broker's file looks exactly like an unknown ID),
   D7 (labelled placeholders for sections built in later stories). */

import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ROLES } from '../auth/roles'
import { useApplication } from '../hooks/useApplication'
import { RiskBadge, StatusBadge } from '../components/Badges'
import { KeyFigure, PropertyCard, SectionPlaceholder } from '../components/LoanFileSections'
import { EMPTY, formatBps, formatCents, formatDate, formatMultiple } from '../utils/format'
import { CollateralCard } from '../components/CollateralCard'
import { LoanStructureCard } from '../components/LoanStructureCard'

const WAITING_FOR_AI = 'Waiting for AI assessment'

export function LoanFilePage() {
  const { id } = useParams() // the :id part of /applications/:id
  const { role } = useAuth()
  const isBroker = role === ROLES.BROKER
  const pipelineLabel = isBroker ? 'My clients' : 'Pipeline'
  const { loading, file: loadedFile, error } = useApplication(id)

  /* ----------------------- RENDER ----------------------- */

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <Link to="/pipeline" className="text-brand underline hover:text-brand-dark">
        {pipelineLabel}
      </Link>{' '}
      / <span className="font-mono">{id}</span>
    </nav>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {breadcrumb}
        <p role="status" className="text-muted">
          Loading application…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {breadcrumb}
        <p role="alert" className="rounded-md bg-risk-high-bg px-3 py-2 text-sm text-risk-high">
          {error}
        </p>
      </div>
    )
  }

  // D5: unknown ID and another broker's application end here in the same way
  if (!loadedFile) {
    return (
      <div className="flex flex-col gap-6">
        {breadcrumb}
        <div className="rounded-lg border border-line bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold">Application not found</h1>
          <p className="mt-2 text-muted">
            There is no application {id}, or it is not available to you.
          </p>
          <Link
            to="/pipeline"
            className="mt-6 inline-block font-medium text-brand hover:text-brand-dark"
          >
            Back to {pipelineLabel.toLowerCase()}
          </Link>
        </div>
      </div>
    )
  }

  const file = loadedFile
  const hasAi = file.ltvBps !== null

  return (
    <div className="flex flex-col gap-6">
      {breadcrumb}

      {/* Borrower summary (WEB-26) */}
      <header>
        <h1 className="text-3xl font-semibold">{file.borrowerName ?? EMPTY}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <StatusBadge status={file.status} />
          {file.riskTier && <RiskBadge tier={file.riskTier} suffix=" risk" />}
          <span>
            {!isBroker && <>Broker: {file.brokerName ?? EMPTY} · </>}
            Submitted {formatDate(file.submittedAt)}
          </span>
        </div>
        <Link
          to={`/applications/${id}/audit`}
          className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-dark"
        >
          Open AI audit console
        </Link>
      </header>

      {/* Headline figures: the same values as the pipeline row */}
      <section
        aria-label="Headline figures"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* TEMP(Q1-LOAN): note changes when the loan-amount field is agreed */}
        <KeyFigure
          label="Loan amount"
          value={formatCents(file.loanAmountMinorUnits)}
          note="Provisional (asking − deposit)"
        />
        <KeyFigure
          label="Loan-to-value"
          value={formatBps(file.ltvBps)}
          note={hasAi ? null : WAITING_FOR_AI}
        />
        <KeyFigure
          label="Loan-to-income"
          value={formatMultiple(file.lti)}
          note={hasAi ? null : WAITING_FOR_AI}
        />
        <KeyFigure
          label="Debt-to-income"
          value={formatBps(file.dtiBps)}
          note={hasAi ? null : WAITING_FOR_AI}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <CollateralCard collateral={file.collateral} />
          <SectionPlaceholder
            title="Debt-to-income breakdown"
            story="WEB-28"
            description="Income, proposed repayment and existing debts that make up the DTI."
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <PropertyCard property={file.property} />
          <LoanStructureCard loanStructure={file.loanStructure} />
          <SectionPlaceholder
            title="Lifecycle"
            story="WEB-31"
            description="Each status change with its date, from application to closure."
          />
        </div>
      </div>
    </div>
  )
}
