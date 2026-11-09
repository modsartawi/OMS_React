---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3461-cancellation-reasons-are-one-maintained-list-and-a-delivery-is-cancelled-only-by-request-spec.md
blocked-by: BackOffice 3463
---

# 856 — The list owner maintains cancellation reasons under Admin → Cancel reasons

## What to build

A new admin page, **Admin → Cancel reasons**, on BackOffice 3463's doors. It reuses doc-type-config's
list, edit-dialog and re-read pieces.

- A list of every cancellation reason: code, English name, Arabic name, order, active/retired, last changed
  by/at. Retired reasons are visibly marked, not hidden.
- **Add:** code (entered once, never editable afterwards), English name, Arabic name, order.
- **Edit:** both names and the order.
- **Retire / reactivate.** There's no Delete.
- Validation lives in a **pure module**: code = 4 letters/digits, upper-cased; names required; English ≤ 50 and
  Arabic ≤ 100 characters. The server stays the authority: a code held by another group, retiring the last
  active reason and a stale re-read come back as its bilingual refusals.
- A stale write shows the re-read notice, following the existing convention.
- The menu leaf is hidden unless `…/Access` answers `canMaintain: true`, and it fails closed (852's rule).
- Arabic names are rendered with the bidi isolation helpers where they meet LTR text.

## Spine reach

UI (page + menu) → web API client → SIS.Api (3463)

## Proof (→ `tdd` red-green cycles)

- [ ] `the form refuses a malformed code, a blank name and an over-width name` · vitest (pure validation module)
- [ ] `the code is read-only when editing` · vitest
- [ ] `a stale write shows the re-read notice` · vitest (precedent: doc-type-config `reread.test.ts`)
- [ ] `the menu leaf is hidden without canMaintain and on a probe failure` · vitest
- [ ] i18n keys exist in both locales (the existing i18n key test)

## Boundaries

🚩 Do not deploy before BackOffice 3463 is live.

## Done when

The Proof tests are green, and against a dev SIS.Api with 3463 an owner can add an Arabic-named reason, see it
in 855's dialog, retire it and see it disappear.

## Blocked by

BackOffice [3463](C:/Work/DMSCO/BackOffice/.issues/3463-the-list-owner-adds-renames-reorders-retires-and-reactivates-a-cancellation-reason.md)
