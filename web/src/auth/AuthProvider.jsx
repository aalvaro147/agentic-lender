/* Manages authentication across the whole app.
   - Listens to authService for sign-in / sign-out (also fires on page refresh)
   - Loads the user's profile (role, name, brokerId) after sign-in
   - Shares user, profile, role, loading and the login/logout actions via context
   Stories: WEB-11, WEB-12, WEB-13, WEB-16 */

import { useEffect, useState } from 'react'
import { AuthContext } from './AuthContext'
import { getUserProfile, onAuthChange, signIn, signOut } from '../services/authService'

export function AuthProvider({ children }) {
  /* ----------------------- STATE ----------------------- */

  const [user, setUser] = useState(null) // { uid, email } or null
  const [profile, setProfile] = useState(null) // { displayName, role, brokerId, ... } or null
  const [loading, setLoading] = useState(true) // true until the first auth check finishes
  const [authError, setAuthError] = useState(null) // e.g. signed in but no profile in Firestore

  /* ----------------------- LISTEN FOR AUTH CHANGES ----------------------- */

  useEffect(() => {
    // Guards against updating state after this component has unmounted
    // (React StrictMode mounts effects twice in development).
    let cancelled = false

    const unsubscribe = onAuthChange(async (authUser) => {
      // Signed out (or nobody signed in on page load)
      if (!authUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      // Signed in: load the profile before showing any protected page
      setLoading(true)
      try {
        const userProfile = await getUserProfile(authUser.uid)
        if (cancelled) return
        setUser(authUser)
        setProfile(userProfile)
        setAuthError(null)
      } catch (error) {
        if (cancelled) return
        // An account with no profile has no role, so it must not get in.
        setAuthError(error.message)
        await signOut() // triggers this listener again with null
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    // Cleanup: stop listening when the provider unmounts
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  /* ----------------------- ACTIONS ----------------------- */

  const handleLogin = async (email, password) => {
    // signIn() throws on bad credentials. The error is NOT caught here:
    // it propagates to LoginPage, which decides how to show it.
    // No setUser here: onAuthChange fires after a successful sign-in and loads the profile.
    setAuthError(null)
    await signIn(email, password)
  }

  const handleLogout = async () => {
    await signOut()
  }

  /* ----------------------- PROVIDE ----------------------- */

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    loading,
    authError,
    handleLogin,
    handleLogout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
