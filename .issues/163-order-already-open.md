---
status: open
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

- [ ] `anExistingOrderIsOfferedNotInherited` — drive: `open` answering `refusedExisting` renders the
      previous caller's name, line count and opened-at, and **no basket is rendered** until the agent
      chooses · flow (Playwright, extends `tools/callcenter-drive.mjs`)
- [ ] `resumeAndStartFreshBothLandOnAnOrder` — drive: *Resume* reads that order's state and renders
      it; *Abandon and start fresh* abandons **then** opens, and the new order is empty · flow

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
