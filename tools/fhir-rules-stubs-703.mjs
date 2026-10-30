// Drift items and their badges (BackOffice spec 3271, door 3293; oms ticket 703). 🚩 Every shape is guessed: a drift row's
// `payer`, `signal`, `sample`, and `GET InsuranceRules/Drift/Badges`. 711 reconciles.
//
// `createDriftStubs(opts)` wraps 702's `createReviewItemStubs`; a clear of a drift item takes its badges with it, as the
// door would stop sending them.
import { envelope } from './insurance-rules-stubs.mjs'
import { createReviewItemStubs } from './fhir-rules-stubs-702.mjs'

const wireItem = (o) => ({
  kind: 'drift', at: '2026-10-27T09:00:00', store: '', pharmacist: '', ruleId: null, item: null, patient: null, reason: null, note: null, exceptionId: null, mark: null, cleared: null, ...o,
})

export const SAMPLE_URL = 'http://payer.example/fhir/ext?a=1&b=2'

export const DRIFT_ITEMS = [
  wireItem({ id: 'D-1', at: '2026-10-27T09:30:00', payer: 'bupa', signal: { type: 'newProfile', profile: 'ksa-claim-response|2.1.0' }, sample: { source: 'bupa', id: 'CR-301' } }),
  wireItem({ id: 'D-2', at: '2026-10-27T09:20:00', payer: 'nphies', signal: { type: 'newUrl', url: SAMPLE_URL }, sample: { source: 'nphies', id: 'CR-302' } }),
  wireItem({ id: 'D-3', at: '2026-10-27T09:10:00', payer: 'waseel', signal: { type: 'rateFell', measure: 'answer', field: '$line.claimResponse.copay', rate: 0.125, baseline: 0.48 }, sample: { source: 'waseel', id: 'CR-303' } }),
  wireItem({ id: 'D-4', at: '2026-10-27T09:05:00', payer: 'waseel', signal: { type: 'rateFell', measure: 'unparsed', field: '$claim.total', rate: 0.2, baseline: 0.05 }, sample: { source: 'waseel', id: 'CR-304' } }),
  wireItem({ id: 'D-5', at: '2026-10-27T09:01:00', payer: 'nphies', signal: { type: 'somethingNew' }, sample: null }),
]

/** D-3 affects a line field and a guard from the stub rows; the rest affect nothing the drive looks at. */
export const DRIFT_BADGES = [
  { itemId: 'D-3', payer: 'waseel', signal: 'rateFell', fields: ['$line.claimResponse.copay'], rules: ['G-001'] },
  { itemId: 'D-1', payer: 'bupa', signal: 'newProfile', fields: ['$claim.total'], rules: [] },
]

/** `(method, path, body, params) → route.fulfill arg | null`. `opts` as `createReviewItemStubs`, and `deny: ['badges']`. */
export function createDriftStubs(opts = {}) {
  const review = createReviewItemStubs(DRIFT_ITEMS, opts)
  let badges = structuredClone(DRIFT_BADGES)
  return function driftStub(method, path, body, params) {
    if (method === 'GET' && path === 'InsuranceRules/Drift/Badges') {
      if (opts.deny?.includes('badges')) return { status: 403, contentType: 'application/json', body: '' }
      return envelope(badges)
    }
    const answered = review(method, path, body, params)
    const cleared = /^InsuranceRules\/Review\/([^/]+)\/Clear$/.exec(path)
    if (cleared && answered?.status === 200) badges = badges.filter((b) => b.itemId !== decodeURIComponent(cleared[1]))
    return answered
  }
}
