// Drift items and their badges (BackOffice spec 3271, door 3293; oms ticket 703). As built (oms 711): a drift row's `payer`, `signal`,
// `subject`, `trailingRate`, `baselineRate`, `sampleSource`, `sampleId`, and `GET InsuranceRules/Drift/Badges`.
//
// `createDriftStubs(opts)` wraps 702's `createReviewItemStubs`; a clear of a drift item takes its badges with it, as the
// door would stop sending them.
import { envelope } from './insurance-rules-stubs.mjs'
import { createReviewItemStubs } from './fhir-rules-stubs-702.mjs'

const wireItem = (o) => ({
  kind: 'drift', at: '2026-10-27T09:00:00', store: '', pharmacist: '', ruleId: null, item: null, patient: null, reason: null, note: null, exceptionId: null, mark: null, ...o,
})

export const SAMPLE_URL = 'http://payer.example/fhir/ext?a=1&b=2'

export const DRIFT_ITEMS = [
  wireItem({ id: 'D-1', at: '2026-10-27T09:30:00', payer: 'bupa', signal: 'new-profile-version', subject: 'ksa-claim-response|2.1.0', sampleSource: 'bupa', sampleId: 'CR-301' }),
  wireItem({ id: 'D-2', at: '2026-10-27T09:20:00', payer: 'nphies', signal: 'never-seen-url', subject: SAMPLE_URL, sampleSource: 'nphies', sampleId: 'CR-302' }),
  wireItem({ id: 'D-3', at: '2026-10-27T09:10:00', payer: 'waseel', signal: 'answer-rate', subject: 'line.claimResponse.copay', trailingRate: 0.125, baselineRate: 0.48, sampleSource: 'waseel', sampleId: 'CR-303' }),
  wireItem({ id: 'D-4', at: '2026-10-27T09:05:00', payer: 'waseel', signal: 'unparsed-rate', subject: 'claim.total', trailingRate: 0.2, baselineRate: 0.05, sampleSource: 'waseel', sampleId: 'CR-304' }),
  wireItem({ id: 'D-5', at: '2026-10-27T09:01:00', payer: 'nphies', signal: 'somethingNew' }),
]

/** D-3 affects a line field, a guard, a coverage rule and a category rule from the stub rows; the rest affect nothing the drive looks at. */
export const DRIFT_BADGES = [
  { itemId: 'D-3', payer: 'waseel', signal: 'answer-rate', fields: ['$line.claimResponse.copay'], rules: ['G-001', 'C-002', 'K-002'] },
  { itemId: 'D-1', payer: 'bupa', signal: 'new-profile-version', fields: ['$claim.total'], rules: [] },
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
