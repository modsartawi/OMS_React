---
status: open
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

- [ ] `aStaleStateNeverReplacesANewerOne` — the `core/` guard is genuinely in the path: an
      out-of-order response is discarded rather than rendered · pure
- [ ] `addingAnItemAlreadyOnTheRequestIsRefusedWithTheRemedy` — the refusal names the quantity
      control · pure
- [ ] `aVoidedLineIsKeptNotRemoved` — the projection retains it, because the audit trail is the whole
      point · pure
- [ ] open → add → refuse a duplicate → change quantity → void → leave with a warning · flow
      (Playwright, new `tools/nphies-authorization-session-drive.mjs`)

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
