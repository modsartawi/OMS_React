---
status: open
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

- [ ] `sourceUserLines` — maps parsed lines to the body with `isDeleted` (never `isDelete`) · pure
- [ ] `tools/document-source-users-drive.mjs` — list, filter, export, import preview → send → skipped result → reload, Import hidden without the grant, the leaf hidden without the flag, RTL · flow

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
