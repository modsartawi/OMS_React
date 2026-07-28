/**
 * The contract fixtures of ticket 136, as this feature's test corpus.
 *
 * They are imported from `.issues/assets/136-cc-contract/` rather than
 * hand-written here — the pattern ticket 098 set for the simulation payloads,
 * for the same reason: a hand-copied fixture is a rule tested against a
 * hypothesis. Test-only; nothing in the app imports this module, so the payloads
 * never reach the bundle.
 *
 * 🚩 **They are CAPTURES now** (857, contract v1.2, 2026-07-28). The nine files
 * were driven live against the real `CallCenterWeb/*` handlers, the real engine
 * and ASP.NET Core's own result execution, so their bytes are the wire's.
 * `_contract.provisional` is gone; `_capture` is in its place. Two consequences
 * this module exists to hold:
 *
 * 1. **The shape moved.** An exchange is now
 *    `{ request: {method,path,body}, response: {statusCode, body} }` where `body`
 *    is the envelope — so a payload is `response.body.data`, one level deeper
 *    than before. The step keys were renamed with it (`step1_ask` → `ask`,
 *    `step1_preview` → `preview`, `commit` → `refusal`, `outcome_submitted` →
 *    `submitted`).
 * 2. **Three legs the server cannot currently reach** were captured as it really
 *    answers rather than as the contract promises — 859, 858 and 860. Two of
 *    them are legs the console is BUILT on, so this module holds the v1.0
 *    provisional payload for those and only those, in the
 *    [`§ unreachable`](#unreachable) block below, each naming its issue. That
 *    block is the honest cost of shipping ahead of the server; it is not a
 *    licence to hand-author anything else.
 *
 * The standing rule is unchanged and is the one that gets forgotten: **no test
 * may treat a fixture VALUE as evidence of engine behaviour — only its SHAPE.**
 * That rule is what lets the capture's values differ wildly from the v1.0
 * illustrations (a real `documentType` of `CallCenterOrder`, real Arabic
 * descriptions, `atpAtScan.known: false` throughout) without a single case
 * needing to move.
 */
import type { GeneralErrorResponse } from '@/core/api'
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
import unreachable from './unreachable-v1_0.json'

/**
 * One captured exchange: the request that was sent and the whole response that
 * came back, envelope included. `request()` unwraps `.data` for real calls, so a
 * fixture's payload is its `response.body.data`.
 *
 * The cast goes through `unknown`: the JSON is the wire verbatim, and the point
 * of a capture is to be the wire rather than to be what the types wish it were.
 */
function payload<T>(exchange: { response: { body: { data: unknown } } }): T {
  return exchange.response.body.data as unknown as T
}

/** The envelope of a captured refusal — `data`, `message` and `errors[]` as
 *  `core/api.ts` reads them off a non-2xx. */
function envelope(exchange: { response: { body: unknown } }): {
  data: unknown
  errors: GeneralErrorResponse[] | null
} {
  return exchange.response.body as { data: unknown; errors: GeneralErrorResponse[] | null }
}

/** `POST CallCenterWeb/Open` on a clean agent — `outcome: 'opened'`. */
export const OPEN_EMPTY: OpenResult = payload<OpenResult>(openEmpty)

/**
 * The empty `SessionState` that open returns — slice 0's whole render input.
 *
 * 🚩 The capture is what ticket 175 is about: `customer: null` and
 * `canAddItem: true` on the same projection, with `plantSource: 'operatorOverride'`
 * on a plant nobody overrode. Cases here assert what the console DOES with that,
 * not that it is right.
 */
export const EMPTY_SESSION: SessionState = OPEN_EMPTY.state!

/**
 * A settled order: a caller attached, two priced lines, a fired promotion.
 * Ticket 165 reads it for the SHAPE of an attached customer — never for the
 * values, which are now a real store's rather than the contract author's.
 *
 * 🚩 The capture carries `address: null`: the capture environment reached the
 * loyalty attach but not the address book, so this is an attached caller with no
 * address, which is a real console state (135 drew it) rather than a defect.
 * Anything needing an address states one itself.
 */
export const ATTACHED_SESSION: SessionState = payload<SessionState>(twoLinesPriced)

/**
 * The promotion surfaces as the engine really projects them (fixture 03 is a
 * `stateFragment`, not a whole response — "everything else is as 02").
 *
 * 🚩 **Every `offerId` is the empty string** — `BbyHeader.OfferId` is blank in
 * this master data, which is issue 859 and is exactly why the resolve leg 404s.
 * That makes this capture the corpus's best input for one question nothing else
 * asks: what a surface keyed on `offerId` does when the wire supplies none.
 * Class diversity is NOT here — see `NEAR_MISS_CLASSES`.
 */
export const NEAR_MISSES: NearMiss[] = (
  nearMissBuySide as unknown as { stateFragment: { nearMisses: NearMiss[] } }
).stateFragment.nearMisses

/**
 * §5.2's confirmation, as `addItem` really answers a quantity beyond
 * availability (ticket 169). The ask carries the **unchanged** state at 200, so
 * what this exports is the `pendingConfirmation` off it — the only part of that
 * payload the console reads.
 *
 * 🚩 The COMMIT half of this exchange is a no-op on the live server (858): the
 * ask's own claim advances the engine version past the ledger's reservation, so
 * the confirming retry resolves as an already-applied replay. The capture's
 * `confirmAttempt` records that. Nothing here asserts the commit works.
 */
export const BELOW_ATP_CONFIRM: PendingConfirmation =
  payload<{ pendingConfirmation: PendingConfirmation }>(belowAtp.ask).pendingConfirmation

/**
 * The **commit half** of fixture 04, as the live server really answers it: the
 * no-op 858 describes — `200`, `replayed: true`, and the basket still empty.
 *
 * 🚩 Exported rather than left inside the fixture because it is the only
 * evidence the console has of what a swallowed acceptance looks like on the
 * wire, and `confirm-action.test.ts` is built entirely on it. 🚩 Note what it
 * does NOT let a client do: it answers `hasBelowAtp: true` over **zero lines**
 * — the sidecar patch landed where the engine mutation did not — so the header
 * flag is no evidence the add applied.
 */
export const BELOW_ATP_COMMIT_ATTEMPT: SessionState = payload<SessionState>(belowAtp.confirmAttempt)

/**
 * §5's confirmation block, as `setStore` really answers it on a basket with
 * lines (ticket 167). The preview is the engine door run and not persisted, so
 * the state beside it is unchanged and the console keeps what is on screen.
 *
 * 🚩 `lineDiffs[].fromGross`/`toGross` are the ENGINE's gross — pre-discount and
 * ex-VAT — not the line's VAT-inclusive `lineTotal.gross` (857 divergence 2).
 * `promotionsMoved` is `[]` and will stay so while the engine's rebind diff is
 * per line rather than per offer. `atpReFreeze` carries nulls: no ATP map goes
 * into a rebind, so *availability not re-checked* is the true answer.
 * 🚩 The commit half is 858's no-op here too.
 */
export const REBIND_PREVIEW: PendingConfirmation =
  payload<{ pendingConfirmation: PendingConfirmation }>(rebindPreview.preview).pendingConfirmation

/** The **commit half** of fixture 05 — 858's no-op on the other two-phase verb:
 *  `replayed: true`, and `header.plant` still the plant the preview showed. 🚩 Its
 *  `version` has nonetheless moved (10 → 15), because `SaveAsync` blind-increments
 *  it (§2.1) — which is why no version comparison can stand in for *did it apply*. */
export const REBIND_COMMIT_ATTEMPT: SessionState = payload<SessionState>(rebindPreview.commitAttempt)

/** The state the preview was taken against — the `plant` a commit had to MOVE
 *  away from, and the one it is still sitting on above. */
export const REBIND_PREVIEW_STATE: SessionState = payload<SessionState>(rebindPreview.preview)

/**
 * The `REBIND_REFUSED` envelope's `data` — the atomic refusal's own
 * `unpriceableLines[]`, which `core/api.ts` carries onto the thrown `ApiError`.
 *
 * 🚩 The capture reaches this on the FIRST call with no preview before it: the
 * atomicity check fires on the preview too, so an unpriceable line is refused
 * before the agent is ever asked to accept a diff they could not commit. Both
 * sources are covered anyway (`store-move.ts` falls back to the preview),
 * because neither may be the only one the banner can name a line from.
 */
export const REBIND_REFUSAL_DATA: unknown = envelope(rebindRefused.refusal).data

/** §8.3's first success, as fixture 07 captures it — a real mint, a real
 *  `documentNo`, `state: null` beside it. */
export const SUBMIT_PLACED: SubmitResult = payload<SubmitResult>(submitOutcomes.submitted)

/**
 * What the submit retry REALLY gets today: `409 SESSION_CLOSED` with
 * `reason: "submitted"`, because the session's liveness gate refuses before the
 * once-only path runs (860).
 *
 * 🚩 This is the corpus's record of 860's harm rather than of the contract's
 * promise: no other response on this contract carries a `documentNo`, so an
 * agent whose first response was lost currently cannot recover the order number
 * they are about to read to the caller. It is exported so a case can assert what
 * the console says in that state — a thing that has to be true whether or not
 * 860 is ever fixed.
 */
export const SUBMIT_RETRY_REFUSED: { data: unknown; errors: GeneralErrorResponse[] | null } = envelope(
  submitOutcomes.retryRefused,
)

// ─────────────────────────────────────────────────────────────────────────────
// § unreachable
//
// Payloads the capture could NOT take, held at their v1.0 provisional values
// with the server issue that blocks them named. Everything above this line is
// the wire's own bytes; everything below is a HYPOTHESIS, in 098's exact sense,
// and goes back to being a capture the day its issue lands.
//
// The two the DRIVES also need — `NEAR_MISS_CLASSES` and `PREREQ_RESOLUTION` —
// live in `unreachable-v1_0.json` beside this file, named so nobody mistakes one
// for a capture and NOT in `.issues/assets/136-cc-contract/`, because a tenth
// hand-authored JSON beside nine captures is the pattern 857 just deleted.
// `tools/callcenter-guidance-drive.mjs` reads that same file, so those two cannot
// drift between the tests and the drive.
//
// `SUBMIT_REPLAYED` is NOT in it: it is a TypeScript literal below, because it is
// derived from the capture's own `documentNo` rather than authored, and because
// no drive reads it — `tools/callcenter-drive.mjs` gets its replay from the stub
// that minted the order, which is the only way to prove the two successes render
// identically.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * **Blocked by [859].** Three near-misses, one of each rendering class — a
 * shortfall, an `isReady` offer, and a `NOT_DISCOVERED` skip — which is what
 * tickets 171 and 172 were built and drawn against.
 *
 * The capture holds none of it: this store's master data yields two offers, both
 * unready, both with a blank `offerId`, and `NOT_DISCOVERED` cannot appear at
 * all until buy-side BBY discovery lands (855). So the classes have no live
 * source, and a corpus without them could not state the strip's central rule.
 *
 * 🚩 Values are illustrative, as always — including
 * `"SAR 10 off when you buy 3 — baby care"`, a currency word in server text
 * nobody may edit, which is why the region's rule is *no figure formatted as
 * money* rather than *no `SAR` anywhere*.
 *
 * [859]: `C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md`
 */
export const NEAR_MISS_CLASSES: NearMiss[] =
  unreachable.nearMissClasses.nearMisses as unknown as NearMiss[]

/**
 * **Blocked by [859].** What `ResolvePrereq` would answer for `BBY-5510` — the
 * ranked, ATP-filtered top of a 42-strong grouping, `truncated` with the
 * server's own `topN` beside it.
 *
 * The captured leg is a **404**: §3.3 addresses an offer by `offerId` and every
 * captured `offerId` is blank, so the click-through cannot reach its own
 * near-miss. Ticket 172's whole surface — the qualifying handful, the Arabic
 * meta line, the route to the rest of the set — has no other input.
 *
 * 🚩 Its third row carries `atp: null`, a degraded stock read on a 200 and never
 * a zero; and `description2` is the Arabic name 138 ruled onto the meta line.
 *
 * [859]: `C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md`
 */
export const PREREQ_RESOLUTION: PrereqResolution =
  unreachable.prereqResolution.data as unknown as PrereqResolution

/**
 * **Blocked by [860].** §8.3's second success — the replay that carries the same
 * `documentNo` as the first submit and which the client treats identically.
 *
 * The captured leg is a `409 SESSION_CLOSED` (`SUBMIT_RETRY_REFUSED` above), so
 * the promise ticket 174 asserts has no live source. The claim is kept rather
 * than dropped, because it is a claim about **the client**: `readSubmitResult`
 * must not let an `alreadySubmitted` reach any surface looking different from a
 * `submitted`, and that has to hold on the day 860 lands, not be written then.
 * The `documentNo` is deliberately the same string as the capture's — once-only
 * is keyed on the transaction id, so there is only ever one number to carry.
 *
 * [860]: `C:\Work\DMSCO\BackOffice\.issues\860-already-submitted-replay-unreachable.md`
 */
export const SUBMIT_REPLAYED: SubmitResult = {
  outcome: 'alreadySubmitted',
  documentNo: SUBMIT_PLACED.documentNo,
  state: null,
} as unknown as SubmitResult
