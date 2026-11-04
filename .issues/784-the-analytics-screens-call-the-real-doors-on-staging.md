---
status: open
spec: 766
blocked-by: 767, 768, 769, 770, 771, 772, 773, 774, 775, 776, 777, 778, 779, 780, 781, 782, BackOffice 3381, 3382, 3383
---

# 784 — The analytics screens call the real doors on staging

## What to build

The live walk. With the analytics host, the Cube model and the SIS.Api doors on staging, walk every
screen against the real wire:
- the probe for a viewer and for a curator;
- the home;
- a board with all eight types, the filters, cross-filter and drill;
- the panel actions;
- building and saving a view and a board;
- copying, the conflict, certifying and reverting;
- auto-refresh and TV mode;
- the copilot making a view from Q6.

Each wire difference from 766 §C is a drift report: correct BackOffice 3378 first, then 766's
transcription, then the client. Record the timings of a filter change on a real board.

## Spine reach

all layers, live

## Proof (→ `tdd` red-green cycles)

- [ ] `the walk passes on staging in en and ar` · flow (the drive pointed at staging, no stubs)
- [ ] `each drift found is reconciled in 3378 → 766 → client` · review

## Boundaries

Needs staging SIS.Api with BackOffice 3381–3383 deployed, and the analytics host up (3379, 3380).

## Done when

Every step of the walk passes on staging, and any drift is reconciled.

## Blocked by

[767](767-an-analytics-view-opens-at-analytics-view-id-and-draws-its-bar-chart-behind-the-analytics-probe.md), [768](768-a-view-draws-as-a-kpi-line-stacked-area-or-any-bar-variant-with-compare-previous-and-the-top-5-plus-other.md), [769](769-a-view-draws-as-a-donut-a-table-with-cell-bars-a-heatmap-or-a-two-pane-combo.md), [770](770-the-analytics-home-lists-certified-boards-first-then-shared-then-my-own-with-search.md), [771](771-a-boards-filters-re-ask-every-panel-and-stream-each-answer-with-the-strip-showing-n-of-n.md), [772](772-clicking-a-mark-cross-filters-the-other-panels-and-drill-by-keeps-a-breadcrumb.md), [773](773-every-panel-offers-fullscreen-refresh-table-csv-xlsx-png-and-a-permalink-and-shows-its-freshness-and-its-failu.md), [774](774-drilling-to-detail-from-a-store-or-city-opens-the-deliveries-list-already-filtered.md), [775](775-an-hq-user-builds-a-view-from-the-model-and-is-offered-only-the-chart-types-that-fit.md), [776](776-saving-my-own-item-saves-in-place-anyone-elses-saves-as-my-copy-a-clash-is-refused.md), [777](777-an-hq-user-lays-out-a-board-on-a-12-column-grid-that-mirrors-under-arabic.md), [778](778-owners-share-and-delete-their-items-curators-certify-un-certify-and-delete.md), [779](779-anyone-who-may-edit-an-item-sees-its-last-20-revisions-and-can-revert.md), [780](780-a-board-refreshes-on-its-own-and-tv-mode-fills-a-wall-screen-from-a-permalink.md), [781](781-a-copilot-answer-that-created-a-view-links-to-it-and-the-trace-names-the-analytics-steps.md), [782](782-the-ask-box-on-analytics-opens-the-copilot-with-the-question-filled-in.md), BackOffice 3381, BackOffice 3382, BackOffice 3383
