---
status: done
spec: 430
blocked-by: 436
---

# 437 — A store-config user imports cities and districts with a preview and sees every skipped line

## What to build

These are the geography imports (spec 430 D6, D8, D14). They are the first user of a new **core
import parser**, which 438 reuses.

- **Core parser (graduates to `@/core`).** It turns text plus a column spec into lines of
  `{ action: 'upsert' | 'delete', fields } | { error }`.
  - Rows are split on `\r?\n`, with empty lines dropped.
  - Columns are split on `\t`.
  - A trailing `X` (case-insensitive) means delete.
  - The column count must be the spec's, or the spec's plus one when the extra is `X`. Anything
    else is an error.
  - There is **no header skip**. A header shows as an ordinary line.
- **Core result model.** It turns `{ applied, unchanged, skipped[] }` into a summary and a
  skipped-lines list. Known reasons are worded (`UNKNOWN_CITY`, `UNKNOWN_STAFF`,
  `UNKNOWN_SOURCE`). An unknown reason shows as its code, never dropped.
- **Import dialog.** One per list, and offered only with `canImportCities` / `canImportDistricts`.
  - The user picks a file or pastes text.
  - A preview grid shows each line's action and fields. Error lines are flagged, and Send stays
    disabled while any line is in error.
  - Send posts `{ lines: [...] }` with `isDelete`.
  - The result shows applied / unchanged / skipped, with each skipped line's number, key and
    reason.
  - Both lists reload afterwards.
- **The WPF column specs:**
  - City: `code, English name, Arabic name`. **English comes before Arabic.**
  - District: `code, city code, English name, Arabic name, Magento city EN, Magento city AR, store, insurance store, temporary store`.

## Spine reach

core logic (parser, result model) · api · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `parseImport` — the city and district specs, `X` and `x` delete, a wrong column count → error, CRLF and LF, empty lines, a header kept as a line · pure
- [x] `importResult` — applied/unchanged/skipped wording, an unknown reason kept · pure
- [x] `tools/geography-drive.mjs` extended — paste with an error line → send blocked, fix → send → the skipped-lines result → reload; no Import without the grant · flow

## Boundaries

- New import doors `SdDocumentWeb/Cities/Import` and `SdDocumentWeb/Districts/Import`, with the
  skipped-lines answer (BO-5, BO-7, not filed), built on a stub.
- The parser lives in `@/core`, because 438 is its second user.

## Done when

The drive covers preview, block, send and the skipped result on the stub, and the gates are green.

## Blocked by

[436](436-a-store-config-user-reads-cities-and-each-citys-districts.md)

## Comments

**Done 2026-10-08 (AFK).** This was built on a STUB of spec 430 D6/D8. The import doors
`POST SdDocumentWeb/Cities/Import` and `POST SdDocumentWeb/Districts/Import`, with the skipped-lines
answer (BO-5, BO-7, not filed), are NOT built, so nothing was driven against a live SIS.Api.

- **Core (438 reuses it):**
  - `@/core/import/parse-import`: `parseImport(text, columns)` → `{ line, cells, action, fields } | { line, cells, error }`, plus `canSendImport`, `importTally` and `decodeImportFile` (by BOM; a non-UTF-8 file is refused)
  - `@/core/import/import-result`: `importResult(answer)` → counts, plus skipped lines in file order with a reason key, or `null` for an unknown code
  - `@/core/models/import-result`: the D8 wire type
- **Feature:**
  - `geography.ts`: the WPF column specs (city: code, ENGLISH, Arabic) and `geographyImportBody` (`isDelete`; `null` while any line is in error)
  - `api.ts`: `importLines`
  - `ImportDialog.tsx`: pick or paste, the preview grid, the result
  - an Import button per list, gated on `canImportCities` / `canImportDistricts`
  - both lists reload after every send
- **Proof:**
  - vitest `core/import/parse-import.test.ts` (14): the city and district specs; X and x; wrong counts, including an extra non-X column and an empty one; CRLF and LF; empty lines; a header kept; no trim; blank text; canSend; tally; UTF-8, UTF-16 LE/BE and ANSI refused
  - vitest `core/import/import-result.test.ts` (7): the counts; the three known reasons worded by key; an unknown reason kept as its code; file order; clean; a malformed answer
  - `geography.test.ts` (+4): the city and district bodies with `isDelete` (never `isDeleted`); nothing sent while a line is in error; one reload key for both lists
  - Full suite: 221 files, 4057 tests green.
  - Drive `tools/geography-drive.mjs`: 122/122 in LTR and RTL (stubbed). It covers:
    - no Import without a grant, and one grant offers one list's Import only
    - a paste with a header, a short line, an empty line and an `x`: preview, flagged, Send blocked
    - fixed → Send → the exact body → applied/unchanged/skipped, an unknown reason shown as its code → the cities reload
    - a failed send ("may not have been applied", preview kept, lists reloaded) and a refused send ("nothing was applied")
    - an ANSI file refused
    - a UTF-16 district file → body in WPF field order → `UNKNOWN_CITY` worded → both lists reload
  - `npm run typecheck`, `npm run lint` (all four gates) and `npm run build` are green.
- **Reviews:**
  - /code-review: fixed a lenient UTF-8 decode (it would have sent U+FFFD as Arabic names), stale text after a failed file read, and a business refusal being titled as uncertain.
  - /standards-review: no hard violations. Tightened the import header map's key type, and added **Skipped import line** to CONTEXT.md.
- **Outstanding (not AFK's):**
  - a live walk on a real SIS.Api once BO-5/BO-7 ship
  - the owner's eye on the Arabic rendering
- **Decisions** are logged in `.afk/HITL-437.md`:
  - line numbers count the lines sent (empty lines excluded)
  - an empty extra column is an error (D14 verbatim)
  - `X` exact, values sent untrimmed
  - ANSI files refused
  - the dialog stays in the feature (graduate it if 438 would copy it)
  - a refused send vs an uncertain one
  - the district import is offered without a city selected
