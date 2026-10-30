// Stub of BackOffice door 3294's re-pin drafts for oms 705, on the real envelope. The door is unbuilt: paths, spellings
// and refusal codes are guessed, and 711 reconciles them. Never a live SIS.Api. An alias approved in 704's store puts a
// ruleset on the list; a path change is seeded.
import { envelope } from './insurance-rules-stubs.mjs'

export const WHOLE_KEY = '1023456701'
export const WHOLE_KEY_MASKED = '1*******01'
const PATH_ROW = {
  changeId: 'CH-PATH',
  kind: 'path',
  rulesetId: 'monitors',
  rulesetName: 'Monitors',
  rulesetVersion: 3,
  subject: 'copay.percent',
  before: "extension('old').value",
  after: "extension('old').value | extension('new').value",
  draftId: null,
}
const line = (bundleId, before, after, maskedKey = '2*******77') => ({ bundleId, on: '2026-10-12', payer: '0001100041', ruleId: 'R-7', maskedKey, before, after })

/** `noChange` makes every back-test find no change; `polls` is how many answers read as still running first. */
export function newRepinStore({ noChange = false, polls = 0 } = {}) {
  return { nextDraft: 1, drafts: [], done: [], writes: [], noChange, polls, pathRow: { ...PATH_ROW } }
}

const backtestOf = (store) => {
  if (store.polls > 0) {
    store.polls--
    return { status: 'running', error: null, bundles: 0, changedTotal: 0, changes: [] }
  }
  if (store.noChange) return { status: 'done', error: null, bundles: 120, changedTotal: 0, changes: [] }
  return {
    status: 'done',
    error: null,
    bundles: 120,
    changedTotal: 3,
    // One key arrives whole, as a slip on the wire: the screen must still mask it.
    changes: [line('B-1', 'PASS', 'REFUSE', WHOLE_KEY), line('B-2', 'PASS', 'REFUSE'), line('B-3', 'WARN', 'PASS')],
  }
}

function affected(store, aliases) {
  const rows = store.pathRow && !store.done.includes(store.pathRow.changeId) ? [store.pathRow] : []
  for (const a of aliases.rows) {
    if (a.state !== 'approved' || a.id === 'A-1' || store.done.includes(a.id)) continue
    const open = store.drafts.find((d) => d.changeId === a.id)
    rows.push({ changeId: a.id, kind: 'alias', rulesetId: 'guards', rulesetName: 'Guards', rulesetVersion: 7, subject: `${a.payer} · ${a.wrongUrl}`, before: null, after: a.canonicalUrl, draftId: open?.id ?? null })
  }
  return rows.map((r) => ({ ...r, draftId: store.drafts.find((d) => d.changeId === r.changeId && d.state === 'open')?.id ?? r.draftId }))
}

export function repinStub(method, path, body, { store, aliases, user, now = '2026-10-30T11:00:00', deny = [] }) {
  if (!path.startsWith('InsuranceRules/RepinDrafts')) return null
  if (deny.includes('*')) return { status: 403, body: '' }

  if (path === 'InsuranceRules/RepinDrafts/Affected' && method === 'GET') return envelope(affected(store, aliases))

  if (path === 'InsuranceRules/RepinDrafts' && method === 'POST') {
    store.writes.push({ path, body, user })
    const row = affected(store, aliases).find((r) => r.changeId === body.changeId && r.rulesetId === body.rulesetId)
    if (!row) return envelope(null, { status: 404, success: false, message: 'That ruleset is not on the old form.', errorCode: 'INSREPIN_NOT_FOUND' })
    const { draftId: _open, ...rest } = row
    const draft = { id: `D-${store.nextDraft++}`, ...rest, state: 'open', createdBy: user, createdAt: now, approvedBy: null, approvedAt: null, backtest: backtestOf(store) }
    store.drafts.push(draft)
    return envelope(draft)
  }

  const one = /^InsuranceRules\/RepinDrafts\/([^/]+)(\/Approve)?$/.exec(path)
  if (!one) return null
  const draft = store.drafts.find((d) => d.id === decodeURIComponent(one[1]))
  if (!draft) return envelope(null, { status: 404, success: false, message: 'No such draft.', errorCode: 'INSREPIN_NOT_FOUND' })
  if (method === 'GET' && !one[2]) {
    if (draft.backtest.status === 'running') draft.backtest = backtestOf(store)
    return envelope(draft)
  }
  if (method === 'POST' && one[2]) {
    store.writes.push({ path, body, user })
    if (draft.createdBy?.toLowerCase() === user.toLowerCase())
      return envelope(null, { status: 409, success: false, message: 'Someone other than the author must approve a re-pin draft.', errorCode: 'INSREPIN_SELF_APPROVAL' })
    Object.assign(draft, { state: 'approved', approvedBy: user, approvedAt: now })
    store.done.push(draft.changeId)
    return envelope(draft)
  }
  return null
}
