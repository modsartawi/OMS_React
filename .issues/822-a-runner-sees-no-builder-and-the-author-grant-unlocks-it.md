---
status: done
spec: 819
blocked-by: —
---

# 822 — A runner sees no builder, edit, copy or AI ask box; the author grant unlocks them

## What to build

`GET Analytics/Access` gains `canAuthor` (794). As in v1, absent or unreachable means denied, and curate implies author.

A **runner** (`canView` without `canAuthor`) gets:
- no "New view / board / report" on the home;
- no builder or editor routes: a direct URL shows the no-access state;
- no edit, copy, Save as my copy, share or certify actions;
- no analytics ask box.

A runner keeps run, the parameters, the cross-filter, export, fullscreen, the table view, TV mode and the permalink. `ANALYTICS-415` (needs the author grant) maps to its message and hides the action next time.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model/api (Access) · store/logic (item actions by grant) · component/route (home, editors, ask box) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `itemActions with grants` — grant (runner, author, curator) × tier × owner → the allowed actions; a runner gets only run and export · pure
- [ ] `refusal map` — `ANALYTICS-415` maps to its key · pure
- [ ] drive: a runner session shows no builder, edit or ask box, and `/analytics/new` shows no-access; an author sees them all · flow

## Boundaries

Proposed door change: `Analytics/Access` → `{ canView, canAuthor, canCurate }`. New code 415. New `boards` keys for the refusal and runner copy.

## Done when

The pure tests are green and the drive proves both sessions.

## Blocked by

None — can start immediately

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
