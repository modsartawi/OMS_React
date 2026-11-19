---
status: open
spec: BackOffice 4057
blocked-by: BO 4058
---

# 925 — An author uploads an item list, sees the preview, and shares it

## What to build

Spec: `C:\Work\DMSCO\BackOffice\.issues\4057-a-team-uploads-an-item-list-with-its-availability-periods-and-the-copilot-analyses-on-them-spec.md`.

- **The upload page** (author grant):
  - a template download;
  - a file drop for `.xlsx` and `.csv`, up to 2 MB;
  - a preview table with matched rows, then unknown values, duplicates, bad dates and overlaps, each with its row
    number;
  - name, audience (the existing audience picker) and folder;
  - Save, which uses the preview token. An expired token asks for the file again.
- **The list page** (audience):
  - members with their level, and periods with their status chips and notes;
  - unknown values;
  - versions, with who and when;
  - Export, and Re-upload (author), which goes through the same preview.
- EN and AR, RTL.

## Spine reach

UI (new `features/item-lists`), API client.

## Proof (→ `tdd` red-green cycles)

- [x] The preview renders each problem kind with its row number, and Save is disabled while nothing matched
- [x] Expired token → asks for the file again
- [x] Without the author grant there is no upload or re-upload, but the list page and Export still work
- [x] Arabic layout (RTL) snapshot
- [x] Lint + build clean

## Done when

Proof is green against mocks, and there is a live walk on BO 4058's local endpoints.

## Blocked by

- BackOffice 4058

## Comments

**2026-11-19: built against mocks; live walk on BO 4058 still owed (status stays open).**

Proved, against STUBBED envelopes (BO 4058 is not built):

- vitest (`src/features/analytics/item-lists/*.test.ts`, 24 tests): the problem model (each kind, in order, rows
  ascending), Save's holds (nothing matched, no name, empty audience, expired token, saving; unknown rows never hold
  it), `tokenExpired`, the expired-token refusal, the 2 MB `.xlsx`/`.csv` check, the grant gating (`itemListActions`),
  the wire readers, EN/AR bundle parity.
- `tools/item-lists-drive.mjs`, 94/94 in LTR and RTL: template download, wrong file refused before sending, preview
  with every problem kind and its rows, Save holds, Save refused as expired → file asked again, a fresh preview saves
  (token, name, audience, folder) and lands on the list page; members, periods with status chips and notes, unknown
  values, versions, Export; the re-upload PUTs the new token; nothing-matched holds Save; the preview's own clock
  lapses it; a reader gets the list page and Export but no upload or re-upload; another author gets no re-upload.
  RTL screenshots in `tools/.item-lists-shots/` (gitignored). The app's language stays English under RTL (core/i18n
  `lng: 'en'`), so the RTL proof is the mirrored layout; the AR bundle is proven by parity.
- typecheck, test, build clean. Lint: every gate clean for this change; `check-boundaries` still fails on four
  PRE-EXISTING imports in `src/features/insurance-rules/aliases/door-shapes.test.ts` (from e9243c46, not 925's).

Also: the audience model and picker graduated to `@/core/analytics-audience` (the share dialog uses it), since a
feature may not import the boards.

**Contract guesses** (all in `src/features/analytics/item-lists/api.ts`; reconcile when 4058 lands):

- Preview `data`: `{ token, expiresAt, fileName, rows, matched[{row, level, key, label, from, to, status, note}],
  unknown[{row, level, value}], duplicates[{rows, level, key}], badDates[{row, value}], overlaps[{rows, level, key}],
  refused[{row, level, key, reason}] }`.
- Multipart part name `file`.
- `POST Analytics/ItemLists` body `{ token, name, audience: {everyone} | {roles, users}, folderId }`; `PUT …/{id}` body
  `{ token }`; both answer the list.
- `GET Analytics/ItemLists/{id}` answers the item with `definition.{members, periods, unknown, upload}`.
- Expired token refused with `ANALYTICS-433`.
- Versions read from the item machinery's `GET Analytics/Item/{id}/Revisions` (`savedBy`/`savedAt`).
- Template and Export are `GET` blobs named by `Content-Disposition`.
- Re-upload offered to the list's owner (author grant + owner), as a board saves in place only for its owner.

Not done here: the library kind and New entry, and the menu (926).


- **2026-11-19 — code review fixed** (`spec/4057-item-lists` review, commits 421f4789..8ee84d1a on `impl/926`): the
  readers match a status or level in any case and keep an unknown one as sent (no more `?? 'unavailable'` / `'item'`
  coercion; the grid draws an unknown status as a neutral chip in the server's words, `statusText`); `readFolders`
  takes a bare array or `{ folders }` like the library's reader; the preview token's deadline is the server's window
  (`expiresAt − issuedAt`, ⚠ `issuedAt` guessed, else 30 min) counted from receipt, never this machine's clock against
  `expiresAt` — Save's `ANALYTICS-433` stays the authority; a locally refused file clears the last preview and Save;
  a save answering no id lands on `/analytics/library?kind=itemlist`; a failed re-read of a list (404 after delete or
  unshare) shows its error over the held copy. Tests in `api.test.ts` / `preview.test.ts`; `tools/item-lists-drive.mjs`
  108/108 (refused file, skewed server clock, no-id save added).
