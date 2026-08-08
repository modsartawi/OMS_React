---
status: done
spec: 249
blocked-by: 254
---

# 255 — ACRs and Collection Attempts list on the same template

## What to build

The two other **flat** grids, built as variations on the template
[254](254-cash-collections-opens-on-today.md) settled — same criteria draft, same today-defaulted
landing, same client paging at 50, same cap banner, same More-columns toggle, same floating filter row
on by default. If either screen needs a structural departure from that template, that is a finding
worth recording rather than absorbing.

**ACRs** (`/collection/acrs`)

- Filters: From · To · **ACR No#** · Collector · **Status**.
- The WPF's `""` / `OPEN` / `CLOSED` radio group becomes a **segmented control** (All / OPEN /
  CLOSED).
- 15 WPF columns, split identity-and-money first with the forensic tail behind the toggle.
- Two row actions land in [257](257-a-row-opens-its-document.md), not here.

**Collection Attempts** (`/collection/attempts`)

- Filters: From · To · Store · Collector · **Reason code**.
- The smallest screen in the suite — one flat list, 9 WPF columns, no document, no drill-down.
- ⚠ **No row action at all, and this is deliberate rather than unfinished.** The WPF withholds one on
  purpose: a collection attempt is **immutable evidence**, not a voucher. Do not add one for symmetry.

Both screens use `@/core/money.ts` for their money columns on the same terms as 254 — row's own
currency decimals, blank rather than `0.00`, currency code in the header.

## Spine reach

api (mocked) · logic (criteria, columns) · component · route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `acr-criteria.test.ts` — the segmented Status maps to the server's `""` / `OPEN` / `CLOSED`,
      with **All sending nothing rather than the literal `"All"`**; ACR No# is dropped when empty;
      dates still travel as a pair · pure
- [x] `attempts-criteria.test.ts` — reason code dropped when empty; the today-defaulted pair holds ·
      pure
- [x] `acr-columns.test.ts` + `attempts-columns.test.ts` — both screens' forensic tails hide nothing,
      same union assertion as 254 · pure
      *(Two screen-prefixed suites, not one `columns.test.ts`: 254's Proof note rules that
      `features/collection/` is ONE feature holding four screens and that "255 and 256 follow the
      same prefix". A shared `columns.test.ts` would collide with 256.)*
- [x] `tools/collection-drive.mjs` extended — both screens open populated on today, page at 50, toggle
      their tails, and filter per column; the Status segmented control re-queries; ⚠ **Collection
      Attempts exposes no row action** · flow (Playwright) — **104/104**

## What landed

Both shells became real screens behind 253's `ScreenGate`, as variations on 254's template — same
criteria draft, same today-defaulted landing, same client paging at 50, same cap banner, same
More-columns toggle, same floating filter row on by default. ⚠️ **Copied, not extracted**: neither
Page imports the other, and no inquiry shell graduated to `core/`.

- **`acr-criteria.ts`** — `AcrStatusFilter` (`'ALL' | 'OPEN' | 'CLOSED'`), `landingCriteria`,
  `buildAcrsParams`, `isLandingQuery`. `All` sends **no `Status` param at all**.
- **`acr-columns.ts`** — eight default columns, a seven-column forensic tail, `acrId` the single
  argued `NON_COLUMN_FIELDS` entry (257's key). ⚠️ **15 columns against the WPF's 14**: `depositId`
  is a wire field `AcrInquiryView.xaml` never showed and it folds into the tail rather than being
  dropped, exactly as 254 folded five unshown fields into its own.
- **`attempts-criteria.ts` / `attempts-columns.ts`** — the WPF's nine columns split five/four, and
  **this endpoint's own param spellings** (`StoreCode`, `CollectorStaffId`, not the other screens').
- **`AcrsToolbar` / `AttemptsToolbar`** — the segmented Status control is a real `radiogroup`, and
  its segments are `type="button"` so choosing one cannot submit the form and fire a query.
- ⚠️ **Collection Attempts has no row action**, asserted rather than assumed: the drive proves no
  button inside a row, no action column, and that clicking a row navigates nowhere. "We forgot" and
  "we decided not to" look identical in a screenshot.
- Small graduations, both argued in `.afk/HITL-255.md`: `dayText` → `@/core/util/date-format`'s
  `formatDay`, and `ListShimmer`/`EmptyState`/`ToggleChip` → the feature's own `GridStates.tsx`.
  `GRID_LIMIT` moved into `cap.ts` so the cap the query asks for and the cap the banner measures
  are one number.

### ⚠️ Two structural departures — recorded, per this ticket's own clause

Both are **server gaps**, not client choices, and both need provisioning on **BackOffice 1090**
before [259](259-the-screens-call-the-real-door.md) joins the doors, or they ship inert:

1. **The ACR grid's money cannot honour 244 §7.** `AcrInquiryModel` carries **no `CurrencyKey`**
   (`CollectionInquiryModel` does), so `netCollectedTotal` and `cardTotalSum` render at the default
   two decimals with **no code in the header**. Grouping and blank-not-`0.00` still hold. A
   BHD-summed ACR is therefore a *misstated* amount, not an untidy one. The client cannot state a
   currency that is not on the wire, and would not invent one. ⚠️ An ACR sums receipts across
   stores, so the honest server answer may be a *set* of currencies — in which case
   `NetCollectedTotal` is itself a meaningless sum, and that is a question for a human.
2. **The ACR No# filter has no server parameter.** `AcrInquiryOptions` has `AcrId` (the ULID, 257's
   exclusive drill-down key) and nothing keyed on the number; the WPF has no such box either. The
   box ships and sends **`AcrNumber`**, stating the contract for a door that does not exist yet.
   ⚠️ It is deliberately *not* sent as `AcrId` (the server would compare a ULID column against
   `"41"` and return nothing, silently) and deliberately *not* filtered client-side (which would
   narrow only the rows that already came back — the silent truncation this wave exists to end).
   If 1090 declines the parameter, the honest fallback is to **delete the box**, not to fake it.

One deliberate wording departure: the ACR's Σ `NetCollected` column is headed **Net Collected**, not
the WPF's `Cash (Deposit)`. `CONTEXT.md` reserves *deposit* for the bank end, and the same grid
carries three real deposit columns — the WPF caption would name the banking end twice, meaning two
different things.

**Outstanding, and not this ticket's:** no live call (the drive stubs both envelopes at Playwright;
[259](259-the-screens-call-the-real-door.md) is the wave-joining event), no row action on ACRs
(`Collections ▸` / `Form ▸` are [257](257-a-row-opens-its-document.md)'s), no export
([258](258-the-export-writes-a-summable-file.md)). Decisions taken unattended are in
`.afk/HITL-255.md`.

## Boundaries

- **New API dependencies:** `CollectionWeb/Acrs`, `CollectionWeb/Attempts` — **mocked here**;
  [259](259-the-screens-call-the-real-door.md) joins them to the real door. Through `@/core/api`.
- i18n keys into the existing `collection` namespace.
- No export yet — [258](258-the-export-writes-a-summable-file.md) covers all four screens at once.

## Done when

Both screens open on today, page, filter and toggle exactly as Cash Collections does; the segmented
Status control drives a real re-query; Collection Attempts offers no row action; the pure tests and
the drive are green.

## Blocked by

[254](254-cash-collections-opens-on-today.md) — the template. Building these before it would mean
settling the criteria/paging/column shape twice.
