---
status: done
spec: 160
blocked-by: 162
---

# 163 — anOrderAlreadyOpenOffersResumeOrStartFresh

## What to build

One active order per agent, so `open` on an agent who already has one is **refused with the existing
order's identity — on the success path**. It is a choice, not a failure.

The console draws that choice full-screen with enough to make it: the previous caller's name, the
line count, when it was opened, and the fulfilment store. Two actions, both explicit:

- **Resume** — `getState` on that id, and the console is back where it was.
- **Abandon and start fresh** — `abandon`, then `open`, in that order.

🚩 **Never a silent auto-resume.** An agent who has just picked up a new caller must not inherit the
previous caller's basket ([127](127-engine-session-lifecycle.md)) — which is the same harm
[164](164-busy-collision-and-staleness.md) closes from the other side.

This is also **the reconnect story**: a refresh, a crash, a closed tab or a second device all arrive
here, so recovery is a path the agent already knows rather than a special case. Abandoning from
inside a live order is the same act and gets the same confirmation, naming what is being thrown away.

## Spine reach

api (`Abandon`, `State`) · logic (which outcome the open path is in) · component (the
already-open screen; abandon confirmation) · i18n · test (flow)

## Proof (→ `tdd` red-green cycles)

- [x] `anExistingOrderIsOfferedNotInherited` — drive: `open` answering `refusedExisting` renders the
      previous caller's name, line count and opened-at, and **no basket is rendered** until the agent
      chooses · flow (Playwright, extends `tools/callcenter-drive.mjs`)
- [x] `resumeAndStartFreshBothLandOnAnOrder` — drive: *Resume* reads that order's state and renders
      it; *Abandon and start fresh* abandons **then** opens, and the new order is empty · flow
- [x] `theOpenPathIsOneClosedSetOfFour` — `readOpenResult` maps the discriminant + the two nullable
      payloads to `opened` / `existing` / `pending` / `malformed`, including both malformed pairs and
      an unknown outcome; plus `abandonTarget*` and `openedAtLabel`'s day boundary · pure (added —
      the ticket's Spine reach names *"logic (which outcome the open path is in)"* and this is it)

## Boundaries

**Endpoints:** `POST CallCenterWeb/Abandon`, `GET CallCenterWeb/State`. `OpenResult.outcome =
'refusedExisting'` is a **success**, not an error code — a client that treats it as a failure shows a
crash surface for a routine choice. Abandon's coupon reversal is server-side and rides
`CollectReversalContexts()`; nothing here.

## Done when

An agent with an order already open is shown whose it is and chooses; neither path can be reached by
accident, and neither leaves them without an order.

## Blocked by

[162](162-console-opens-an-order.md) — there is no open path to refuse until the console opens one.

## Comments

**Built 2026-07-27.** Green: `typecheck` · `vitest` 350/350 (13 new in `open-outcome.test.ts`) ·
`lint` (boundaries, contrast, palette) · `build` · `tools/callcenter-drive.mjs` **76/76** against
the stubbed envelope (35 were 162's, 41 are this slice's).

Four decisions worth carrying forward:

1. **`open-outcome.ts` — the open path is read once, into a closed set of four.** `OpenResult` is a
   discriminated union in intent and a loose record on the wire: `outcome` names the branch, but
   `state` and `existing` are independently nullable, so `opened` with a null `state` type-checks.
   Left unread that pair is an agent stranded on "Opening…" — the exact harm this ticket exists to
   prevent, arriving through the door nobody watches. So there is a fourth outcome, `malformed`,
   with a named card. It is **not** 164's `contractVersion` hard stop and does not anticipate it.
2. **`requestId` became state.** 162 froze one id per console life. *Abandon and start fresh* is the
   one genuinely new open action there is: re-sending the first id would be replayed (§4) and answer
   `refusedExisting` all over again, about an order that no longer exists. A retry still reuses its
   id — the discipline is per ACTION, and the drive proves both halves off the wire log.
3. **One `AbandonConfirm`, two callers.** Abandoning from the choice screen and abandoning from
   inside a live order are the same act, so they share the dialog, the wording and the landing
   (`startFresh` — abandon, then open, in that order). The confirmation names the **line count**,
   never an amount: money is the engine's and the console never computes one (law 1).
4. **`SESSION_CLOSED` is deliberately NOT handled.** Abandoning an already-closed order currently
   surfaces as an ordinary dialog failure. That code, and the stale-tab return-to-start it triggers
   everywhere, is [164](164-busy-collision-and-staleness.md)'s whole subject; half of it here is the
   half that later has to be unpicked.

Three review findings fixed after the first green run:

- **The choice screen had no way home.** 134 §8 says every non-console state on this chrome-less
  route offers *Back to the portal* and *Sign out*; 162 got that for free from `ConsoleNotice`, and
  a hand-rolled second card silently dropped it. The fix is structural rather than a re-added pair
  of buttons: `ConsoleCard` now owns the card chrome AND the two exits, so a future state cannot be
  built without them. It also revived `tone`, which had gone dead.
- **A failed resume stranded the agent.** A `getState` error replaced the choice with its own card,
  taking *abandon and start fresh* — the action that would still get them an order — with it. The
  failure now lands **on** the choice screen and *Resume* is a retry of itself. Drive box 11b.
- **A resumed id outlived its order.** `transactionId` reads `resumedId ?? openedId`, and the effect
  that seeds a newly-opened order never cleared `resumedId` — so a later `Open` would mint a real
  OMS order and render the old one. Unreachable under today's query options, one line to close.

Two drive assertions were passing for the wrong reason and were replaced: *"backing out voids
nothing"* counted requests before the cancel could have reached the interceptor, and *"it is not the
one that was abandoned"* proved emptiness rather than identity. `ConsoleShell` now carries
`data-cc-transaction` so the second is a real claim.

Standing follow-up, unchanged from 162 and now larger: `CONTEXT.md` glosses neither the engine
`session` (as distinct from `sis_session`), nor `caller`, `basket`, or `plant` vs the glossary's
*store* — `ExistingOrder.plant` is the contract's word, not ours. `/domain-modeling`'s, not a
ticket's.
