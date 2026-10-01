---
status: done
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

- [x] `hasChangeWaiting` — non-empty id ⇒ marked; `''` and absent ⇒ not · pure (`entry-cells.test.ts`, 5 cases)
- [x] Ledger + lane drive extended (`settlement-drive` / `settlement-supervision-drive`, or
  `settlement-change-drive`) — stubbed rows with and without the id draw the mark only where set, on the
  Ledger and on each lane · flow (drive) — new `tools/settlement-change-drive.mjs`, 28/28

## Boundaries

No new door. The fixtures (`open-lane-fixture.ts`, `settlement-fixture.ts`) gain the field per 2191's
contract; existing assertions stay unchanged.

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

None — can start immediately (BackOffice 2191 done on `spec2149`).

## Comments

**Built (2026-10-01).** Built against BackOffice 2191's `## Web contract` (`GET Settlement/Ledger` — one additive
field). No new door, route, grant or dependency.

- **Model:** `SettlementLedgerRow.openChangeRequestId: string`, typed as the ticket names it. `SettlementOpenLaneRow`
  inherits it.
- **Rule:** `hasChangeWaiting` (`entry-cells.ts`) is `!!row?.openChangeRequestId`. An absent field reads as `''`, so a
  server older than the wave marks nothing.
- **Mark:** `EntryNumberCell.tsx` draws an icon after the entry number. Its aria-label is "Change waiting" and it has a
  tooltip; it is not a button. It appears on the Ledger and on the three entry tabs (Shortage/Surplus lanes, Awaiting
  approval, Theft) through `MARKED_ENTRY_NUMBER_SHAPE`. The cash tab's rows are receipts, carry no such field, and keep
  the bare 96px number. Judgement calls are in `.afk/HITL-351.md`.
- **Fixtures:** `open-lane-fixture.ts` marks every ninth row by position, so no `rand()` draw is added and every
  existing figure stays where it was. `approval-fixture.ts` and `theft-fixture.ts` carry `''`.
  `settlement-fixture.ts` holds only `Settlement/Account` rows, and W10 adds no Account field, so it is untouched. The
  Boundaries line naming it was a slip.
- **Gates:** typecheck, `npm test` (164 files, 2801 tests), lint and build are green. The earlier drives were run
  unmodified and all passed: settlement 291/291, supervision 41/41, approval 42/42, theft 62/62, description 41/41.
  One 270 branch-search check failed once while six drives ran in parallel, then passed when the drive ran alone.
- **Reviews:** `/code-review` found nothing. `/standards-review` raised that the cash tab had widened, which is fixed
  by splitting the shape. Its other note was left as is: the field is required in the type although an older server
  omits it. The ticket and W14 type it `string`, and `hasChangeWaiting` absorbs the absent case.
- **Owner sign-off:** the mark sits on the entry-number cell rather than in a column of its own, and the cash tab is
  excluded.
