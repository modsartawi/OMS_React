---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551 (live: BackOffice 3035)
---

# 555 — A category manager searches, imports and changes the HungerStation material list

## What to build

The WPF HungerStation material inquiry and import, on the web. It is the list of materials offered to
HungerStation, flagged disabled or deleted.

- **Registration:** the feature `features/hungerstation/materials`, the namespace `hungerstation-materials`
  in EN and AR, and the route `/hungerstation/materials`. Its menu entry fills 551's placeholder under
  `canManageCatalog`.
- **Materials page** (AG Grid), **server-paged** (`skip`/`take`, `total`):
  - Columns: material number, SKU, name EN, name AR, disabled, deleted, updated at/by.
  - Filters: state (active, the default / disabled / deleted / any) and text (the start of a material
    number or SKU, or either name). Filters round-trip through the URL.
  - `updatedAt` renders blank when `null`.
- **Change one** material: set disabled and deleted, with a mandatory reason. The door returns the row, and
  the grid updates it in place. DHS-00009 shows inline.
- **Import**: paste or `.xlsx`, up to 5000 rows. Each row is a material number plus disabled and deleted.
  The X marks of the WPF sheet become booleans, so accept `X`/blank as well as true/false. A mandatory
  reason.
  - Show a preview before sending: rows, repeats (the last one wins), and any row that isn't a material
    number. Refuse locally over 5000.
  - The answer shows added, updated and the **unknown** numbers (not in the material master, not added) as a
    copyable list.
  - DHS-00010 shows inline.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`, section
Materials.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [x] `materialImport`: X/blank and true/false parse to booleans, the last repeat wins, a non-number is
  flagged, 5000 is allowed and 5001 refused (vitest)
- [x] `materialsQuery`: filters ⇄ URL ⇄ door, server paging (vitest)
- [x] `tools/hungerstation-materials-drive.mjs`, against stubs, LTR and RTL:
  - list, filter, page;
  - change one with a reason;
  - import a paste and an xlsx, the preview, the answer with unknowns;
  - the refusals inline;
  - the menu entry hidden when `canManageCatalog` is false.
- [x] typecheck, lint, test green

## Boundaries

oms-react only. Gate: `canManageCatalog`. Reuse the Deliverect catalog's import pieces (`material-list`)
where they fit rather than copying them.

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3035)

## Comments

**Done 2026-10-24** (branch `ticket/555`). Proof: vitest (`features/hungerstation/materials/material-import.test.ts`,
`materials-query.test.ts`, `i18n-keys.test.ts`), typecheck + lint (4 gates) + `npm test` green, and
`tools/hungerstation-materials-drive.mjs` **69/69 against STUBS** (LTR and RTL). 🚩 Not driven against a live
SIS.Api — the live walk is 557. Re-run after the core moves: `hungerstation-stores-drive` 84/84 (its Materials
checks now expect this page), `deliverect-catalog-drive` 90/90.

What moved to core (a feature may never import another):
- `features/deliverect/catalog/material-list.ts` (+ test) → `core/import/material-list.ts`, unchanged but for
  `isHeader`'s export: the HungerStation parser reads its header rule. Its one-column parse did not fit a
  three-column sheet, so the HungerStation rows have their own parser (`material-import.ts`) rather than a
  stretched shared one.
- Deliverect's import answer (counts + unknown list + Copy) → `core/import/ImportAnswerDialog.tsx`, used by both
  rails; the Deliverect hooks (`data-result-*`) are unchanged.

Judgement calls (overrulable):
1. **The sheet is the WPF one**: tab-separated (commas / semicolons also break columns, spaces do not), material
   number then disabled then deleted; columns past the third are ignored, as the WPF import ignored them. A
   first line with no digit is a header, skipped and said. `X`/`x`/blank and `true`/`false` (any case) are read;
   **any other mark is flagged, never guessed** (WPF read anything but `X` as false).
2. **A material number is 1–18 digits**, kept as typed (leading zeros kept, no padding). A row that is not one,
   or holds an unreadable mark, is listed with its line and **keeps Import off** — the door refuses the whole
   import for it (DHS-00010), so sending it is pointless. DHS-00010 still shows inline if the server's own test
   is stricter.
3. **Repeats**: one row per number, the LAST row's marks, kept in its FIRST place (the server's own rule, applied
   before sending so the preview shows what the door will do). The 5000 cap counts the rows the body carries
   (repeats collapsed): 5000 allowed, 5001 refused on screen, never truncated.
4. **A picked `.xlsx` replaces the paste**, its first three columns written out tab-separated, so what is shown is
   what is parsed and sent (one source, Deliverect's rule); blank rows stay as blank lines so a problem's line is
   its sheet row.
5. **Change patches in place** — the returned row is swapped into every cached page (`withRow`), no list read; a
   changed material stays on the page it is on (e.g. one just disabled under *Active*) until the next read.
   DHS-00009 shows inline, reads the list again and turns Save off.
6. **No client sort/filter on the grid** — it is one server page, and a client sort would only reorder that page.
   A set flag reads as a badge (disabled amber, deleted red); a clear one is blank.
7. **Placeholder file kept**: `src/app/HungerStationPlaceholderPage.tsx` and its `placeholder.materials.*` keys in
   `hungerstation-stores` stay — Orders (556) still routes to the file. 556 (or whoever lands last) deletes the
   file and both placeholder key blocks.

Open for the owner: none blocking. The Arabic copy is unread by a native eye (the drive's RTL pass is direction
only, `lng` stays `en`).
