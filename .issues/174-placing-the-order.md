---
status: open
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

- [ ] `bothSubmittedOutcomesAreTheSameNews` — pure: `submitted` and `alreadySubmitted` produce the
      same rendered outcome carrying the same order number; refused and unavailable are distinct from
      both and from each other, and unavailable is marked retryable with the order still open · pure
- [ ] `placingAnOrderWaitsForItsNumber` — drive: the button becomes *Placing the order…*, the receipt
      holds with no confirmation until a `documentNo` arrives, and a repeated submit shows the same
      number rather than a second order · flow (Playwright, extends `tools/callcenter-drive.mjs`,
      over fixture `07`)
- [ ] `aRefusedSubmitKeepsTheOrder` — drive: `SUBMIT_REFUSED` names the field and the basket survives;
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
