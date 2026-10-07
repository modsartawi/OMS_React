---
status: done
spec: 430
blocked-by: 437
---

# 438 — An OMS admin lists and imports document source users

## What to build

This is the *Document source users* screen (spec 430 D7, D8, D14, D20).

- **Leaf and route.** The "Document source users" leaf is gated on `canOpenDocumentSourceUsers`.
  It is last in the D18 order. The route is `/oms/document-source-users`, with a page guard.
- **The list.** It loads `GET SdDocumentWeb/DocumentSourceUsers` on open and shows user ID,
  document source, updated by and updated at. It has a quick filter and an xlsx export. The model,
  `SdDocumentSourceUserModel`, goes in `@/core/models`.
- **Import.** Offered only with `canImportDocumentSourceUsers`. It reuses 437's core parser and
  result model with the column spec `user ID, document source[, X]`. It posts
  `{ lines: [{ userId, documentSource, isDeleted }] }`. Note **`isDeleted`**: the server's name
  differs from the geography imports' `isDelete`, and this side maps to it. Afterwards it shows
  the skipped-lines result (`UNKNOWN_STAFF`, `UNKNOWN_SOURCE`) and reloads.
- There is no single-row edit (D20).

## Spine reach

model/api · component/route/menu · i18n · test (the logic is the core parser's)

## Proof (→ `tdd` red-green cycles)

- [x] `sourceUserLines` — maps parsed lines to the body with `isDeleted` (never `isDelete`) · pure
- [x] `tools/document-source-users-drive.mjs` — list, filter, export, import preview → send → skipped result → reload, Import hidden without the grant, the leaf hidden without the flag, RTL · flow

## Boundaries

- New doors (BO-6, BO-7, not filed), built on a stub.
- A new namespace, `document-source-users`.

## Done when

The drive is green on the stub, and the gates are green.

## Blocked by

[437](437-a-store-config-user-imports-cities-and-districts-with-a-preview-and-sees-every-skipped-line.md) (for the core import parser)

## Open questions

- Which role gets `DocumentSourceUsersInquiry`/`Import` (none today) is the BackOffice spec's call.
  It does not block this build.

## Comments

**Done 2026-10-08 (AFK).** This was built on a STUB of spec 430 D2/D7/D8. The doors
`GET SdDocumentWeb/DocumentSourceUsers` and `POST SdDocumentWeb/DocumentSourceUsers/Import` (BO-6,
BO-7, not filed) are NOT built, so nothing was driven against a live SIS.Api.

- **The import dialog graduated to core** (D14; 437's HITL named this trigger): `@/core/import/ImportDialog.tsx`
  (moved from geography) and `@/core/import/preview-columns.ts`. It takes the feature's `ns`, `kind`,
  `title`, `format`, column spec, a `header` per column and a `send(lines)`. The copy stays in the
  feature's namespace, the way `ScreenGate` does it. A caller mounts the dialog per import. Core
  `sendableLines` is the one Send rule: every line, or `null`. It replaced `canSendImport`, which
  had no production caller left.
- **Geography:** reuses the core dialog. `geographyImportBody` now takes the sendable lines; its
  "nothing while in error" case moved to core's `sendableLines` test.
- **Feature `features/oms/document-source-users`:**
  - `SdDocumentSourceUserModel` (WPF's four fields) and the import line, in `@/core/models/document-source-user`
  - `api.ts` (list, `importLines`)
  - `document-source-users.ts` (query; WPF column spec `userId, documentSource`; `sourceUserLines` → `isDeleted`)
  - `columns.ts`, and the page: quick filter, xlsx export through the core writer, status bar, Import only with `canImportDocumentSourceUsers`, reload after every send
  - `canOpenDocumentSourceUsers` predicate in `@/core/oms/access` (it reads 431's flag; no new flag)
  - the route `/oms/document-source-users`, and the menu leaf LAST in the D18 order
  - `en` and `ar` namespace `document-source-users`, registered in `core/i18n.ts`
- **Proof:**
  - vitest `document-source-users.test.ts` (6): pin/unpin → `isDeleted`, exact keys with no `isDelete`, file order, raw values, WPF column counts, the query key
  - `parse-import.test.ts` (+3 `sendableLines`, -1 `canSendImport`)
  - Full suite: 223 files, 4064 tests green.
  - Drive `tools/document-source-users-drive.mjs`: 76/76 in LTR and RTL (stubbed). It covers:
    - leaf hidden and URL denied without the flag (the import flag alone shows nothing)
    - leaf last, after Cities & districts; one probe call; list on open, once
    - columns, isolation, an unset time blank, no row edit
    - filter by source and by user, status bar, "nothing matches"
    - export: file name, filtered rows, no isolates
    - no Import without the grant
    - preview with a header, an X and a short line (blocked) → fixed → exact `isDeleted` body → `UNKNOWN_STAFF` / `UNKNOWN_SOURCE` worded, an unknown code shown as itself → reload
    - a failed send says "may not have been applied" and reloads
    - a refused load
  - Regression drives on the same build: `geography` 122/122, `donor-requests` 90/90, `failed-donor-transfers` 102/102, `document-payments` 66/66.
  - `npm run typecheck`, `npm run lint` (all four gates) and `npm run build` are green.
- **Reviews:**
  - /code-review: typed `header` by column key, made one Send rule, mounted the dialog per import (no stale text on reopen, no phantom `cities` send). The row-ID finding was rejected: WPF keys `SdDocumentSourceUser` on `UserId`.
  - /standards-review: no hard violations, no spec gaps. Dropped the always-true `open` prop and the aliased `send` prop. Kept the per-feature `import.*` copy (see HITL).
- **Outstanding (not AFK's):**
  - a live walk on a real SIS.Api once BO-6/BO-7 ship
  - the owner's eye on the Arabic rendering
  - which role gets `DocumentSourceUsersInquiry`/`Import` (the BackOffice spec's call)
- **Decisions** are logged in `.afk/HITL-438.md`.
