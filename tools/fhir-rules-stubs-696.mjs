// Stubs for oms 696 (BackOffice spec 3271, door 3282), on the real envelope. 🚩 Paths and shapes guessed; 711 reconciles.
//   GET  InsuranceRules/Fields/Proposals               → { proposals, viewer: { approver } }
//   POST InsuranceRules/Fields/Proposals               the row → the proposal
//   POST InsuranceRules/Fields/Proposals/{id}/Approve  {} → the proposal; its row joins the catalog
//   POST InsuranceRules/Fields/Proposals/{id}/Reject   { reason } → the proposal
// Synthetic data only.
import { FHIR_CATALOG } from './fhir-rules-stubs-692.mjs'
import { probeReply } from './fhir-rules-stubs-695.mjs'
import { envelope } from './insurance-rules-stubs.mjs'

const BASE = 'InsuranceRules/Fields/Proposals'
const refuse = (status, message, errorCode) => envelope(null, { status, success: false, message, errorCode })

export const proposal = (id, o = {}) => ({
  id,
  key: `proposed${id}`,
  label: { en: `Proposed ${id}`, ar: `حقل مقترح ${id}` },
  moment: 'claimResponse',
  level: 'line',
  type: 'money',
  cardinality: 'single',
  system: null,
  fhirPath: "adjudication.where(category.coding.code = 'copay').amount",
  state: 'proposed',
  proposedBy: 'nalharbi',
  proposedAt: '2026-10-20T09:00:00',
  probe: probeReply({}),
  patientWarning: false,
  decidedBy: null,
  decidedAt: null,
  rejectReason: null,
  ...o,
})

/** One store two sessions share, so the second user sees what the first proposed. */
export function newProposalStore(rows = []) {
  return { next: 1, rows, catalog: [...FHIR_CATALOG], writes: [] }
}

/** `viewer.approver` false answers as a reader; `deny` lists the doors that answer a bare 403 (`list`, `approve`). */
export function fieldProposalsStub(method, path, body, { store, user, viewer = { approver: true }, deny = [], now = '2026-10-30T10:30:00' }) {
  if (path !== BASE && !path.startsWith(`${BASE}/`)) return null
  if (path === BASE && method === 'GET') {
    if (deny.includes('list')) return { status: 403, contentType: 'application/json', body: '' }
    return envelope({ proposals: store.rows, viewer })
  }
  if (path === BASE && method === 'POST') {
    const row = proposal(`FP-${store.next++}`, { ...body, proposedBy: user, proposedAt: now, probe: probeReply({ path: body.fhirPath }), patientWarning: /Patient/.test(body.fhirPath) })
    store.rows.push(row)
    return envelope(row)
  }
  const m = /^InsuranceRules\/Fields\/Proposals\/([^/]+)\/(Approve|Reject)$/.exec(path)
  if (!m || method !== 'POST') return null
  store.writes.push({ door: m[2], id: decodeURIComponent(m[1]), body, user })
  if (m[2] === 'Approve' && deny.includes('approve')) return { status: 403, contentType: 'application/json', body: '' }
  const row = store.rows.find((r) => r.id === decodeURIComponent(m[1]))
  if (!row) return refuse(404, 'No such proposal.', 'INSFIELDS_PROPOSAL_NOT_FOUND')
  // `authorIs` is what HQ knows that the list did not say, such as an author under a second login.
  if (row.proposedBy?.toLowerCase() === user.toLowerCase() || row.authorIs === user)
    return refuse(409, 'Someone other than the author must decide a proposed field.', 'INSFIELDS_SELF_APPROVAL')
  if (row.state !== 'proposed') return refuse(409, 'This proposal has already been decided.', 'INSFIELDS_PROPOSAL_DECIDED')
  if (m[2] === 'Reject') {
    if (!body?.reason) return refuse(400, 'A rejection needs its reason.', 'INSFIELDS_REASON_REQUIRED')
    Object.assign(row, { state: 'rejected', decidedBy: user, decidedAt: now, rejectReason: body.reason })
    return envelope(row)
  }
  Object.assign(row, { state: 'approved', decidedBy: user, decidedAt: now })
  store.catalog.push({ key: row.key, label: row.label, moment: row.moment, level: row.level, type: row.type, unit: null, fhirPath: row.fhirPath, cardinality: row.cardinality, system: row.system, channels: [{ channel: 'nphies', answer: 'answers' }], parameter: null, choice: null, legacy: null, retired: false })
  return envelope(row)
}
