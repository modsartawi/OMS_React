---
status: done
spec: 209
blocked-by: 210, 213
---

# 217 — An agent builds a request in a live engine session, and a duplicate item is refused as it is added

## What to build

**The core of the effort.** The authorization form is a **session, not a form** — the browser drives
a real engine transaction the way the till does, so that the audit trail can show *what the engine
landed versus what the agent changed*. A payload assembled client-side and posted at the end cannot
show that: it only ever carries the survivors, and "added then voided" is exactly what the trail
exists to record.

The form opens off the seam [213](213-two-coverages-force-a-pick.md) built, addressed by eligibility
id and member id, and fetches that eligibility by id. The patient, payer, policy and provider render
as **read-only values, not disabled controls** — a disabled combo holding nothing is the trap this
port exists to remove, and the provider is inherited rather than re-picked so the check and the
authorization can never disagree about who is asking.

The session:

| Agent act | Verb | Recorded |
|---|---|---|
| form opens | open (shift-less) | transaction OPEN |
| add item | add | engine line |
| change qty | change qty | engine line |
| void a line | void | **voided line, kept** |
| leave | abandon | transaction VOIDED |

Plus a read for the whole state. **Every verb returns the complete state** and the client renders
the latest — no reducer, no delta protocol — through the guard
[210](210-core-owns-the-latest-state-guard.md) moved to `core/`.

Items land on an **inline add-row** above the grid: a typeahead, and picking an item appends a line
that **prices in place** and says so while it waits. This is the piece with no counterpart in the
old screen at all — it read the till's live basket — so the grid and its money columns are new build
rather than a port. Money is the engine's; nothing is computed in the browser.

**A duplicate item is refused at the moment it is added**, with the quantity control named as the
remedy. The old screen refused at submit; moving the rule forward means the agent fixes it while
looking at it.

Three consequences of the session that the screen must honour:

- **The acting store is the pricing plant**, bound once at open and never changeable. It is invisible
  in the request and decisive in the money, so it must be resolved *before the first item* — and the
  screen cannot offer a store switch mid-request.
- **No resumable drafts.** Leaving abandons; a crashed tab is swept server-side. So the agent is
  **warned before navigating away** from a part-built request, because leaving genuinely discards it.
- The form is **one scrolling page**. No modal opens anywhere in this flow.

## Spine reach

model/api (session verbs + eligibility-by-id) · store/logic (the session client over the `core/`
guard, add/qty/void, duplicate refusal) · component/route
(`/nphies/authorizations/new`, the grid and the add-row) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `aStaleStateNeverReplacesANewerOne` — the `core/` guard is genuinely in the path: an
      out-of-order response is discarded rather than rendered · pure
      (`src/features/nphies/authorizations/auth-session.test.ts`, 6 cases including
      equal-version-different-etag and the contract-major hard stop)
- [x] `addingAnItemAlreadyOnTheRequestIsRefusedWithTheRemedy` — the refusal names the quantity
      control · pure (9 cases, including the door's own `ITEM_ALREADY_ON_REQUEST` read into the same
      shape, and a **voided line not blocking its own item**)
- [x] `aVoidedLineIsKeptNotRemoved` — the projection retains it, because the audit trail is the whole
      point · pure (5 cases)
- [x] open → add → refuse a duplicate → change quantity → void → leave with a warning · flow
      (Playwright, new `tools/nphies-authorization-session-drive.mjs`) — **61/61** against stubbed
      envelopes, SIS.Api down and all six verbs unbuilt

Plus two pure suites the ticket did not name and the build wanted:
`leavingAPartBuiltRequestDiscardsIt` (a voided-only request still counts as work; an empty one does
not) and `theSessionWillNotOpenUntilThePlantIsResolved` (law 8, before the first item).

## Boundaries

**Server dependency (SIS.Api):** six session verbs — open, state, add item, change qty, void line,
abandon. **This is the largest and riskiest server term in the effort** (8–12 days for the full
eleven-verb surface, and it could be 6 or 18): it is a *parallel* build, because the existing
call-centre engine services are document-type-aware but call-centre-**bound**, so the recipe is
reused and the code is not.

First consumer of the guard [210](210-core-owns-the-latest-state-guard.md) graduated to `core/` —
if that ticket has not landed, this one cannot start without violating the import boundary.

The money columns render here but are **not editable** until
[218](218-five-money-inputs-and-nothing-else.md). Read-only is the correct intermediate state, not a
gap.

`tools/callcenter-drive.mjs` is the prior art for driving a live engine session in a browser — read
it before writing the new drive.

## Done when

An agent reaches the form from an eligibility, sees identity read-only, adds items that price in
place, is refused a duplicate at the moment of adding, changes a quantity, voids a line, and is
warned that leaving discards the request — drive green.

## Blocked by

- [210](210-core-owns-the-latest-state-guard.md) — the session client imports the guard from `core/`.
- [213](213-two-coverages-force-a-pick.md) — the seam and the chosen member id.

## What landed

`/nphies/authorizations/new?from=&coverage=` — 213's seam, its other end. The form **opens a real
transaction on mount and abandons it on the way out**: `Open` → `AddItem` → `ChangeQty` → `VoidLine`
→ `Abandon`, plus `State` for the read. Six of the eleven verbs; the other five are 218–220's, and a
verb declared before the screen that presses it is a shape nobody has checked.

🚩 **The eligibility is not fetched here.** §2 says `reference` is fetched from it *at `Open`*, so
the identity arrives inside the state — which also settles the boundary question, since the
eligibility read belongs to the other feature and features may not import features.

🚩 **The duplicate is refused twice over, and reads identically both times.** `refuseAdd` states it
forward with no round trip and names the **quantity control**; `readAddRefusal` turns the door's own
`ITEM_ALREADY_ON_REQUEST` into the same shape for a screen that has fallen behind. A **voided line
does not block its own item** — the remedy would otherwise point at a line that is no longer on the
request.

🚩 **A voided line is drawn, struck through and inert.** The heading counts what the payer is being
asked for, which is not what is on the screen.

🚩 **Leaving is intercepted whenever a transaction is open** — warned inline (no modal anywhere in
this flow) when there are lines, abandoned silently when there are none, because an OPEN transaction
left for the sweeper is the litter this design retired. `beforeunload` covers the closed tab; the
login bounce is exempt, because 401 is `core/api`'s and never feature code's.

🚩 **The session will not open until the plant is resolved** (law 8) and the shell's store switcher
is held still while it is open — a `core/engine-session/store-lock` hold, since `features/auth` may
read `core/`. ⚠️ `StoreSwitcher` is currently mounted nowhere, so that half is a latent guard.

Two more graduations to `core/`, both for 210's reason: **`newRequestId`** (re-exported from the
console's `api.ts`, so no call site moved) and the first real use of **`session-fault`** —
`SESSION_CLOSED` / `NOT_YOUR_SESSION` stop the form and clear the state rather than banner over a
request that is gone. **`SESSION_BUSY`'s bounded auto-retry is deliberately deferred** to the ticket
that adds concurrent verbs.

**Contract gap named:** §1.2 says item search "reuses the existing item lookup" and names no route;
the only one this repo has is another feature's, behind another grant. So the add-row is an
**item-number field, not a typeahead**, and an unknown number is the door's `ITEM_NOT_FOUND`.

980 tests green (27 new), drive **61/61**, the three earlier drives re-run unchanged (121/121 ·
108/108 · call-centre 508/508), lint + build clean · eleven decisions in `.afk/HITL-217.md`.
