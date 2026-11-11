---
status: done
spec: 819
blocked-by: 821
---

# 823 — Every parameter kind has its strip control, round-trips the permalink, resets, and reports fallback, 412 and "not filtered by"

## What to build

The strip renders each of the seven kinds with its own `core/ui` control:
- a period picker;
- a members search (open or pinned, one value or several);
- grain chips over the allowed subset;
- an operator plus a number in the display unit for a threshold;
- a top N stepper from 1 to 100;
- a measure choice and a breakdown choice.

"Reset to defaults" restores the author's values.

**The permalink:**
- each parameter's name is its key;
- several members repeat the key;
- `name=` means cleared;
- a threshold is written `name=gt:5`;
- `tv`, `refresh`, `cross` and `crossFrom` are reserved.

**The query** sends `{ itemId, revision, panelId, values }`, and the answer's new parts are read:
- `fellBack[]` shows a one-line "value not available, showing the default" notice;
- `notReached[]` shows "not filtered by …" on the panel. A runner sees it only for parameters moved off their defaults; the author sees all of them.

`ANALYTICS-412` names the parameter in the strip. Only the panels whose effective query changed re-run, with v1's loading feedback.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model/api (Query input/output) · store/logic (permalink, not-reached set) · component (strip controls, notices) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `permalink round-trip` — every kind survives encode → decode, including repeated keys, cleared `name=`, `gt:5` and reserved names · pure
- [ ] `notFilteredBy` — the runner set (only moved-off-default) against the author set (all) · pure
- [ ] drive: each kind's control changes the URL and re-runs only bound panels; a fallback link shows the notice; a stubbed 412 names the parameter; Reset works · flow

## Boundaries

Proposed door: the `Analytics/Query` input and output (spec 819 §C). Code 412. New `boards` keys for each kind's control, the notices and Reset. Under bidi, the threshold number and period ranges go through `Ltr` and `formatRange`.

## Done when

The pure tests are green, and the drive covers all seven controls, the fallback, 412 and Reset.

## Blocked by

[821](821-a-v1-board-runs-through-the-six-ready-made-parameters-unchanged.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
