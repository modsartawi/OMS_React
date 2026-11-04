---
status: open
spec: 766
blocked-by: 775
---

# 776 — Saving my own item saves in place; anyone else's saves as my copy; a clash is refused

## What to build

- **Own items** save in place with `PUT Analytics/Item/{id}` and `baseRevision`.
- **`ANALYTICS-403`** opens **Save as my copy** (`POST …/Copy`). The copy is Personal and records its
  source.
- **Shared and Certified items** also offer an explicit "Save as copy".
- **`ANALYTICS-405`** names who saved last and when, and offers a copy or a reload.
- **A copy** shows "the original changed since you copied it" when the source has moved on.

## Spine reach

model/api (`PUT`, `Copy`) · store/logic (tier → actions) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `tier and actions: owner × tier × curator → save in place | save as copy | read only` · pure (vitest)
- [ ] `edit a Shared view you do not own → Save as my copy; a stale save shows the 405 message and offers a copy` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves save, copy and conflict.

## Blocked by

[775](775-an-hq-user-builds-a-view-from-the-model-and-is-offered-only-the-chart-types-that-fit.md)
