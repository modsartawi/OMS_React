---
status: done
spec: 160
blocked-by: 170, 173
---

# 174 — placingTheOrderHasNoOptimismAndSurvivesARetry

## What to build

The last thirty seconds of the call, and the one moment the console is deliberately **not**
optimistic.

*Place order* is pinned to the foot of the receipt, where it has been all call. Pressing it takes
**only the transaction id** — no document, no lines, no amounts, no fee; the CLCN document is built
server-side from engine state, which is what makes the browser unable to influence what the caller
pays.

- 🚩 **No optimistic hand-off.** CC2's research recommends one; ruled **out** here. The button
  becomes *Placing the order…* and the receipt **holds** until an order number exists. An
  optimistically confirmed order that then refuses is a phone call the agent cannot take back.
- **Success gives an order number** the agent can read to the caller.
- 🚩 **Submitting twice is a success, not a duplicate.** `alreadySubmitted` carries the first order
  number and the console treats it **identically** to a first submit — once-only is keyed on the
  transaction id, and the server completes the local tail on that path too. Any client branch that
  makes the two look different is the defect.
- **A refusal names the field to fix and leaves the order open**, so a refusal is a correction rather
  than a lost basket.
- 🚩 **Temporarily unavailable must read as retryable**, never as "unexpected". It arrives as a 503
  *carrying the envelope*; the transaction stays open and retryable, and the console says so.

## Spine reach

api (`Submit`) · logic (the four outcomes: submitted / alreadySubmitted / refused / unavailable) ·
component (submitting state, order-number confirmation, refusal and retry surfaces) · i18n ·
test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [x] `bothSubmittedOutcomesAreTheSameNews` — pure: `submitted` and `alreadySubmitted` produce the
      same rendered outcome carrying the same order number; refused and unavailable are distinct from
      both and from each other, and unavailable is marked retryable with the order still open · pure
- [x] `placingAnOrderWaitsForItsNumber` — drive: the button becomes *Placing the order…*, the receipt
      holds with no confirmation until a `documentNo` arrives, and a repeated submit shows the same
      number rather than a second order · flow (Playwright, extends `tools/callcenter-drive.mjs`,
      over fixture `07`)
- [x] `aRefusedSubmitKeepsTheOrder` — drive: `SUBMIT_REFUSED` names the field and the basket survives;
      `SUBMIT_UNAVAILABLE` reads as retryable, and retrying with the same `requestId` does not mint a
      second order · flow

## Boundaries

**Endpoint:** `POST CallCenterWeb/Submit` (BackOffice
[786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md)). Codes: `SUBMIT_REFUSED`
(409, carries `field`), `SUBMIT_UNAVAILABLE` (**503 carrying the envelope** — 🚩 if the envelope is
missing, `core/api.ts` maps it to `kind:'server'` and the console says "unexpected" for a routine
retryable outcome; the drive asserts this, it is not a note). Fixture
`07-submit-already-submitted.json` joins `payloads.ts`. There is **no `unknown` submit state** — the
in-process ruling removed the gap that would produce one.

## Done when

An agent places the order, waits, and reads a real order number to the caller — and a retry, a
refusal or a transient outage each leave them with something to do and an order still worth having.

## Blocked by

[170](170-basket-corrects-itself.md) — there must be a priced basket to submit.
[173](173-header-complete-before-submit.md) — submit is offered only once the header is complete.

## As built

- **The two successes are the same news by CONSTRUCTION, not by promise.**
  `submit-outcome.ts`'s `readSubmitResult` returns `{ documentNo }` and nothing else — the outcome
  word and `replayed` do not survive it, so no surface downstream *can* tell a replay from a first
  submit. The pure test asserts the two results EQUAL to each other rather than asserting each
  separately, and the drive compares the rendered panel word for word across boxes 39 and 40b.
  `SubmitResult.state` deliberately does not ride along either: it goes to the cache through
  `applyState` like every other verb's, which is also what keeps the equality honest (fixture 07's
  replay carries an `_elided` state).
- 🚩 **`core/api.ts` had the defect the Boundaries predicted, on the other side.** The ticket
  guarded against a 503 arriving *without* the envelope; what was actually there was a
  `res.status >= 500` branch that ran **before** the envelope check, so an envelope-carrying 503 was
  mapped to `kind:'server'` regardless. Fixed generically — a refusal carrying `errors[0].errorCode`
  outranks its status, at any status; an uncoded 5xx still reads as a server fault exactly as
  before. The rule is stated in core's own vocabulary (a coded refusal is the server's considered
  answer), not as a call-center special case, and `src/core/api.test.ts` is new: four cases pinning
  coded-5xx, uncoded-5xx, no-envelope-5xx and the ordinary refusal statuses.
- **One press, one `requestId`, reused across every retry of that press** — including a retry after
  a failure this console could not classify, which is precisely the case where the submit may have
  landed. A press with no standing failure behind it mints a new id, so *fix the field and place it
  again* is a genuinely new action. The drive proves both directions from the recorded wire.
- 🚩 **A refusal stops being said the moment the order moves.** The press carries the `version` it
  was made against, and the failure is drawn only while the order is still that one. Without it the
  danger box outlived the correction that answered it — a console arguing with itself under a
  receipt the agent had just fixed.
- **Ruled while building.** There is **no client state for a success with no order number in it.**
  It was built, then removed at review: §7 says there is no unknown submit outcome and §8.3 carries
  `documentNo` on both successes, so such a state is that outcome under another name — and it could
  only be paid for by pressing a verb the door had just said no to (`canSubmit: false` on a
  submitted order). `capabilities` decides, with no client-side predicate beside it. Reading
  `canSubmit` also moved from `ConsoleShell` up to the page, joining every other capability-gated
  control.
- **The retryable outage owns the button rather than adding a second one** (164's ruling): *Place
  order* becomes *Try again* and re-sends the same action. A refusal does not — pressing again
  unchanged would be refused again, so it names the section to fix instead.
- **Fixture `07-submit-already-submitted.json` joined `payloads.ts`** as a PAIR, since separately
  the two payloads are ordinary and only together do they state the rule.

**Proof run:** 11 pure (`submit-outcome.test.ts`, with the locale file asserted against) + 4 pure
(`core/api.test.ts`, new) + `tools/callcenter-drive.mjs` **445/445** (boxes 39, 40, 40b),
`callcenter-guidance-drive` 103/103, `npm test` 515, typecheck, lint and build green.

⚠ **Contract gap for BackOffice 786:** `SUBMIT_UNAVAILABLE` must carry the envelope on its 503 —
now asserted from both sides (the core unit test and drive box 40b), and still owed as a
`CcContractFixtureTests` conformance assertion server-side.
