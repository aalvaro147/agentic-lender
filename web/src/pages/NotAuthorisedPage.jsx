/* Shown when a signed-in user opens a page their role cannot access
   (e.g. a broker visiting /stress-test). Story: WEB-14 */

import { Link } from 'react-router'

export function NotAuthorisedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-line bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold">Not authorised</h1>
        <p className="mt-2 text-muted">Your role does not have access to this page.</p>
        <Link
          to="/pipeline"
          className="mt-6 inline-block font-medium text-brand hover:text-brand-dark"
        >
          Back to pipeline
        </Link>
      </div>
    </main>
  )
}
