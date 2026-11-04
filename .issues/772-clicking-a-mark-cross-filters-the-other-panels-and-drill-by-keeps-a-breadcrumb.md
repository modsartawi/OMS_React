---
status: open
spec: 766
blocked-by: 771
---

# 772 — Clicking a mark cross-filters the other panels, and drill by keeps a breadcrumb

## What to build

- **Cross-filter:** clicking a bar, slice or table row filters every other panel on that member, and
  clicking it again clears it. A panel can opt out. The clicked panel does not re-run.
- **Drill by:** drill from a point into another allowed dimension, in place, with a breadcrumb back.
  It is not saved unless the user picks "Save as view", which is enabled in 775.
- **The URL** carries the cross-filter.

## Spine reach

store/logic (cross-filter in the effective query) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `effective query: a cross-filter reaches every panel except the source and the opted-out` · pure (vitest)
- [ ] `click a store row: the other panels go busy, the clicked panel does not; click again clears it; drill by shows its breadcrumb` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves cross-filter and drill by.

## Blocked by

[771](771-a-boards-filters-re-ask-every-panel-and-stream-each-answer-with-the-strip-showing-n-of-n.md)
