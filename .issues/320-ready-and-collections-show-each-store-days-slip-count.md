---
status: done
spec: 319
blocked-by: —
---

# 320 — Ready and Cash Collections show each store day's slip count, and filter to "No slip"

## What to build

A **Slips** column on the Ready for collection grid (`ReadyPage`) and the Cash Collections grid
(`CashCollectionsPage`), plus a **Card total** column on Ready.

- **The count.** Each row's `slipCount` (integer | null). A null draws a dash, never `0`. A real `0` draws `0`.
  - On Collections the count is keyed by **that row's own `businessDay`**, so the rows of one multi-shift
    receipt may differ. Do not merge or sum them.
  - Settlement rows are always null.
- **Card total on Ready.** `cardTotal` (number | null) is the day's confirmed card tender. A null draws a dash,
  never `0.000`. It is formatted like the grid's other money cells and goes in the currency header on the same
  terms as its neighbours. Collections already has a card total, so leave it alone.
- **Unavailable banner.** When the envelope's `slipCountsUnavailable` is `true`, show a **"Slip counts
  unavailable"** banner over the grid. The rows still render, and every count is a dash.
- **The "No slip" filter.** A client-side toggle in each toolbar that keeps `row.slipCount === 0` only. It is
  never `== 0` and never `!row.slipCount`, so a null never falls into it. It adds no server parameter. It
  follows the toolbar's Reset like the other client filters.
- **Hide the column (and the filter) unless the session may see slips.** Add a probe of
  `GET AttachmentWeb/Access` and show the column only when `data.categories` contains `"CASH_CLOSE"`, tested
  with a strict membership check. A refused probe (503 `NOT_SET_UP`, 403, a network failure) or a pending
  probe hides it. Read the probe once per screen under one shared query key, so 321–323 read the same answer.
  The probe returns `withdrawCategories` too (BackOffice 2035). Type it now as an optional `string[]` and
  leave reading it to 323.
- **Keep the envelope's sibling.** `api.get` returns `data` alone, so `slipCountsUnavailable` is lost. Add one
  read to `src/core/api.ts` that returns the whole envelope (or `data` plus its named siblings), with the same
  base, credentials, `X-Web-Client` header, 401 redirect and error taxonomy as `get`. Move `ready()` and
  `collections()` onto it. Update every caller, and change no other behaviour of those screens.
- The count is **not** clickable yet. The drawer is 321's.

## Contract

Build against BackOffice
[2034](C:\Work\DMSCO\BackOffice\.issues\2034-ready-and-collections-show-each-store-days-slip-count.md)'s
`## Web contract` (the Ready, Collections, column and filter sections), stubbed exactly. Cross-check it against
`CollectionReadyRowModel.cs`, `CollectionInquiryModel.cs`, `SlipCountedResponse.cs` and
`AttachmentWebEndpoints.cs` (the Access answer) on BackOffice `pricing2`. Add no field the contract does not
name.

## Proof

- [x] vitest on the pure modules:
  - the projection draws null → dash and a real 0 → `0`, for `slipCount` and `cardTotal`;
  - the "No slip" predicate keeps `0` and drops `null`, `undefined` and every positive count (mutation-check
    `=== 0` → `== 0` / `!x` and see it go red);
  - the access predicate is true only for a `categories` array holding `"CASH_CLOSE"`, and false for a
    refusal, a missing field, `"CASH_CLOSE"` as a bare string and an empty array;
  - the core envelope read keeps `slipCountsUnavailable` and still throws the usual `ApiError` taxonomy.
- [x] A drive (`tools/*-drive.mjs`, stubbed, no live SIS.Api) on both grids covers:
  - the column shown and hidden by the probe, including a 503 `NOT_SET_UP` probe;
  - dashes for null;
  - the banner on `slipCountsUnavailable: true`;
  - the filter keeping only the `0` rows;
  - loading, empty, error and refusal still as before.
- [x] Sibling drives unchanged: `ready-drive`, `collection`, `collections-filters`, `four-filters`.
- [x] `typecheck`, `lint` (all three gates), `build` and `npm test` green.

## Boundaries

- No new route, menu leaf or grant. Ready and Collections keep their own access flags.
- No server-side filter parameter. The grids already page, sort and filter in the browser (F3).
- i18n zero-literal: the column headers, the banner, the filter label and the dash's accessible text all go
  through `t()`.
- Do not show a count as a link or button yet (321).

## Done when

A collection accountant sees each store day's slip count on both grids, and a dash where it is unknown. They
can filter to the days with none, see a banner when counts could not be read, and see the day's card total on
Ready. A session without the slip grant, or a server without a File Server key, sees neither the column nor the
filter.

## Blocked by

- BackOffice [2034](C:\Work\DMSCO\BackOffice\.issues\2034-ready-and-collections-show-each-store-days-slip-count.md): **done** (merged `da71a9621`).

## Open questions

- The new core read's name and shape (`api.getEnvelope<T, S>` versus a narrower `api.getWith(path, params,
  siblings)`). Choose whichever keeps `core/` from learning a feature's field names, and record the choice
  in the comments.

## Comments

**Done 2026-09-26 (AFK).**

**Contract.** Built against BackOffice 2034's `## Web contract`, and 2035's for the Access probe's
`withdrawCategories`. BackOffice 2034 and 2035 are both `status: done` on `pricing2`. I cross-checked the contract
against `CollectionReadyRowModel.cs` (`CardTotal decimal?`, `SlipCount int?`), `CollectionInquiryModel.cs`
(`SlipCount int?`), `SlipCountedResponse.cs` (`SlipCountsUnavailable` beside `data`) and `AttachmentWebEndpoints.cs`
(`AttachmentAccess(Categories, WithdrawCategories)`, and a 503 `NOT_SET_UP` when the File Server is unset).
**There is no drift and no invented field.**

**The core read (the open question).** The new read is `api.getEnvelope<T, S>(path, params?, headers?)`, returning
`ApiEnvelope<T, S> = HttpGeneralResponse<T> & Partial<S>`.
- It is generic over the siblings: `core/` never names `slipCountsUnavailable` or `withdrawn`.
- `request` now delegates to one shared `requestEnvelope`. So `get`'s behaviour is unchanged, and `getEnvelope`
  throws the identical `ApiError` at every status (tested side by side).
- 321 uses the same read for ByOwner (`S = { withdrawn: … }`).

**What was built.**
- **`slips.ts`** (pure).
  - `canSeeSlips` / `holdsCategory` check `Array.isArray(x) && x.includes('CASH_CLOSE')`, so a bare string reads false.
  - `isNoSlipRow` is `=== 0`.
  - `slipCountText` draws the dash for null.
  - `slipCountedRows` projects the envelope to `{ rows, slipCountsUnavailable }`, with `=== true`.
  - `withSlipColumn` places Slips right after `cardTotal`.
- **`api.ts`.** `ready()` and `collections()` are now on `getEnvelope`. It also adds the ONE probe key
  `SLIP_ACCESS_KEY = ['collection','slips','access']` with `slipAccessQuery()`, and `slipAccess()`.
  321–323 must read that same entry.
- **`use-slips.ts`.** `useSlipView` holds the probe, the client "No slip" filter and the banner gate for both grids.
  - The filter is off whenever the column is hidden.
  - Reset clears it.
- **`SlipCountColumn.tsx`.** Its `valueGetter` means one column builder serves both rows. A null draws `—`, with the
  `sr-only` text "Slip count unknown". It is not clickable (321's).
- **`NoSlipChip.tsx`.** The toggle in both toolbars, drawn only when the probe admits.
- **Ready.** Adds `cardTotal` (a money field under the currency header, a dash for null, `0.00` for a real 0) at the
  end of the landing set, followed by Slips.
- **Collections.** Slips goes after the existing Card total, which is untouched. Each row is drawn by its own
  `businessDay`'s count.
- **`slipCount` stays out of the Collections CSV** (its own `SLIP_FIELDS` group; see HITL).
- **`GridStates`.** Gains `AttentionBanner`, which `CapBanner` now wraps. It is used for "Slip counts unavailable".
- **i18n.** A new `slips` group (`column`, `countUnknown`, `noSlip`, `unavailable`), plus `ready.columns.cardTotal`.

**Proof.**
- **npm test: 144 files / 2491 tests green**, against a baseline of 143 / 2455. New tests:
  - `slips.test.ts` (20);
  - an `api.getEnvelope` block in `core/api.test.ts`;
  - Slips and Card-total cases in `ready-columns.test.ts` and `collections-columns.test.ts`, whose completeness
    unions now include `SLIP_FIELDS`.
- **Mutation checks.** Each was broken once and seen red, then restored:

  | # | Mutation | Tests red |
  |---|---|---|
  | 1 | `=== 0` → `== 0` | 1 |
  | 2 | `=== 0` → `!row.slipCount` | 4 |
  | 3 | array membership → `String.includes` | 1 |
  | 4 | `slipCountsUnavailable === true` → truthiness | 1 |

- **`tools/slip-count-drive.mjs`: 64/64**, stubbed, against vite on :5199. On both grids it covers:
  - the column and filter shown for a CASH_CLOSE holder;
  - both hidden for a 503 `NOT_SET_UP`, a bare 403, a network failure, a pending probe, a bare-string
    `"CASH_CLOSE"`, an empty list, a withdraw-only answer and a malformed answer;
  - dashes plus their accessible text for null, and a real 0 as `0`;
  - Ready's null card total as a dash;
  - a multi-shift receipt's two rows keeping 0 and 3;
  - the banner, with the rows still drawn and every count a dash;
  - "No slip" keeping only the 0 rows, sending no query, and following Reset;
  - the probe asked once per page;
  - loading, empty, 500 and bare-403 states as before;
  - no raw keys and no page errors.
- **Sibling drives, UNMODIFIED:** `ready` 44/44, `collection` 220/220, `collections-filters` 44/44,
  `four-filters` 80/80. None of them stubs `AttachmentWeb/Access`, so the fail-closed path hides the column there.
- **typecheck, lint (all three gates), build:** green.

**Review.**
- **Built-in /code-review:** no findings.
- **/standards-review, Standards axis:** no hard violations. Taken:
  - the page and toolbar duplication extracted into `useSlipView` and `NoSlipChip`;
  - `withSlipColumn`'s two never-varying parameters removed.

  Left as judgement calls: `CapBanner` as a thin wrapper, `withdrawCategories` typed for 323, and the two positional
  booleans on the column builders (the siblings' existing shape).
- **/standards-review, Spec axis:** taken: the drive's Collections half was thickened (loading, bare 403, and the full
  probe-refusal matrix, including pending). Recorded in `.afk/HITL-320.md`:
  - the banner only shows under an admitting probe;
  - no Slips column in the CSV;
  - the Card total placement;
  - AG Grid's own English "No Rows To Show" overlay when "No slip" matches nothing (pre-existing, app-wide, and
    already reachable through the floating filter).

**Outstanding (not AFK-able):**
- The live walk against a real SIS.Api with the File Server key set: an accountant sees counts, a collector gets
  null, and a register failure gives the banner.
- The owner's read of the new strings ("Slips", "No slip", "Slip counts unavailable", "Slip count unknown",
  "Card Total").
