---
status: done
spec: 819
blocked-by: 823
---

# 824 — An author declares a parameter on a board, with pre-filled bindings, reasons and an overview; a bad save lists every 411

## What to build

In the board editor, "+ Parameter" and ⚙ on each parameter open the parameter inspector (798 item 5). Declaring goes:
1. the kind, with a one-line hint;
2. the name, checked live: a slug, unique, not reserved;
3. the label in English and Arabic;
4. the fields for that kind: dimension, pinned list or open search, one or several values, allowed grains, the threshold's measure, the options;
5. the default, set with the viewer's own control;
6. "Viewers can't clear it";
7. "Applies to", pre-filled with every panel that can take it. Each other panel says why it can't (`noTimeAxis`, `seriesFilters`, `thresholdShape`, `topNShape`, `measureShape`, `breakdownShape`, `notInArea`). A members parameter can point at another dimension on one panel.

A **binding overview** (parameters × panels: bound, unbound, or can't with the reason) sits in the inspector. Deleting a ready-made parameter is allowed. Saving runs `validate`, and a server `ANALYTICS-411` lists every problem, each taking the author to its field.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

store/logic (`canBind`, pre-fill, `validate`) · component (parameter inspector, overview, 411 list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `canBind case table` — each kind × each panel shape, including the area rule and the series-filter rule, gives ok or the right reason; it is the same table the server uses · pure
- [ ] `prefill + validate` — a new parameter binds every can-bind panel; `validate` returns each 411 shape (slug, reserved, duplicate, binding) · pure
- [ ] drive: declare a members parameter, see the reasons, unbind one panel, save; a stubbed 411 lists two problems and each one focuses its field · flow

## Boundaries

The item save carries `params` and `bindings`. Code 411. New `boards` keys for kinds, hints, reasons and the inspector.

## Done when

The pure tests are green and the drive declares, binds and saves a parameter, and shows the 411 list.

## Blocked by

[823](823-every-parameter-kind-has-its-strip-control-and-round-trips-the-permalink.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
