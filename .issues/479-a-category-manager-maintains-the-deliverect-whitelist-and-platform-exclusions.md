---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: 477 (live: BackOffice 2623)
---

# 479 — A category manager maintains the Deliverect whitelist and platform exclusions

## What to build

- **Feature** `features/deliverect/catalog`, at the route `/deliverect/catalog`, with the namespace
  `deliverect-catalog`. Use the glossary word **Material**.
- **Whitelist grid**, paged at 500:
  - Columns: material, EN/AR names (bidi-safe), GTINs, disabled, deleted, the excluded platforms
    as chips, and updated at/by.
  - Filters: state and text.
- **Import**:
  - Paste material numbers, or pick an `.xlsx` with one column; refuse the file client-side over
    5000 rows.
  - Send with a reason.
  - Show the result: added, re-activated, and the **unknown** list, which can be copied.
- **Disable / delete / restore** a row, with a reason.
- **Platform exclusions**: a per-material editor with a checkbox per **delivery platform**, taken
  from `Platforms`. Unticked means excluded. Saving sends the whole set, with a reason. Explain
  in words that "excluded" means out of stock on that platform only.
- **Push catalog now** per account, showing the file id and status. DLV-00011 shows Deliverect's
  answer.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md` (Catalog; Platforms read).

## Spine reach

UI → app (BackOffice doors, stubbed until 483)

## Proof (→ `tdd` red-green cycles)

- [ ] `parseMaterialList`: pasted text or a sheet gives a trimmed, de-duplicated list, with the 5000 cap (vitest)
- [ ] `exclusionSet`: the ticked platforms ⇄ the excluded set sent (vitest)
- [ ] `tools/deliverect-catalog-drive.mjs`, against stubs: import with unknowns, disable/restore, edit exclusions, push, hidden without `canManageCatalog`
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2623)
