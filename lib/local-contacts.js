// Client-side store for the Referrals feature's address book.
//
// WHY THIS IS NOT A DATABASE TABLE (Stage 74).
// Contacts are personal data about third parties: real people who have no
// account here, never agreed to anything, and in most cases will never know
// Requite exists. Holding that server-side made Requite a controller of a
// stranger's personal data, which brings UK GDPR Art 14 (tell the data
// subject, within a month, that you hold their data) and Art 6 (have a
// lawful basis) into play, with no realistic way to satisfy either: there is
// no route to notify someone whose only connection to the product is that a
// user typed their name into a box.
//
// Keeping the address book in the user's own browser removes the question
// rather than answering it. The data stays on the user's device, under their
// control, in the same way the contacts app on their phone is theirs and not
// their phone manufacturer's. Requite never receives it, never stores it, and
// has nothing to disclose, delete or notify about.
//
// The one thing that does leave the device is a single contact's details at
// the moment the user explicitly asks for a draft message, sent transiently
// to /api/referral/draft and never persisted there. That is disclosed in the
// UI at the point of use.
//
// Trade-off accepted deliberately: the address book does not sync across
// devices and is lost if the user clears site data. That is the cost of not
// holding other people's personal data on a server, and it is the right side
// of the trade for a feature holding this specific kind of data.

const CONTACTS_KEY = 'mkr_contacts'
const REQUESTS_KEY = 'mkr_referral_requests'

// Every accessor is wrapped: localStorage throws outright in some contexts
// (private windows, embedded webviews, site-data blocked), and the Referrals
// tab must degrade to "empty address book" rather than crash the dashboard.
function read(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
    return true
  } catch {
    return false
  }
}

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
  }
}

// ── Contacts ────────────────────────────────────────────────────────────
// Row shape is kept identical to the retired `contacts` table so the tab's
// rendering code did not have to change when this moved off the server.

export function listContacts() {
  return read(CONTACTS_KEY).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export function upsertContact(row, id) {
  const rows = read(CONTACTS_KEY)
  const now = new Date().toISOString()
  if (id) {
    const i = rows.findIndex(r => r.id === id)
    if (i !== -1) rows[i] = { ...rows[i], ...row, updated_at: now }
  } else {
    rows.push({ id: newId(), created_at: now, updated_at: now, last_contacted_at: null, ...row })
  }
  return write(CONTACTS_KEY, rows)
}

export function deleteContact(id) {
  const rows = read(CONTACTS_KEY).filter(r => r.id !== id)
  // Requests referencing a deleted contact are orphans with a dangling name;
  // clear them too so the history list never shows "Unknown contact" rows.
  const reqs = read(REQUESTS_KEY).filter(r => r.contact_id !== id)
  write(REQUESTS_KEY, reqs)
  return write(CONTACTS_KEY, rows)
}

export function touchContact(id) {
  const rows = read(CONTACTS_KEY)
  const i = rows.findIndex(r => r.id === id)
  if (i === -1) return false
  rows[i] = { ...rows[i], last_contacted_at: new Date().toISOString() }
  return write(CONTACTS_KEY, rows)
}

// ── Referral requests ───────────────────────────────────────────────────

export function listRequests() {
  return read(REQUESTS_KEY).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

export function insertRequest(row) {
  const rows = read(REQUESTS_KEY)
  const now = new Date().toISOString()
  rows.push({ id: newId(), created_at: now, updated_at: now, ...row })
  return write(REQUESTS_KEY, rows)
}

export function updateRequest(id, update) {
  const rows = read(REQUESTS_KEY)
  const i = rows.findIndex(r => r.id === id)
  if (i === -1) return false
  rows[i] = { ...rows[i], ...update, updated_at: new Date().toISOString() }
  return write(REQUESTS_KEY, rows)
}

// True when the browser will not persist anything, so the UI can say so
// honestly instead of silently dropping every contact the user adds.
export function storageAvailable() {
  try {
    const probe = '__mkr_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}
