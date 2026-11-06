import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-line bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">This address does not exist in AL-Web.</p>
        <Link
          to="/pipeline"
          className="mt-6 inline-block font-medium text-brand hover:text-brand-dark"
        >
          Go to pipeline
        </Link>
      </div>
    </main>
  )
}
