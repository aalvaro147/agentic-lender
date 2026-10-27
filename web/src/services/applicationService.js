import { collection, getDocs, query, where } from 'firebase/firestore'
import { USE_MOCKS } from './config'
import { db } from './firebase'
import mockApplications from '../mocks/applications.json'

// WEB-15: brokers get only their own clients; underwriters get everything.
export async function getApplications(profile) {
  if (USE_MOCKS) {
    if (profile.role === 'underwriter') return mockApplications
    return mockApplications.filter((a) => a.brokerId === profile.brokerId)
  }

  const applicationsRef = collection(db, 'applications')
  const q =
    profile.role === 'underwriter'
      ? applicationsRef
      : query(applicationsRef, where('brokerId', '==', profile.brokerId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}
