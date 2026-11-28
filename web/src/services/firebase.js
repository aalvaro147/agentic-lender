import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { USE_EMULATORS, USE_MOCKS } from './config'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// In mock mode Firebase is never started, so empty keys in .env cause no errors.
export const app = USE_MOCKS ? null : initializeApp(firebaseConfig)
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

// WEB-24: point Auth and Firestore at the local emulators (ports from web/firebase.json).
// Must run before the first sign-in or query. Firebase shows a small banner while
// connected to the Auth emulator, so emulator screenshots are clearly marked.
if (USE_EMULATORS && app) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
