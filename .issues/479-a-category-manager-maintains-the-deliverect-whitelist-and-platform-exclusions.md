---
status: done
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

- [x] `parseMaterialList`: pasted text or a sheet gives a trimmed, de-duplicated list, with the 5000 cap (vitest)
- [x] `exclusionSet`: the ticked platforms ⇄ the excluded set sent (vitest)
- [x] `tools/deliverect-catalog-drive.mjs`, against stubs: import with unknowns, disable/restore, edit exclusions, push, hidden without `canManageCatalog`
- [x] typecheck, lint, test green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2623)

## Comments

**Done 2026-10-12 (AFK).** `features/deliverect/catalog` at `/deliverect/catalog`, namespace `deliverect-catalog` (en + ar), Catalog leaf on `canManageCatalog` after Orders.

- vitest: `material-list.test.ts` (paste and sheet → trimmed, de-duplicated list; header skip; 5000 cap reported, never truncated; rows counted; multi-column flagged), `exclusion-set.test.ts` (ticked ⇄ excluded set, unlisted keys kept, round-trip), `whitelist-state.test.ts` (row state, writes offered, PUT bodies, URL query), `i18n-keys.test.ts`, `menu-deliverect.test.ts`, and a `core/api.test.ts` case for `api.post` params. Suite 4944 green.
- xlsx reader graduated with `git mv` to `src/core/util/xlsx-read.ts` (test and fixture moved with it). Central-invoice behaviour is unchanged.
- drive `tools/deliverect-catalog-drive.mjs` **90/90 against stubs** (LTR + RTL). It covers: menu and denied gate; grid columns, chips and isolation; state/text ⇄ URL ⇄ door; paging take=500 and skip=500; import by paste (header, repeats, exact body, result, Copy of the unknown list, DLV-00012 inline, >5000 refused with no call) and by .xlsx (one column read; two columns, >5000 rows and unreadable files refused); disable / restore / delete bodies; exclusions (REPLACE, unlisted key kept as a read-only chip, Save off until changed; Platforms 403 → unavailable, Save disabled, no PUT); push (account → `?account=`, file id / status / rows shown, DLV-00011 inline, Accounts 403 → typed key). Orders drive 91/91 and stores drive 167/167, each with its menu check updated for the new leaf.
- typecheck, lint (4 gates) and build are green.
- Rulings and contract gaps are in `.afk/HITL-479.md`.

**Outstanding (not AFK's):** the live doors on staging (483 / BackOffice 2623, 2627). Owner sign-off is needed on the no-reason Push, restore-one-step, the header skip, the rows-based file cap, the multi-column refusal, and the Platforms/Accounts 403 fallbacks. The Arabic still needs the owner's eye.
