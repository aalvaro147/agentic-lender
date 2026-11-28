/*  Loads applications for the pipeline, in mock or live (Firestore) mode.
    Both modes return rows built by toPipelineRow(), so the UI never sees raw documents.
    Stories: WEB-09 (mock/live switch), WEB-15 (brokers see only their own clients),
    WEB-08 (AL-Core document shape), WEB-26 (one application for the loan file),
    WEB-24 (real-time pipeline: subscribeApplications) */

import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { USE_MOCKS } from './config'
import { db } from './firebase'
import { toLoanFile, toPipelineRow } from './applicationMapper'
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
function mockRows(profile) {
  const docs =
    profile.role === ROLES.UNDERWRITER
      ? mockApplications
      : mockApplications.filter((a) => a.brokerId === profile.uid)
  return docs.map((d) => toPipelineRow(d, mockUsersById))
}

// The rules only allow a broker to list applications when the query itself filters
// by brokerId == their uid (rules are not filters), so the filter must stay here.
function applicationsQuery(profile) {
  const applicationsRef = collection(db, 'applications')
  return profile.role === ROLES.UNDERWRITER
    ? applicationsRef
    : query(applicationsRef, where('brokerId', '==', profile.uid))
}

// WEB-24: keeps the pipeline up to date without a page refresh.
// Calls onRows(rows) with the full list every time Firestore reports a change, and
// onError(error) if loading fails. Returns a function that stops listening.
// Mock mode sends the mock rows once (mock data never changes).
export function subscribeApplications(profile, onRows, onError) {
  if (USE_MOCKS) {
    onRows(mockRows(profile))
    return () => {}
  }

  let active = true
  let latestDocs = null
  let usersById = null

  // Rows are sent only when both the applications and the names are ready, so the
  // table never shows a row without names first. Names are read once per subscription:
  // a borrower created after the page opened shows "—" until the page is reloaded.
  const emit = () => {
    if (!active || latestDocs === null || usersById === null) return
    onRows(latestDocs.map((d) => toPipelineRow({ id: d.id, ...d.data() }, usersById)))
  }

  getReadableUsers(profile)
    .then((users) => {
      usersById = users
      emit()
    })
    .catch((error) => {
      if (active) onError(error)
    })

  const unsubscribe = onSnapshot(
    applicationsQuery(profile),
    (snapshot) => {
      latestDocs = snapshot.docs
      emit()
    },
    (error) => {
      if (active) onError(error)
    },
  )

  return () => {
    active = false
    unsubscribe()
  }
}

// WEB-26: one application for the loan file, or null when it cannot be shown.
// D5: an unknown ID and another broker's application both return null, so the page
// shows the same "Application not found" and never confirms that someone else's ID exists.
export async function getApplication(profile, applicationId) {
  const isUnderwriter = profile.role === ROLES.UNDERWRITER

  if (USE_MOCKS) {
    const found = mockApplications.find((a) => a.applicationId === applicationId)
    if (!found || (!isUnderwriter && found.brokerId !== profile.uid)) return null
    return toLoanFile(found, mockUsersById)
  }

  try {
    const [snapshot, usersById] = await Promise.all([
      getDoc(doc(db, 'applications', applicationId)),
      getReadableUsers(profile),
    ])
    return snapshot.exists() ? toLoanFile({ id: snapshot.id, ...snapshot.data() }, usersById) : null
  } catch (error) {
    // The Security Rules refuse another broker's application: treat it as not found (D5)
    if (error.code === 'permission-denied') return null
    throw error
  }
}
