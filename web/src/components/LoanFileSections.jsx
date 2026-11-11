/* Building blocks of the loan file page (mock-up screen 03).
   Stories: WEB-26 (page), WEB-30 (property), D7 (placeholders for later stories) */

import { EMPTY, formatArea } from '../utils/format'

const CARD = 'rounded-lg border border-line bg-white p-6'

/* ----------------------- HEADLINE FIGURE ----------------------- */

// One of the four figures under the header (loan, LTV, LTI, DTI)
export function KeyFigure({ label, value, note }) {
  return (
    <div className={CARD}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  )
}

/* ----------------------- PROPERTY (WEB-30) ----------------------- */

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value ?? EMPTY}</dd>
    </div>
  )
}

export function PropertyCard({ property }) {
  return (
    <section aria-labelledby="property-heading" className={CARD}>
      <h2 id="property-heading" className="text-xl font-semibold">
        Property
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Location" value={property.location} />
        <Field label="Type" value={property.propertyType} />
        <Field label="Bedrooms" value={property.bedrooms} />
        <Field label="Floor area" value={formatArea(property.floorAreaSquareMetres)} />
        <Field label="BER rating" value={property.berRating} />
      </dl>
    </section>
  )
}

/* ----------------------- PLACEHOLDER (D7) ----------------------- */

// Shows where a later story's section will go; each story replaces its own placeholder
export function SectionPlaceholder({ title, story, description }) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border-2 border-dashed border-line bg-white/60 p-6"
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm font-medium text-brand">Coming in {story}</p>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </section>
  )
}
