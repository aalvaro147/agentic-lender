/* Loads one application for a page that shows it (loan file WEB-26, audit console WEB-36).
   Returns { loading, file, error }: file is null when the application cannot be shown
   (unknown ID or another broker's application, D5). */

import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getApplication } from '../services/applicationService'

export function useApplication(id) {
  const { profile } = useAuth()

  // `forId` records which ID the result belongs to, so opening another application
  // shows "Loading..." again instead of the previous one
  const [result, setResult] = useState({ forId: null, file: null, error: '' })

  useEffect(() => {
    let cancelled = false

    getApplication(profile, id)
      .then((file) => {
        if (!cancelled) setResult({ forId: id, file, error: '' })
      })
      .catch(() => {
        if (!cancelled) {
          setResult({
            forId: id,
            file: null,
            error: 'Could not load the application. Please try again later.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile, id])

  return { loading: result.forId !== id, file: result.file, error: result.error }
}
