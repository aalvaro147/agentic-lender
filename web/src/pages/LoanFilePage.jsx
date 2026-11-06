import { useParams } from 'react-router'
import { PagePlaceholder } from '../components/PagePlaceholder'

export function LoanFilePage() {
  const { id } = useParams() // the :id part of /applications/:id
  return <PagePlaceholder title={`Loan file ${id}`} note="Coming in Sprint 2 (E3)." />
}
