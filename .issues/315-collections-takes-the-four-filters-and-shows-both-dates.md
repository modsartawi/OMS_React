---
status: done
spec: 308
blocked-by: —
---

# 315 — Collections filters by collector, accountant, business date and collection date, and shows both dates

## What to build

`collections-criteria` sends business date from/to and collection date from/to beside collector and served-by.
Business date and collection date become default columns. This sets the criteria shape 316 copies.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above:
  - `collections-criteria.test.ts`, "the business and collection date ranges" (7 cases): each range is sent under
    its PascalCase name; both ranges travel together (the contract's example); the legacy `FromDate`/`ToDate` are
    never sent; either end travels alone; the collection range may be left off for a sales-days-only question; the
    day goes as typed, with no time part; a From later than its To passes through. Empty values are dropped, never
    sent as `''`. The landing state is still today..today by collection date, with the business range open, and a
    business range or a cleared collection range lights the Filtered chip.
  - `acr-scope.test.ts`: the `?acr=` scope disables all four date ends (still a set equality with the criteria's
    keys) and sends none of the four names.
  - `collections-columns.test.ts`, "the Business date column" (4 cases): it is a default column, directly before
    Collection Date; it reads `businessDay`, not `salesDate`; it shows the date part only; `null` and the year-1
    sentinel are blank on screen and in the filter. The default set is now ten columns, and the completeness union
    still covers the row.
  - `csv.test.ts`: the business day is written as `yyyy-MM-dd`, and a `null` one is blank.
  - Mutations run: dropping `BusinessDateTo` turns 6 tests red; sending `CollectionDateFrom` as `FromDate` turns 14
    red; moving `businessDay` to the tail turns 5 red; filtering it on `salesDate` turns 2 red. Vitest **2322**
    green (136 files).
- [x] the screen renders against the contract stub (loading, empty, error, refusal):
  - `tools/collections-filters-drive.mjs` passes **44/44**. It stubs 1992's sample row verbatim, plus a settlement
    receipt and a pre-049 day, each with a `null` business day. It checks that:
    - the landing query is exactly `CollectionDateFrom`/`CollectionDateTo` = today plus `Limit`, with no legacy
      pair, no business range and no `required` end;
    - Business Date and Collection Date are default headers, side by side; `2026-09-02` and `2026-09-12 10:15`
      render as sent; both null business days are blank; the floating filter matches the shown day;
    - typing does not fire a query, and Search sends both ranges, an open-ended end alone, and the collector beside
      the dates; Reset returns to the landing query; a default Served-by scope rides with the dates;
    - under `?acr=` all four ends are disabled and empty, and the query is `AcrId` + `Limit` only;
    - loading shows the list's loading status; an inverted range sends as typed and gets the empty state, whose hint
      names both ranges; a 500 reads as a server fault; the contract's 400 binding failure (a ProblemDetails body)
      reads as a rejection; a bare 403 names its status; a refused probe gets the denied backstop;
    - no raw key shows and no page error is thrown.
  - `tools/collection-drive.mjs` still passes **220/220**. Its Collections checks now read the new wire names and
    the renamed Collection Date header. The CSV has 25 columns. The mixed-currency header check scrolls, because the
    promoted Currency column is now past the 1600px viewport.
- **Outstanding (not AFK):** no drive against a live SIS.Api with 1992 was run. Every envelope is stubbed.

## Blocked by

- BackOffice [1992](C:\Work\DMSCO\BackOffice-spec1976\.issues\1992-collections-filters-by-collector-accountant-business-and-collection-date.md) must be **done** and its `## Web contract` written

## Comments

**Built (2026-09-25), AFK.** Built against BackOffice 1992's `## Web contract` (`status: done`) and cross-checked
against the committed `CollectionInquiryOptions` / `CollectionInquiryModel.BusinessDay` on BackOffice main. The
contract and the code agree. The only field added to the web row is `businessDay` (`string | null`).

- **Criteria** (`collections-criteria.ts`): `fromDate`/`toDate` became `collectionDateFrom`/`collectionDateTo`, and
  `businessDateFrom`/`businessDateTo` were added. Each end is sent on its own when filled, per the contract's
  open-ended ranges. The legacy `FromDate`/`ToDate` are no longer sent. **This is the shape 316 copies.**
- **Toolbar**: four labelled date inputs, none `required`, all disabled and blank under the `?acr=` chip.
- **Columns**: `businessDay` ("Business Date") is a default column, directly before `collectedAt`, which is renamed
  "Collection Date". The CSV writes it as a day.
- Decisions (the pair guard dropped, the header renamed, labels, the inverted range) are in `.afk/HITL-315.md`.

**Review round.** `/code-review` found no correctness bugs. `/standards-review` found no spec defects and no hard
standards violations. Fixed from it: three stale "four inputs / other four" comments (the chip now disables seven
fields), and a `describe` block the new tests had split in two. Declined, left for 316: move `DateField` somewhere the
ACR, Deposit and Attempt toolbars can share within the feature, rather than copying it three times; and make each
range a `{ from, to }` type (flat keeps the PascalCase mapping one-to-one). Not touched: the older "Loading today's
collections…" copy. It is still true on landing, and it is not this ticket's.
