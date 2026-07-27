---
status: open
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

- [ ] `onlyAKnownShortfallAsksTheAgent` — pure: requested > available with a **known** figure asks;
      within availability does not; **unknown availability does not**, at any quantity · pure
- [ ] `acceptingAShortfallMarksTheLineAndTheOrder` — drive: the modal names item, requested and
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
