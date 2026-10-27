import { useParams } from 'react-router'
import { PagePlaceholder } from '../components/PagePlaceholder'

export function AuditConsolePage() {
  const { id } = useParams()
  return <PagePlaceholder title={`AI audit console · ${id}`} note="Coming in Sprint 2 (E4)." />
}
