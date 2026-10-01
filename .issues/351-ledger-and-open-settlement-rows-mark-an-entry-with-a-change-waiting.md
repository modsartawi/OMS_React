---
status: open
spec: 342
blocked-by: —
---

# 351 — Ledger and open-settlement rows mark an entry with a change waiting

Builds against BackOffice 2191's `## Web contract` (`GET Settlement/Ledger` — one additive field).

## What to build

`SettlementLedgerRow` gains `openChangeRequestId: string` (W14) — and so does `SettlementOpenLaneRow`,
which extends it. A row whose `openChangeRequestId` is not `''` shows a **change waiting** mark (W10) in
the Ledger grid and in the open-settlement lanes (entry tabs, Awaiting approval, Theft). An older SIS.Api
that does not send the field marks nothing (absent ≡ `''`).

The branch account view (`Settlement/Account`) carries no such field and gets none: its panel learns of a
waiting request from History (343). No Account field is added.

## Spine reach

model (`openChangeRequestId`) · store/logic (pure `hasChangeWaiting`) · component (Ledger + lane columns)
· i18n (mark label / aria) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `hasChangeWaiting` — non-empty id ⇒ marked; `''` and absent ⇒ not · pure
- [ ] Ledger + lane drive extended (`settlement-drive` / `settlement-supervision-drive`, or
  `settlement-change-drive`) — stubbed rows with and without the id draw the mark only where set, on the
  Ledger and on each lane · flow (drive)

## Boundaries

No new door. The fixtures (`open-lane-fixture.ts`, `settlement-fixture.ts`) gain the field per 2191's
contract; existing assertions stay unchanged.

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

None — can start immediately (BackOffice 2191 done on `spec2149`).
