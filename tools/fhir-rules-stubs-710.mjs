// Stubs for oms 710 (BackOffice spec 3271, door 3298), on the real envelope. 🚩 Paths and shapes guessed; 711 reconciles.
//   GET InsuranceRules/Decisions/{id}          → the decision, its facts, the replay, the message's ref and hash
//   GET InsuranceRules/Decisions/{id}/Message  → the kept copy, else a re-fetch, checked against the hash
//   GET InsuranceRules/Guards/Backtests/Windows → { days }
// Synthetic bundles only.
import { envelope } from './insurance-rules-stubs.mjs'

export const SYNTHETIC_MARKER = 'SYNTHETIC-BUNDLE-710'
const HASH = '9f2c41aa07de5b13'
const BUNDLE = { resourceType: 'Bundle', id: SYNTHETIC_MARKER, type: 'collection', entry: [] }

const FACTS = [
  { key: 'claim.total', path: 'Claim.total.value', type: 'number', state: 'value', value: 0 },
  { key: 'claim.preAuth', path: 'Claim.insurance.preAuthRef.exists()', type: 'boolean', state: 'value', value: false },
  { key: 'patient.name', path: 'Patient.name.text', type: 'text', state: 'value', value: 'مريض تجريبي' },
  { key: 'coverage.class', path: 'Coverage.class.value', type: 'code', state: 'unknown', value: null },
  { key: 'claim.created', path: 'Claim.created', type: 'date', state: 'unparsed', value: null },
]

const decision = (id, over = {}) => ({
  id,
  at: '2026-01-05T09:30:00',
  store: 'P019',
  pharmacist: 'nalharbi',
  channel: 'oms',
  sourceRef: 'SO-4400123',
  patient: '1023456783',
  ruleId: 'G-007',
  ruleVersion: 4,
  outcome: 'refuse',
  facts: FACTS,
  replay: { outcome: 'refuse', matches: true },
  message: { ref: `ANS-${id}`, hash: HASH, kept: false },
  ...over,
})

const refetched = (check) => ({ source: 'refetched', check, hash: HASH, foundHash: check === 'match' ? HASH : '00aa77bb11cc22dd', message: BUNDLE })

/** Each id is one case an inspector can meet. */
export const DECISIONS = {
  'DEC-OLD': { view: decision('DEC-OLD'), message: { source: null, check: 'notFound', hash: HASH, foundHash: null, message: null } },
  'DEC-MATCH': { view: decision('DEC-MATCH'), message: refetched('match') },
  'DEC-DIFF': { view: decision('DEC-DIFF', { replay: { outcome: 'pass', matches: false } }), message: refetched('differs') },
  'DEC-KEPT': {
    view: decision('DEC-KEPT', { message: { ref: 'ANS-DEC-KEPT', hash: HASH, kept: true } }),
    message: { source: 'kept', check: 'match', hash: HASH, foundHash: HASH, message: BUNDLE },
  },
  'DEC-NOREPLAY': { view: decision('DEC-NOREPLAY', { replay: null, facts: [] }), message: { source: null, check: 'notFound', hash: HASH, foundHash: null, message: null } },
}

/** `opts.deny`: door names answered a bare 403 (`decision`, `message`); `opts.reads`: counts Message reads per id. */
export function inspectorStub(method, path, opts = {}) {
  if (method !== 'GET') return null
  const m = path.match(/^InsuranceRules\/Decisions\/([^/]+)(\/Message)?$/)
  if (!m) return null
  const id = decodeURIComponent(m[1])
  if (opts.deny?.includes(m[2] ? 'message' : 'decision')) return { status: 403, body: '' }
  const row = DECISIONS[id]
  if (!row) return envelope(null, { status: 404, success: false, message: 'No such decision.', errorCode: 'NOT_FOUND' })
  if (!m[2]) return envelope(row.view)
  if (opts.reads) opts.reads[id] = (opts.reads[id] ?? 0) + 1
  return envelope(row.message)
}

/** The door's limit: a number of days; `'deny'` a bare 403; `'fail'` a refusal. */
export function windowLimitStub(method, path, limit) {
  if (method !== 'GET' || path !== 'InsuranceRules/Guards/Backtests/Windows') return null
  if (limit === 'deny') return { status: 403, body: '' }
  if (limit === 'fail') return envelope(null, { status: 400, success: false, message: 'Settings are unreadable.' })
  return envelope({ days: [limit] })
}
