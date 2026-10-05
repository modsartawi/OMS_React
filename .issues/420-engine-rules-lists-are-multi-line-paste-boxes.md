---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2396-an-oms-bonus-buy-is-tested-before-it-goes-live-and-authoring-scales-to-real-campaigns-spec.md
blocked-by: 417
---

# 420 — Engine Rules lists are multi-line paste boxes that keep a pasted Excel column whole

**Source:** BackOffice spec 2396.

## What to build

Today the six Engine Rules lists are single-line inputs, and a pasted Excel column loses its newlines (`1186⏎1188` becomes
`11861188`).

- All six lists (includes, excludes, origin filter, stacking excludes, loyalty groups, loyalty tiers) become **multi-line
  textareas**, and pasting keeps newlines and tabs.
- The client normalises the list the way the server does: `, ; |` space, newline and tab become commas, and the result is trimmed.
  It shows **how many codes** the box holds.
- `LIST_MAX.originFilter` becomes **3000**. ⚠ Ship that cap only with or after BackOffice 2403; until then keep 50.
- A coupon template's origin filter (`CouponDetailPane`) gets the same box, normaliser and cap.

## Spine reach

UI (Engine Rules tab, coupon detail) · pure normaliser

## Proof (→ `tdd` red-green cycles)

- [ ] `a pasted column with CRLF, LF or tabs normalises to a comma list` · vitest
- [ ] `the code count matches the normalised list` · vitest
- [ ] `origin filter cap follows the shipped width` · vitest

## Boundaries

The normaliser must match BackOffice 2400's separator set exactly. The 3000 cap is deploy-gated behind BackOffice 2403.

## Done when

The owner pastes a 500-row Excel column of store codes into the origin filter, sees 500 codes, and saves.

## Blocked by

417 (+ BackOffice 2400; BackOffice 2403 for the 3000 cap)
