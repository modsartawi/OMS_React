/**
 * The live `Pricing/Simulate` payloads captured by ticket 098, as the fixture
 * corpus for this feature's pure tests (map 097's standing evidence rule; the
 * same ruling that gave the document feature its `078` corpus).
 *
 * They are imported from `.issues/assets/098-simulate-payloads/` rather than
 * hand-written: an earlier effort's synthetic condition data had to be thrown
 * away, and a hand-copied fixture is a rule tested against a hypothesis. Each
 * capture carries a `_capture` block recording the request and stating that a
 * Simulate exchange holds no customer-identifying field to redact.
 *
 * Test-only. Nothing in the app imports this module — the payloads live outside
 * `src/` and never reach the bundle.
 */
import type {
  SimulateRequest,
  SimulationResult,
  SimulationResultCondition,
} from '@/core/models/simulation'
import nearMissOwnerSupplied from '../../../../../.issues/assets/098-simulate-payloads/01-near-miss-owner-supplied.json'
import plainMultiline from '../../../../../.issues/assets/098-simulate-payloads/01-plain-multiline.json'
import firedBonusBuy from '../../../../../.issues/assets/098-simulate-payloads/02-fired-bonus-buy.json'
import firedBonusBuyOwnerSupplied from '../../../../../.issues/assets/098-simulate-payloads/02-fired-bonus-buy-owner-supplied.json'
import appliedAndPotential from '../../../../../.issues/assets/098-simulate-payloads/03-applied-and-potential-owner-supplied.json'
import nearMiss from '../../../../../.issues/assets/098-simulate-payloads/03-near-miss.json'
import noPrice from '../../../../../.issues/assets/098-simulate-payloads/04b-no-price.json'
import pricingElements from '../../../../../.issues/assets/098-simulate-payloads/05-pricing-elements.json'
import manualConditions from '../../../../../.issues/assets/098-simulate-payloads/06-manual-conditions.json'

/**
 * A capture file is `{ _capture, response }` — the tool's provenance block plus
 * the whole `HttpGeneralResponse` envelope. The simulation result is the
 * envelope's `data`.
 *
 * The cast goes through `unknown` deliberately — the same reason the document
 * corpus does it. `SimulationResultCondition` declares `conditionRateUnit` and
 * `pricingQuantityUnit` as strings while the wire emits `null` on some rows, and
 * that gap between the declared contract and live data is exactly what these
 * rules are written to survive, so the fixtures keep the payload verbatim.
 */
function payload(capture: { response: { data: unknown } }): SimulationResult {
  return capture.response.data as unknown as SimulationResult
}

/**
 * The nine captures that came back with a result, keyed by their scenario slug.
 * (`04a-unknown-material` and `06a-manual-header-rejected` are refusals — they
 * carry no `data`, so there is nothing for the aggregator to group.)
 */
export const PAYLOADS = {
  'near-miss-owner-supplied': payload(nearMissOwnerSupplied),
  'plain-multiline': payload(plainMultiline),
  'fired-bonus-buy': payload(firedBonusBuy),
  'fired-bonus-buy-owner-supplied': payload(firedBonusBuyOwnerSupplied),
  'applied-and-potential': payload(appliedAndPotential),
  'near-miss': payload(nearMiss),
  'no-price': payload(noPrice),
  'pricing-elements': payload(pricingElements),
  'manual-conditions': payload(manualConditions),
} as const

export type CapturedScenario = keyof typeof PAYLOADS

/** The corpus in capture order — 01 through 06. */
export const SCENARIOS = Object.keys(PAYLOADS) as CapturedScenario[]

/**
 * The **request** halves of the captures that recorded one (ticket 114 needs
 * them: the staleness predicate compares two requests, so its evidence is the
 * request side of the corpus rather than the response side).
 *
 * Two of the eleven captures were owner-supplied without their request and carry
 * a reconstruction note instead of a `header` — they are absent here rather than
 * reconstructed, which is the same rule the response side follows.
 */
function requestOf(capture: { _capture: { request: unknown } }): SimulateRequest {
  return capture._capture.request as unknown as SimulateRequest
}

export const REQUESTS = {
  'near-miss-owner-supplied': requestOf(nearMissOwnerSupplied),
  'plain-multiline': requestOf(plainMultiline),
  'fired-bonus-buy': requestOf(firedBonusBuy),
  'near-miss': requestOf(nearMiss),
  'no-price': requestOf(noPrice),
  'pricing-elements': requestOf(pricingElements),
  'manual-conditions': requestOf(manualConditions),
} as const

export type CapturedRequest = keyof typeof REQUESTS

/** The captured requests in capture order — 01 through 06. */
export const REQUEST_SCENARIOS = Object.keys(REQUESTS) as CapturedRequest[]

/** Every raw condition row in the corpus, line by line, in wire order. */
export function conditionsOf(scenario: CapturedScenario, itemIndex: number): SimulationResultCondition[] {
  return PAYLOADS[scenario].items[itemIndex].conditions
}
