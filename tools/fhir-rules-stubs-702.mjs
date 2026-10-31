// Review item kinds on the Review list (BackOffice spec 3271, door 3290; oms ticket 702), as built (oms 711):
// `en`, `ar`, `messageSource`, `messageId`, `error` on a row; `mark` carries a mark or a drift item's clearing. Only drift clears;
// `POST InsuranceRules/Review/{id}` marks the other kinds the door lists, and refuses a drift item.
//
// `createReviewItemStubs(items, opts)` wraps `createReviewStubs` (the decisions, as they were) and merges `items`, wire
// rows of any kind, into the list newest first. 703 and 708 pass their own rows in the same way.
import { createReviewStubs, envelope } from './insurance-rules-stubs.mjs'

const wireItem = (o) => ({
  at: '2026-10-27T09:00:00', store: '', pharmacist: '', ruleId: null, item: null, patient: null, reason: null, note: null, exceptionId: null, mark: null, ...o,
})

/** One of each kind this ticket reads, and one the client has never heard of. */
export const REVIEW_ITEMS_702 = [
  wireItem({ id: 'M-1', kind: 'monitor', at: '2026-10-27T09:30:00', ruleId: 'MON-04', severity: 'action', en: 'Pre-auth denied after an approval', ar: 'رُفض الإذن المسبق بعد الموافقة', messageSource: 'nphies', messageId: 'CR-778' }),
  wireItem({ id: 'M-2', kind: 'monitor', at: '2026-10-27T08:45:00', ruleId: 'MON-07', severity: 'info', en: 'Approved quantity was reduced', ar: '', messageSource: 'bupa', messageId: 'CR-112' }),
  wireItem({ id: 'N-1', kind: 'not-evaluated', at: '2026-10-27T08:00:00', error: 'The watcher gave up after 3 attempts.', messageSource: 'nphies', messageId: 'CR-901' }),
  wireItem({ id: 'N-2', kind: 'not-evaluated', at: '2026-10-27T07:30:00', messageSource: 'nphies', messageId: 'CR-902' }),
  wireItem({ id: 'U-1', kind: 'somethingNew', at: '2026-10-27T07:00:00', en: 'A kind from a newer server', ar: '', messageSource: 'nphies', messageId: 'CR-950' }),
]

/**
 * `(method, path, body, params) → route.fulfill arg | null`. Same `opts` as `createReviewStubs`; `opts.writes` also
 * collects the clears and item marks; `opts.refuse.clear` and `opts.refuse.mark` refuse one. A clear with no note is the door's 400.
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
      const row = rows.find((r) => r.id === decodeURIComponent(m[1]) && r.kind === 'drift')
      if (!row) return envelope(null, { status: 404, success: false, message: 'No open drift item.', errorCode: 'NOT_FOUND' })
      row.mark = { mark: 'cleared', note: body.note, by: 'msartawi', at: '2026-10-27T10:05:00' }
      return envelope(row)
    }
    const marked = /^InsuranceRules\/Review\/([^/]+)$/.exec(path)
    const item = marked && rows.find((r) => r.id === decodeURIComponent(marked[1]))
    if (method === 'POST' && item) {
      writes.push({ method, path, body })
      if (refuse.mark) return envelope(null, { status: refuse.mark.status ?? 409, success: false, message: refuse.mark.message, errorCode: refuse.mark.errorCode })
      if (item.kind === 'drift' || !['monitor', 'not-evaluated', 'upload-due', 'ig-package'].includes(item.kind))
        return envelope(null, { status: 404, success: false, message: 'A drift item is cleared, through its Clear door.', errorCode: 'NOT_FOUND' })
      item.mark = { mark: body.mark, note: body.note, by: 'msartawi', at: '2026-10-27T10:05:00' }
      return envelope(item.mark)
    }
    return decisions(method, path, body, params)
  }
}
