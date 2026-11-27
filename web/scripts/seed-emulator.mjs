/* WEB-24: loads the AL-Web mock data into the local Firebase emulators, so the live
   (non-mock) code path can be tested without the group Firebase project.
   Run while the emulators are running:  npm run emulators  then  npm run seed:emulator

   - Auth: one account per mock user (same email and password as mock mode), with the
     role as a custom claim, because Core's firestore.rules read request.auth.token.role
   - Firestore: users/{uid} (without the password) and applications/{applicationId}
   Every run clears both emulators first, so it can be repeated safely.
   Writes use the emulator-only "Bearer owner" token, which bypasses the Security
   Rules (like the Admin SDK); the app itself is still checked by Core's rules. */

import { readFile } from 'node:fs/promises'

const PROJECT = 'demo-al'
const AUTH = 'http://127.0.0.1:9099'
const FIRESTORE = 'http://127.0.0.1:8080'
const DOCUMENTS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)))
const users = await readJson('../src/mocks/users.json')
const applications = await readJson('../src/mocks/applications.json')

async function call(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: OWNER,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new Error(`${method} ${url} failed: ${response.status} ${await response.text()}`)
  }
}

// Firestore REST stores every value with its type, e.g. { integerValue: '8600000' }
function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } }
  return { mapValue: { fields: toFields(value) } }
}
const toFields = (object) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toValue(value)]))

const saveDocument = (path, data) =>
  call('PATCH', `${DOCUMENTS}/${path}`, { fields: toFields(data) })

try {
  // 1. Start from empty emulators
  await call('DELETE', `${AUTH}/emulator/v1/projects/${PROJECT}/accounts`)
  await call('DELETE', `${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`)

  // 2. Accounts with their role claim, and their profile documents
  const accounts = `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`
  for (const { password, ...profile } of users) {
    await call('POST', accounts, {
      localId: profile.uid,
      email: profile.email,
      password,
      displayName: profile.displayName,
    })
    await call('POST', `${accounts}:update`, {
      localId: profile.uid,
      customAttributes: JSON.stringify({ role: profile.role }),
    })
    await saveDocument(`users/${profile.uid}`, profile)
  }

  // 3. Applications, with the application ID as the document ID (AL-Core contract)
  for (const application of applications) {
    await saveDocument(`applications/${application.applicationId}`, application)
  }

  console.log(
    `Seeded ${users.length} users and ${applications.length} applications into ${PROJECT}.`,
  )
} catch (error) {
  console.error(error.message)
  console.error('Are the emulators running? Start them with: npm run emulators')
  process.exit(1)
}
