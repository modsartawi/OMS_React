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
import type {
  NearMiss,
  OpenResult,
  PendingConfirmation,
  PrereqResolution,
  SessionState,
  SubmitResult,
} from '@/core/models/callcenter'
import openEmpty from '../../../../../.issues/assets/136-cc-contract/01-open-empty.json'
import twoLinesPriced from '../../../../../.issues/assets/136-cc-contract/02-two-lines-priced.json'
import nearMissBuySide from '../../../../../.issues/assets/136-cc-contract/03-near-miss-buy-side.json'
import belowAtp from '../../../../../.issues/assets/136-cc-contract/04-below-atp-confirm.json'
import rebindPreview from '../../../../../.issues/assets/136-cc-contract/05-rebind-preview.json'
import rebindRefused from '../../../../../.issues/assets/136-cc-contract/06-rebind-refused.json'
import submitOutcomes from '../../../../../.issues/assets/136-cc-contract/07-submit-already-submitted.json'

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

/**
 * A settled order: a caller attached, an address picked, the plant derived from
 * it. Ticket 165 reads it for the SHAPE of an attached customer and of the
 * address the rail renders — never for the values, which are the contract
 * author's illustration and not the engine's.
 */
export const ATTACHED_SESSION: SessionState = payload<SessionState>(twoLinesPriced)

/**
 * The map's headline feature and its honest blind spot, as fixture 03 carries
 * them (ticket 171): one buy-side near-miss with a shortfall, one `isReady`
 * offer that is fully qualified and out-ranked, and one `NOT_DISCOVERED` skip —
 * 130's blocker made visible on the wire rather than silently omitted.
 *
 * 🚩 Fixture 03 is a **`stateFragment`**, not a whole response: it carries only
 * the promotion surfaces of `SessionState` ("everything else is as 02"). So this
 * export is the `nearMisses` array itself, which is exactly what the guidance
 * view model takes.
 *
 * 🚩 Shape only, as always. One of its descriptions is `"SAR 10 off when you buy
 * 3 — baby care"` — a currency word in **server text nobody may edit**, which is
 * precisely why the region's money rule is *no figure formatted as money* rather
 * than *no `SAR` anywhere*.
 */
export const NEAR_MISSES: NearMiss[] = (
  nearMissBuySide as unknown as { stateFragment: { nearMisses: NearMiss[] } }
).stateFragment.nearMisses

/**
 * The on-demand half of the same fixture (ticket 172): what `ResolvePrereq`
 * answers for `BBY-5510` — the ranked, ATP-filtered top of a 42-strong grouping,
 * with `truncated: true` and the server's own `topN` beside it.
 *
 * 🚩 Shape only, as always. Its third row carries `atp: null` — a **degraded
 * stock read on a 200**, never a zero — and its rows carry `description2`,
 * which is the Arabic name 138 ruled onto the meta line.
 */
export const PREREQ_RESOLUTION: PrereqResolution = payload<PrereqResolution>(nearMissBuySide.resolve)

/**
 * §5.2's OTHER confirmation, as `addItem` answers a quantity beyond availability
 * (ticket 169). Like the rebind preview, step 1 carries the **unchanged** state —
 * so what this exports is the `pendingConfirmation` off it, which is the only
 * part of that payload the console reads.
 *
 * 🚩 Shape only, as always: `requested: 5, available: 2` is the contract author's
 * illustration. Every case that turns on those figures sets them itself.
 */
export const BELOW_ATP_CONFIRM: PendingConfirmation =
  payload<{ pendingConfirmation: PendingConfirmation }>(belowAtp.step1_ask).pendingConfirmation

/**
 * §5's confirmation block, as `setAddress` answers it on a basket with lines
 * (ticket 167). Fixture 05's step 1 carries the **unchanged** state — the
 * preview is the engine door run and not persisted — so what this exports is the
 * `pendingConfirmation` off it, which is the only part of that payload the
 * console reads: the sheet draws the diff, and `applyState` rightly keeps the
 * state already on screen because the version did not move.
 */
export const REBIND_PREVIEW: PendingConfirmation =
  payload<{ pendingConfirmation: PendingConfirmation }>(rebindPreview.step1_preview).pendingConfirmation

/**
 * The `REBIND_REFUSED` envelope's `data` — the atomic refusal's own
 * `unpriceableLines[]`, which `core/api.ts` carries onto the thrown `ApiError`.
 *
 * 🚩 Fixture 06's own note says core DROPS `data`; that is out of date —
 * `ApiError` carries it (`src/core/api.ts`, the `data` constructor argument).
 * Both paths are covered anyway (`store-move.ts` falls back to the preview),
 * because the offending lines ride both by contract (§5.1) and neither source
 * may be the only one the banner can name a line from.
 */
export const REBIND_REFUSAL_DATA: unknown = rebindRefused.commit.response.data

/**
 * §8.3's two successes, as fixture 07 carries them (ticket 174) — the first
 * submit and the replay of it.
 *
 * 🚩 They are exported as a PAIR and read by one test that compares them to each
 * other. Separately they are two ordinary payloads; together they are the
 * ticket's headline rule — *both are the same news* — and a fixture that only
 * ever appeared one at a time could not state it.
 *
 * 🚩 Shape only, as always. The replay's `state` is `_elided` in the fixture
 * ("as at submit"), which is the contract author's shorthand and not a state a
 * server would send — so nothing may read it as a whole projection. What this
 * ticket reads off it is the ORDER NUMBER, which is the same one either way,
 * and that is the fixture's own claim rather than an illustration.
 */
export const SUBMIT_PLACED: SubmitResult = submitOutcomes.outcome_submitted
  .data as unknown as SubmitResult
export const SUBMIT_REPLAYED: SubmitResult = submitOutcomes.outcome_alreadySubmitted
  .data as unknown as SubmitResult
