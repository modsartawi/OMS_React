---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: 480 (live: BackOffice 3026)
---

# 550 — The Deliverect logs drawer opens a push's lines, and a store shows a material's sync history

## What to build

On the Deliverect Stores page (477/480), so the team can follow up what was actually sent, as they can for
HungerStation:

- **Push lines.** In the logs drawer (`SyncLogsDrawer.tsx`), a run opens its lines: PLU, platform (blank =
  the base row), price, stock, stock status. Filter by PLU and platform, paged. A run outside the 15 days
  (`linesKept: false`) says in words that line detail is kept 15 days, never an empty table that reads as
  "nothing was sent".
- **Material history.** From a store row, look up one material: every line sent for it at that store in the
  last 15 days, newest first, with each push's type (full / delta), status and Deliverect's callback. This
  answers "what stock did Deliverect last get for 601624 at P001?" without opening runs one by one.
- Out of stock is marked, and a refused push's lines are shown as attempted, not as delivered.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md`, section
**Stock sync lines** (BackOffice 3026), plus the Logs door's new `linesKept`.

## Spine reach

UI → app (BackOffice doors, stubbed until BackOffice 3026 is on staging)

## Proof (→ `tdd` red-green cycles)

- [x] helpers: line labels (base vs platform row, no-price, out of stock), the 15-day wording (vitest)
- [x] `tools/deliverect-stores-drive.mjs`: new sections — open a run's lines, filter by PLU/platform, page, an expired run's wording, material history from a store row (LTR + RTL), against stubs emitting **exactly** the contract's fields
- [x] typecheck, lint, test green

## Boundaries

oms-react only. Same gate as the Stores page (the access probe; the server grant is the real boundary). No
new menu entry.

## Done when

The helpers and the drive are green; the live check rides 483.

## Blocked by

- [480](480-an-hq-user-sees-each-deliverect-store-s-stock-sync-pauses-it-and-reads-its-logs.md)

(live: BackOffice 3026)

## Comments

**Done 2026-10-24** on integration branch `spec/550-deliverect-push-lines` (43eabf5 build, 6e05ffa
review fixes). typecheck + lint (4 gates) + 6036 vitest green; `deliverect-stores-drive` 230/230 against
**stubs** (live check rides 483, waits on BackOffice 3026 on staging). One intermittent drive flake
(a stubbed Lines read pending past 15 s, 1 in 12 runs, unproven machine load) — look again on a quiet machine.

`/code-review high`: 10 findings, 9 fixed (running push not shown as attempted, placeholder-page
caption, typed platform filter, focus/scroll across log↔lines, case-insensitive callback failure words,
200-line history cap notice, open run read live, row keys, feature-local `table-cells.ts`). **Not fixed,
recorded:** the native-`<dialog>` side-sheet frame is now copied in a 10th place
(`MaterialHistoryDrawer.tsx`) — a core `SideSheet` deserves its own ticket.

**Owner sign-offs:** (1) attempted = push status ≠ `S` OR callback in error/failed/failure/rejected
(contract names only refused pushes / `error`); (2) platform filter is typed, with seen names as
suggestions (Platforms door needs the terms grant and its `displayName` may not match); (3) a material
line with empty status reads "Running"; (4) Escape in the lines view closes the whole drawer; (5) prices
show 3 decimals with no currency (lines carry no `currencyKey`); (6) the Lines door is skipped when the
log row already says `linesKept: false`.
