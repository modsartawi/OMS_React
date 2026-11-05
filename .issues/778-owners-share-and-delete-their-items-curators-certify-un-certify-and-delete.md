---
status: done
spec: 766
blocked-by: 776
---

# 778 — Owners share and delete their items; curators certify, un-certify and delete

## What to build

- **Owners:** Share and Unshare (one click, reversible), and Delete.
- **Curators** (`canCurate`):
  - Certify a Personal or Shared item, which freezes a certified copy;
  - Certify a later revision into it;
  - Un-certify, or delete a Certified item.
- **Badges:** the Certified badge shows on the home, the board and the view.
- **Hidden actions:** an action the user cannot take is hidden. A `402` from a stale probe shows its
  reason.

## Spine reach

model/api (`Share`, `Unshare`, `Certify`, `Uncertify`, `DELETE`) · store/logic (tier → actions) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `tier and actions: share, certify, uncertify and delete availability per owner and curator` · pure (vitest)
- [x] `a curator certifies a Shared board and it moves to Certified on the home; a viewer sees no Certify` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves the share, certify and delete paths.

## Blocked by

[776](776-saving-my-own-item-saves-in-place-anyone-elses-saves-as-my-copy-a-clash-is-refused.md)
