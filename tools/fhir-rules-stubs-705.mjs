// Stub of BackOffice door 3294's re-pin drafts for oms 705, on the real envelope, as built (oms 711). `Repin/Affected` groups a
// ruleset's changes; a draft's back-test is counts per field and payer, with no per-bundle list. Never a live SIS.Api. An alias
// approved in 704's store puts a ruleset on the list; a path change is seeded.
import { envelope } from './insurance-rules-stubs.mjs'

const PATH_ROW = {
  changeId: 'percent',
  rulesetId: 'monitors',
  rulesetVersion: 3,
  change: { scope: 'copay', key: 'percent', oldPath: "extension('old').value", newPath: "extension('old').value | extension('new').value" },
}

/** `noChange` makes every back-test find no change. */
export function newRepinStore({ noChange = false } = {}) {
  return { nextDraft: 1, drafts: [], done: [], writes: [], noChange, pathRow: { ...PATH_ROW } }
}

const backtestOf = (store) => [
  { field: 'copay.percent', rows: [{ source: 'nphies', payer: '0001100041', same: store.noChange ? 120 : 117, gained: store.noChange ? 0 : 2, lost: 0, changed: store.noChange ? 0 : 1 }] },
]

function changed(store, aliases) {
  const rows = store.pathRow && !store.done.includes(store.pathRow.changeId) ? [store.pathRow] : []
  for (const a of aliases.rows) {
    if (a.state !== 'approved' || a.id === 'A-1' || store.done.includes(a.id)) continue
    rows.push({ changeId: a.id, rulesetId: 'guards', rulesetVersion: 7, change: { scope: 'eligibility', key: a.id, oldPath: '', newPath: '', aliasesAdded: [{ payer: a.payer, wrongUrl: a.wrongUrl, canonicalUrl: a.canonicalUrl }], aliasesRemoved: [] } })
  }
  return rows
}

const openDraft = (store, kind) => store.drafts.find((d) => d.kind === kind && d.state === 'pending')?.id ?? null

function affected(store, aliases) {
  const rows = changed(store, aliases)
  return [...new Set(rows.map((r) => r.rulesetId))].map((kind) => {
    const mine = rows.filter((r) => r.rulesetId === kind)
    return { kind, versionNo: mine[0].rulesetVersion, pendingDraftId: openDraft(store, kind), changes: mine.map((r) => r.change) }
  })
}

export function repinStub(method, path, body, { store, aliases, user, now = '2026-10-30T11:00:00', deny = [] }) {
  if (!path.startsWith('InsuranceRules/Repin') || path.startsWith('InsuranceRules/Repin/Labels')) return null
  if (deny.includes('*')) return { status: 403, body: '' }

  if (path === 'InsuranceRules/Repin/Affected' && method === 'GET') return envelope(affected(store, aliases))
  if (path === 'InsuranceRules/Repin/Drafts' && method === 'GET') return envelope(store.drafts.filter((d) => d.state === 'pending'))

  if (path === 'InsuranceRules/Repin/Drafts' && method === 'POST') {
    store.writes.push({ path, body, user })
    const rows = changed(store, aliases).filter((r) => r.rulesetId === body.kind && body.keys.includes(r.changeId))
    if (rows.length === 0) return envelope(null, { status: 404, success: false, message: 'That ruleset is not on the old form.', errorCode: 'INSREPIN_NOT_FOUND' })
    const draft = {
      id: `D-${store.nextDraft++}`,
      kind: body.kind,
      baseVersionNo: rows[0].rulesetVersion,
      state: 'pending',
      requestedBy: user,
      requestedAt: now,
      decidedBy: '',
      decidedAt: '0001-01-01T00:00:00',
      labelsOnly: false,
      changes: rows.map((r) => r.change),
      keys: body.keys,
      backtest: backtestOf(store),
    }
    store.drafts.push(draft)
    return envelope(draft)
  }

  const one = /^InsuranceRules\/Repin\/Drafts\/([^/]+)\/Approve$/.exec(path)
  if (!one || method !== 'POST') return null
  const draft = store.drafts.find((d) => d.id === decodeURIComponent(one[1]))
  if (!draft) return envelope(null, { status: 404, success: false, message: 'No such draft.', errorCode: 'INSREPIN_NOT_FOUND' })
  store.writes.push({ path, body, user })
  if (draft.requestedBy?.toLowerCase() === user.toLowerCase())
    return envelope(null, { status: 409, success: false, message: 'Someone other than the author must approve a re-pin draft.', errorCode: 'INSREPIN_SELF_APPROVAL' })
  Object.assign(draft, { state: 'approved', decidedBy: user, decidedAt: now })
  store.done.push(...draft.keys)
  return envelope({ versionNo: draft.baseVersionNo + 1 })
}
