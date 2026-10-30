// Review item kinds on the Review list (BackOffice spec 3271, door 3290; oms ticket 702). 🚩 Every shape is guessed:
// `text`, `message`, `failure` and `cleared` on a row, and `POST InsuranceRules/Review/{id}/Clear { note }`. 711 reconciles.
//
// `createReviewItemStubs(items, opts)` wraps `createReviewStubs` (the decisions, as they were) and merges `items`, wire
// rows of any kind, into the list newest first. 703 and 708 pass their own rows in the same way.
import { createReviewStubs, envelope } from './insurance-rules-stubs.mjs'

const wireItem = (o) => ({
  at: '2026-10-27T09:00:00', store: '', pharmacist: '', ruleId: null, item: null, patient: null, reason: null, note: null, exceptionId: null, mark: null, cleared: null, ...o,
})

/** One of each kind this ticket reads, and one the client has never heard of. */
export const REVIEW_ITEMS_702 = [
  wireItem({ id: 'M-1', kind: 'monitor', at: '2026-10-27T09:30:00', ruleId: 'MON-04', severity: 'action', text: { en: 'Pre-auth denied after an approval', ar: 'رُفض الإذن المسبق بعد الموافقة' }, message: { source: 'nphies', id: 'CR-778' } }),
  wireItem({ id: 'M-2', kind: 'monitor', at: '2026-10-27T08:45:00', ruleId: 'MON-07', severity: 'info', text: { en: 'Approved quantity was reduced', ar: '' }, message: { source: 'bupa', id: 'CR-112' } }),
  wireItem({ id: 'N-1', kind: 'notEvaluated', at: '2026-10-27T08:00:00', failure: 'watcher', message: { source: 'nphies', id: 'CR-901' } }),
  wireItem({ id: 'N-2', kind: 'notEvaluated', at: '2026-10-27T07:30:00', ruleId: 'MON-04', failure: 'monitor', message: { source: 'nphies', id: 'CR-902' } }),
  wireItem({ id: 'U-1', kind: 'somethingNew', at: '2026-10-27T07:00:00', text: { en: 'A kind from a newer server', ar: '' }, message: { source: 'nphies', id: 'CR-950' } }),
]

/**
 * `(method, path, body, params) → route.fulfill arg | null`. Same `opts` as `createReviewStubs`; `opts.writes` also
 * collects the clears, and `opts.refuse.clear` refuses one. A clear with no note is the door's 400.
 */
export function createReviewItemStubs(items = REVIEW_ITEMS_702, opts = {}) {
  const { writes = [], refuse = {} } = opts
  const rows = structuredClone(items)
  const decisions = createReviewStubs({ ...opts, writes, refuse })
  return function reviewItemStub(method, path, body, params = new URLSearchParams()) {
    if (method === 'GET' && path === 'InsuranceRules/Review') {
      const answered = decisions(method, path, body, params)
      if (answered.status !== 200) return answered
      const f = (k) => params.get(k) ?? ''
      const mine = rows.filter(
        (r) => (!f('kind') || r.kind === f('kind')) && (!f('pharmacist') || r.pharmacist === f('pharmacist')) && (!f('store') || r.store === f('store')) && (!f('rule') || r.ruleId === f('rule')) && (!f('reason') || r.reason === f('reason')),
      )
      const merged = [...JSON.parse(answered.body).data, ...mine].sort((a, b) => b.at.localeCompare(a.at))
      return envelope(merged)
    }
    const m = /^InsuranceRules\/Review\/([^/]+)\/Clear$/.exec(path)
    if (method === 'POST' && m) {
      writes.push({ method, path, body })
      if (refuse.clear) return envelope(null, { status: refuse.clear.status ?? 409, success: false, message: refuse.clear.message, errorCode: refuse.clear.errorCode })
      if (!body?.note?.trim()) return envelope(null, { status: 400, success: false, message: 'A note is required.', errorCode: 'REVIEW_NOTE_REQUIRED' })
      const row = rows.find((r) => r.id === decodeURIComponent(m[1]))
      if (!row) return envelope(null, { status: 404, success: false, message: 'No such review item.', errorCode: 'NOT_FOUND' })
      row.cleared = { note: body.note, by: 'msartawi', at: '2026-10-27T10:05:00' }
      return envelope(row.cleared)
    }
    return decisions(method, path, body, params)
  }
}
