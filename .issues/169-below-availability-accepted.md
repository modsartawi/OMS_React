---
status: done
spec: 160
blocked-by: 167, 168
---

# 169 — addingBeyondAvailabilityIsAcceptedDeliberately

## What to build

Availability is a **soft gate**: an agent may take an order for more than the store has, but the
acceptance has to be theirs and has to be recorded as theirs.

Adding (or raising a quantity) beyond availability returns the **unchanged** state plus a
`belowAtp` confirmation naming the item, what was requested, what is available, and at which store.
It reuses [167](167-store-move-shows-the-diff.md)'s modal pattern exactly — a second confirmation
mechanism would be a defect.

- **The confirm always succeeds.** It is never a block; the order can always be taken.
- 🚩 **The token *is* the audit record.** It proves the agent was shown the number they accepted,
  which a client-set boolean never could ([136](136-session-api-contract.md) §5.2, BackOffice
  285/286). The committed line carries `belowAtpAtScan` and the header `hasBelowAtp`.
- 🚩 **Unknown availability raises no confirmation at all.** Where the stock read degraded there is no
  number to accept, and unknown ATP has never gated entry (287's rule). A console that confirmed here
  would turn a degraded service into a workflow.

Basket lines then carry availability **as frozen when the item was added**, labelled *at add*, using
the same three-state pill as the search row — so frozen and live availability never read alike, and a
re-freeze after a store move ([167](167-store-move-shows-the-diff.md)) is visible rather than
silent.

## Spine reach

api (`AddItem` / `ChangeQty` on the confirm path) · logic (which adds confirm and which do not) ·
component (below-availability modal; the frozen *at add* pill on lines) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [x] `onlyAKnownShortfallAsksTheAgent` — pure: requested > available with a **known** figure asks;
      within availability does not; **unknown availability does not**, at any quantity · pure
- [x] `acceptingAShortfallMarksTheLineAndTheOrder` — drive: the modal names item, requested and
      available; accepting re-sends the same verb with the same `requestId` plus the token; the
      committed line and the header carry the below-availability flags; the line's pill reads *at
      add* · flow (Playwright, extends `tools/callcenter-drive.mjs`, over fixture `04`)

## Boundaries

**Endpoints:** none new — the confirm path of `AddItem` / `ChangeQty`. Fixture
`04-below-atp-confirm.json` joins `payloads.ts` (shape only). Codes: `CONFIRM_TOKEN_STALE`,
`CONFIRM_TOKEN_INVALID` — handled by 167's shared pattern, not re-implemented here.

## Done when

An agent asked to sell five where two exist is shown both numbers, accepts deliberately, and the
order carries the flag that acceptance produced — while an unknown stock reading never interrupts
them at all.

## Blocked by

[167](167-store-move-shows-the-diff.md) — the confirmation pattern is built there.
[168](168-search-in-arabic-no-estimate-as-money.md) — there must be an add path to exceed.

## As built

- **The two-phase discipline graduated to a module of its own.** 167 held it in `store-move.ts`;
  a second action taking the same path made re-typing it the risk, so `confirm-action.ts` now owns
  the three functions (`committing`, `repreviewing`, `isCommitting`) and both actions delegate.
  🚩 One action keeps one `requestId` **including** the acceptance and the re-ask — proven on the
  wire by the drive, not asserted in a comment.
- 🚩 **`belowAtpAsk()` is the predicate, and it lives client-side for one reason**: the console must
  never draw an acceptance it cannot state truthfully. It answers `null` for `storeChange` (167's
  sheet draws that), for a missing token, for figures that are not both readable numbers — which is
  exactly how a degraded read (`available: null`) would arrive — and for a request within
  availability. So *unknown availability never asks*, at any quantity, is a property a pure test
  holds rather than a server behaviour the client hopes for.
- **A block that cannot be stated is still an ask, so it is still not an add.** §5.2's ask carries
  the *unchanged* state. Where the projection cannot draw it, the console says the item was not
  added and why, under the rows — saying nothing would leave the agent watching a basket that did
  not move, which is the harm 168's interim sentence existed to prevent.
- **A failed acceptance stays in the sheet.** The id and the token are unchanged, so pressing again
  is a retry of the one action (law 3), and the panel behind it stays silent — one refusal, one
  voice (167's ruling). `CONFIRM_TOKEN_STALE` / `_INVALID` re-ask through 167's shared bounded path;
  neither is re-implemented here.
- **The pill is one component in two registers.** `AvailabilityPill` (extracted from 168's panel)
  takes `keyBase`, so `search.atp.*` reads *12 in stock* and `line.atp.*` reads *12 at add* — the
  same classification and shape, deliberately different words. `frozenAvailability` sends
  `known:false` to *unknown* whatever quantity rides beside it and drops the quantity, so a degraded
  freeze can never be quoted as a figure. The drive measures that the two never read alike for the
  same item.
- **The flags are the server's, drawn where they belong.** `belowAtpAtScan` marks the line and
  `hasBelowAtp` the basket header; neither is re-derived from the frozen figure beside it — the
  token is what recorded the acceptance.
- **The confirmation draws no money and offers no alternative quantity.** These are counts, and what
  to do about a shortfall (order anyway, take fewer, try another store) is the agent's call on a
  live call — a console that proposed a number would be deciding it for them.
- **Not built, deliberately.** `changeQty`'s confirm path is the same one and needs nothing new
  here; the verb itself arrives with [170](170-basket-corrects-itself.md), which mounts this sheet
  unchanged. 168's interim `search.addBeyondAvailability` key was deleted with its call site.
