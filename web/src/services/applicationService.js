/*  Loads applications for the pipeline, in mock or live (Firestore) mode.
    Both modes return rows built by toPipelineRow(), so the UI never sees raw documents.
    Stories: WEB-09 (mock/live switch), WEB-15 (brokers see only their own clients),
    WEB-08 (AL-Core document shape) */

import { collection, getDocs, query, where } from 'firebase/firestore'
import { USE_MOCKS } from './config'
import { db } from './firebase'
import { toPipelineRow } from './applicationMapper'
import { ROLES } from '../auth/roles'
// TEMP(AI-MOCK): mocks follow applications.schema.json; their aiAssessment was generated
// by the AI engine mock-0.2 from translated inputs (see src/mocks/README.md).
// Regenerate when the AI engine is aligned with the AL-Core schema.
import mockApplications from '../mocks/applications.json'
import mockUsers from '../mocks/users.json'

// TEMP(Q3-NAMES): mock mode lets every role see names, as if Q3 were already solved.
// Live mode below follows the current Security Rules.
const mockUsersById = Object.fromEntries(
  mockUsers.map((u) => [u.uid, { displayName: u.displayName }]),
)

// Profiles the signed-in user may read, as { [uid]: { displayName } }.
// Rules: only an underwriter may list users; a broker cannot read borrowers' profiles.
async function getReadableUsers(profile) {
  if (profile.role !== ROLES.UNDERWRITER) return {}
  const snapshot = await getDocs(collection(db, 'users'))
  return Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data()]))
}

// WEB-15: brokers get only applications assigned to them (brokerId = their uid);
// underwriters get everything. In live mode the Security Rules enforce the same.
export async function getApplications(profile) {
  const isUnderwriter = profile.role === ROLES.UNDERWRITER

  if (USE_MOCKS) {
    const docs = isUnderwriter
      ? mockApplications
      : mockApplications.filter((a) => a.brokerId === profile.uid)
    return docs.map((d) => toPipelineRow(d, mockUsersById))
  }

  const applicationsRef = collection(db, 'applications')
  const q = isUnderwriter
    ? applicationsRef
    : query(applicationsRef, where('brokerId', '==', profile.uid))
  const [snapshot, usersById] = await Promise.all([getDocs(q), getReadableUsers(profile)])
  return snapshot.docs.map((d) => toPipelineRow({ id: d.id, ...d.data() }, usersById))
}