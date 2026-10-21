import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { USE_MOCKS } from './config'
import { auth, db } from './firebase'
import mockUsers from '../mocks/users.json'

const MOCK_SESSION_KEY = 'al-web-mock-uid'
const mockListeners = new Set()

// Same shape for mock and Firebase users: only uid + email.
function toAuthUser(u) {
  return u ? { uid: u.uid, email: u.email } : null
}

function getMockSessionUser() {
  const uid = localStorage.getItem(MOCK_SESSION_KEY)
  return toAuthUser(mockUsers.find((u) => u.uid === uid))
}

function notifyMockListeners() {
  const user = getMockSessionUser()
  mockListeners.forEach((callback) => callback(user))
}

// WEB-11, WEB-12: sign in with email + password
export async function signIn(email, password) {
  if (USE_MOCKS) {
    const match = mockUsers.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    )
    if (!match) throw new Error('Incorrect email or password.')
    localStorage.setItem(MOCK_SESSION_KEY, match.uid)
    notifyMockListeners()
    return toAuthUser(match)
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
    return toAuthUser(credential.user)
  } catch (error) {
    if (error.code === 'auth/network-request-failed') {
      throw new Error('No connection. Check your internet and try again.')
    }
    throw new Error('Incorrect email or password.')
  }
}

// WEB-16: log out
export async function signOut() {
  if (USE_MOCKS) {
    localStorage.removeItem(MOCK_SESSION_KEY)
    notifyMockListeners()
    return
  }
  await firebaseSignOut(auth)
}

// WEB-16: tell the app whenever the user signs in or out (also on page refresh).
// Returns a function that stops listening.
export function onAuthChange(callback) {
  if (USE_MOCKS) {
    mockListeners.add(callback)
    callback(getMockSessionUser())
    return () => mockListeners.delete(callback)
  }
  return onAuthStateChanged(auth, (firebaseUser) => callback(toAuthUser(firebaseUser)))
}

// WEB-13: load the user's profile (role, name, brokerId) from users/{uid}
export async function getUserProfile(uid) {
  if (USE_MOCKS) {
    const match = mockUsers.find((u) => u.uid === uid)
    if (!match) throw new Error('No profile found for this account.')
    const { password: _password, ...profile } = match
    return profile
  }

  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) throw new Error('No profile found for this account.')
  return { uid, ...snapshot.data() }
}
