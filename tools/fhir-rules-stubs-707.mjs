// Stubs for oms ticket 707: the curation worklist and label overrides (BackOffice 3297, unbuilt, shapes guessed; 711
// reconciles). On the real envelope:
//   GET  InsuranceRules/Labels/Worklist                → { censusAvailable, total, items }, in the door's order
//   GET  InsuranceRules/Labels/Overrides?waiting=true  → what waits for a second person
//   POST InsuranceRules/Labels/Overrides               → the proposal, or a refusal
//   POST InsuranceRules/Labels/Overrides/{id}/Approve  → the approved row; a code with Arabic now leaves the worklist
import { envelope } from './insurance-rules-stubs.mjs'

export const SYSTEM = 'http://nphies.sa/terminology/CodeSystem/benefit-category'
export const ERRORS = 'http://nphies.sa/terminology/CodeSystem/adjudication-error'

/** Deliberately not one sort: lacks-Arabic first, each kind most-used first, so a client sort by any column breaks it. */
export const WORKLIST = [
  { system: SYSTEM, code: '12', reason: 'lacksArabic', frequency: 900, current: { en: 'Dental care', ar: null } },
  { system: ERRORS, code: 'BV-00027', reason: 'lacksArabic', frequency: 40, current: { en: 'Coverage is not in force', ar: null } },
  { system: ERRORS, code: 'AA-001', reason: 'unlabelled', frequency: 5000, current: null },
  { system: SYSTEM, code: '7', reason: 'unlabelled', frequency: 3, current: null },
  { system: SYSTEM, code: '99', reason: 'nextRelease', frequency: 1, current: null },
]

export const newCurationState = () => ({ worklist: WORKLIST.map((r) => ({ ...r })), overrides: [], next: 1, writes: [] })

const REFUSE = (status, message, errorCode) => envelope(null, { status, success: false, message, errorCode })

/** `opts`: `{ state, query, user, now, deny: string[] }`; `query` is the URL's `URLSearchParams`, `deny` answers a bare 403. */
export function curationStub(method, path, body, opts = {}) {
  const { state, query = new URLSearchParams(), user = 'nalharbi', now = '2026-10-30T10:30:00', deny = [] } = opts
  const bare = { status: 403, body: '' }
  const TIERS = { lacksArabic: 'rulesetCanShow', unlabelled: 'seenUnlabelled' }
  const wireItem = (r) => ({ tier: TIERS[r.reason] ?? r.reason, system: r.system, code: r.code, en: r.current?.en ?? null, ar: r.current?.ar ?? null, censusCount: r.frequency })
  const wireOverride = ({ state: status, current, proposedBy, approvedBy, approvedAt, ...o }) => ({
    ...o,
    status,
    sourceEn: current?.en ?? null,
    sourceAr: current?.ar ?? null,
    author: proposedBy,
    decidedBy: approvedBy ?? '',
    decidedAt: approvedAt ?? '0001-01-01T00:00:00',
  })

  if (path === 'InsuranceRules/Labels/Worklist' && method === 'GET') return deny.includes('worklist') ? bare : envelope({ censusAvailable: true, total: state.worklist.length, items: state.worklist.map(wireItem) })

  if (path === 'InsuranceRules/Labels/Overrides' && method === 'GET') {
    if (deny.includes('proposed')) return bare
    const waiting = query.get('waiting') === 'true'
    return envelope(state.overrides.filter((o) => !waiting || o.state === 'proposed').map(wireOverride))
  }

  if (path === 'InsuranceRules/Labels/Overrides' && method === 'POST') {
    state.writes.push({ path, body, user })
    if (deny.includes('propose')) return bare
    if (!body.en && !body.ar) return REFUSE(400, 'A label needs English or Arabic.', 'LABEL_OVERRIDE_EMPTY')
    if (body.code === 'NOPE') return REFUSE(400, 'No source lists this code.', 'LABEL_CODE_UNKNOWN')
    if (state.overrides.some((o) => o.state === 'proposed' && o.system === body.system && o.code === body.code))
      return REFUSE(409, 'This code already has a label awaiting approval.', 'LABEL_OVERRIDE_PENDING')
    const current = state.worklist.find((r) => r.system === body.system && r.code === body.code)?.current ?? null
    const row = { id: `O-${state.next++}`, ...body, state: 'proposed', current, proposedBy: user, proposedAt: now, approvedBy: null, approvedAt: null }
    state.overrides.push(row)
    return envelope(wireOverride(row))
  }

  const approve = /^InsuranceRules\/Labels\/Overrides\/([^/]+)\/Approve$/.exec(path)
  if (approve && method === 'POST') {
    state.writes.push({ path, body, user })
    const row = state.overrides.find((o) => o.id === decodeURIComponent(approve[1]))
    if (!row) return REFUSE(404, 'No such label.', 'LABEL_OVERRIDE_NOT_FOUND')
    if (row.proposedBy?.toLowerCase() === user.toLowerCase()) return REFUSE(409, 'Someone other than the author must approve a label.', 'LABEL_OVERRIDE_SELF_APPROVAL')
    Object.assign(row, { state: 'approved', approvedBy: user, approvedAt: now })
    const line = state.worklist.find((r) => r.system === row.system && r.code === row.code)
    if (line) line.current = { en: row.en ?? line.current?.en ?? null, ar: row.ar ?? line.current?.ar ?? null }
    state.worklist = state.worklist.filter((r) => !r.current?.ar)
    return envelope(wireOverride(row))
  }
  return null
}
