/**
 * The frozen-contract fixtures of ticket 136, as this feature's test corpus.
 *
 * They are imported from `.issues/assets/136-cc-contract/` rather than
 * hand-written here — the pattern ticket 098 set for the simulation payloads,
 * for the same reason: a hand-copied fixture is a rule tested against a
 * hypothesis. Test-only; nothing in the app imports this module, so the payloads
 * never reach the bundle.
 *
 * 🚩 **Provisional by construction.** Unlike 098's, these are hand-authored
 * against a server that does not exist yet (`CallCenterWeb/*` is BackOffice
 * 801/804). CONTRACT.md §11 states the standing rule and this module restates
 * it because it is the one that gets forgotten: **no test may treat a fixture
 * VALUE as evidence of engine behaviour — only its SHAPE.** They die at the
 * backend's `CcContractFixtureTests` and are replaced by captures at first
 * integration, as one event.
 *
 * Slice 0 (ticket 162) needs one scenario: the empty basket every other fixture
 * starts from. The remaining eight land with the tickets that render them.
 */
import type { OpenResult, SessionState } from '@/core/models/callcenter'
import openEmpty from '../../../../../.issues/assets/136-cc-contract/01-open-empty.json'

/**
 * A fixture file is `{ _contract, request, response }` — the provenance block
 * plus the whole `HttpGeneralResponse`. `request()` already unwraps `.data` for
 * real calls, so a fixture's payload is its `response.data`.
 *
 * The cast goes through `unknown`: the JSON is the wire verbatim, and the point
 * of a fixture is to be the wire rather than to be what the types wish it were.
 */
function payload<T>(fixture: { response: { data: unknown } }): T {
  return fixture.response.data as unknown as T
}

/** `POST CallCenterWeb/Open` on a clean agent — `outcome: 'opened'`. */
export const OPEN_EMPTY: OpenResult = payload<OpenResult>(openEmpty)

/** The empty `SessionState` that open returns — slice 0's whole render input. */
export const EMPTY_SESSION: SessionState = OPEN_EMPTY.state!
