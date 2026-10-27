/* Shorthand hook so components call useAuth() instead of
   importing AuthContext + useContext everywhere. */

import { useContext } from 'react'
import { AuthContext } from './AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth() must be used inside <AuthProvider>.')
  }
  return context
}
