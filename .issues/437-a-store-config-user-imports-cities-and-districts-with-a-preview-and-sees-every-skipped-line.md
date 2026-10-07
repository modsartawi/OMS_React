---
status: open
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

- [ ] `parseImport` — the city and district specs, `X` and `x` delete, a wrong column count → error, CRLF and LF, empty lines, a header kept as a line · pure
- [ ] `importResult` — applied/unchanged/skipped wording, an unknown reason kept · pure
- [ ] `tools/geography-drive.mjs` extended — paste with an error line → send blocked, fix → send → the skipped-lines result → reload; no Import without the grant · flow

## Boundaries

- New import doors `SdDocumentWeb/Cities/Import` and `SdDocumentWeb/Districts/Import`, with the
  skipped-lines answer (BO-5, BO-7, not filed), built on a stub.
- The parser lives in `@/core`, because 438 is its second user.

## Done when

The drive covers preview, block, send and the skipped result on the stub, and the gates are green.

## Blocked by

[436](436-a-store-config-user-reads-cities-and-each-citys-districts.md)
