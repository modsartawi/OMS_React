---
status: done
spec: 083
blocked-by: 090
---

# 093 — theItemsGridSumsItselfAndFlagsASignedDiscount

## What to build

The work area's four tabs — `Items` · `Header Conditions` · `Log` · `Jobs` — get the treatments the
payload evidence calls for. Deferred Log/Jobs loading and the mounted-hidden panels are **unchanged**:
unmounting an AG Grid throws away the operator's column widths, sort and filters.

| Treatment | What to build |
|---|---|
| Totals footer | `pinnedBottomRowData`, one row computed by a **pure reducer beside `columns.ts`** from `lines`: count, Σ `quantity`, Σ `grossAmount`, Σ `vatAmount`, Σ `netAmount`. |
| Discount flag | `cellClassRules` → `--attention-800` when `discount !== 0` (**not `> 0`**, which never fires — every real discount in the corpus is negative), and the value renders **as the payload carries it, sign included** (`-1.500`). Suppressing the sign would put the grid in disagreement with both the API and the Header Conditions tab one tab away. |
| Deleted line | `deleted === true` ⇒ muted + struck through. A deleted line indistinguishable from a live one is a real reading hazard. |
| Description first | The eye should land on a name, not a number. |
| Stock column | **Dropped** — no stock field exists. Its slot goes to `needTransaction`. |
| Rx / OTC tag | **Removed, not deferred** — `referenceErxLine` is `""` on the one real prescription and `itemCategory` is `"STND"`. No field on the payload carries it; the description renders plain. It returns only if a field is identified, which is a new question. |
| Right-aligned tabular figures | **Already ships** — `type:'numericColumn'` sets `.ag-right-aligned-cell`, which 082's theme gives `tabular-nums`. No per-column work; confirm, don't rebuild. |
| Selected row accent bar | **082's theme already** — `.ag-row-selected::after` with `inset-inline-start`. This slice only sets `rowSelection:'single'` on the items grid. |
| Zebra striping | **Not ours** — 082 rules row banding off for every grid; `rowBorder` on `--divider` carries the rhythm. |

**The Jobs tab count shows *failed* jobs in `--danger` when any exist**, total otherwise — so a failed
outbox job reaches the operator without their going looking.

**Known and out of scope:** line `vatAmount` disagrees with the `VATF` condition on `8000000121`, so
the pinned footer will agree with the grid and disagree with the conditions tab. That is a data
correctness question, not an arrangement one.

## Spine reach

pure (totals reducer) · component/config (`columns.ts`, `DetailGrid` usage, tab counts) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `totalsReducer` — the pinned footer row computed from each corpus document's `lines`: the line
      count and the four column sums, **including the negative discount on `2000000551`** · pure
      (vitest) → `src/features/oms/document/items.test.ts`, `describe('totalsReducer')`
- [x] `discountFlag` — the amber rule fires on a negative discount and not on `0` · pure (vitest) →
      same file, `describe('discountFlag')`

Verify the deleted-line treatment, the description-first order, the selected-row bar and the Jobs
failed count by driving `npm run dev`, plus `npm run typecheck`.

**What was run:** `npm test` 56/56 · `npm run typecheck` · `npm run lint` (all three gates) ·
`npm run build` — all green. The rendered grid was driven by a new
`tools/document-items-drive.mjs` (**23/23**), which replays the five captures over a routed wire and
asserts description-first, the pinned totals row and its four sums, `-1.50` in `--attention-800` with
its sign, a zero discount unflagged, click selection plus 082's leading `::before` bar, the deleted
line struck and muted, and both Jobs states (1 failed of 3 → the `bad` pill; 2 healthy → the neutral
one). `tools/document-rail-drive.mjs` (25/25), `-band-` (32/32) and `-cards-` (45/45) still pass; the
rail drive's tab assertion was widened for the new count badge.

Two Done-when items the corpus cannot show verbatim, synthesised from a real payload inside the
drive and labelled there: **no captured line is `deleted`**, and the captures carry no Log/Outbox
collections (those are separate endpoints).

## What the build decided

- **Counts land on all four tabs**, not only Jobs. A lone number on Jobs reads as an anomaly rather
  than a count; and the badge doubles as the "loaded but empty" signal — a deferred collection shows
  **no** count until it resolves, so a `0` is never a claim the app cannot yet make.
- **The failed count is 082 D-10's `bad` pill** (`StatusBadge sev="bad"` → `--danger-050` ground,
  `--danger-800` ink), not a raw `--danger` fill. The severity layer is how this app spells danger;
  a sixth colour decision at this one site is exactly what 086 removed. The drive asserts the two
  token values, so the claim is proved rather than asserted as "different from neutral".
- **The footer label is two pluralised fragments** joined through a key (`items.totals` ·
  `items.totalsLines_one/_other` · `items.totalsUnits_one/_other`). i18next pluralises on ONE
  `count` per call, and every capture carries exactly one line — a single `{{lines}} lines` string
  would have shipped `1 lines` on all five.
- **The sums round off binary-float dust** (`0.1 + 0.2` → `0.3`). `formatMoney` would have hidden it
  on the three amount columns, but `quantity` renders through `formatNumber`, which prints every
  digit.
- **The footer's figures are the document's, not the filtered view's** — the row is computed once
  from `lines`; a column filter does not recompute it. That is the question the operator opened the
  screen with.
- **Discount ink only, no weight bump.** D-9 specifies `--attention-800`; the amber is the flag.
- `-1.500` renders as `-1.50` — `formatMoney` is the app's one money formatter and it is fixed
  2 dp. The sign, which is the load-bearing part, is intact; the spec's 3 dp is payload notation.
- `isFailedJob` now serves both the row highlight and the tab count — one reading of `outboxStatus`.

## Boundaries

New totals-footer labels in the `document` namespace. No endpoint change. The footer's
`4 lines · 7 units` text is a **bidi hazard** and is one of ticket
[095](095-rtl-mirroring-and-bidi.md)'s wrap sites — build the string here, wrap it there.

## Done when

`npm test` shows the totals reducer green against all five payloads, and in the running app the items
grid opens with the description first, a pinned totals row, `-1.500` rendered in amber **with its
sign** on `2000000551`, deleted lines struck, and the Jobs tab counting failed jobs in `--danger`.

## Blocked by

[090](090-pill-rail-and-vitest.md) — for the vitest runner only. Independent of the band and the
cards; can run in parallel with [091](091-identity-band.md) and
[092](092-summary-rail-cards.md).
