---
status: open
spec: 766
blocked-by: 776
---

# 779 — Anyone who may edit an item sees its last 20 revisions and can revert

## What to build

- **A history panel** shows who and when for the last 20 revisions (`GET …/Revisions`).
- **Revert** writes a new revision (`POST …/Revert`), so it can itself be undone.
- **Visibility:** only people who may edit the item see the panel.

## Spine reach

model/api (`Revisions`, `Revert`) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `revisions list: newest first, the revision being viewed marked` · pure (vitest)
- [ ] `revert to an older revision, see the board change, then undo the revert` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves history and revert.

## Blocked by

[776](776-saving-my-own-item-saves-in-place-anyone-elses-saves-as-my-copy-a-clash-is-refused.md)
