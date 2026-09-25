---
status: done
spec: 308
blocked-by: 315
---

# 316 — ACRs, Deposits and Attempts take the same four filters

## What to build

Copy 315's shape onto `acr-criteria`, `deposit-criteria` and `attempts-criteria` with the per-screen meanings
of BackOffice spec 1976. Attempts gains the Served-by picker. The ACR number and deposit number boxes now reach
real server parameters. Business date and collection date become default columns where they apply.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above:
  - `acr-criteria.test.ts`, `deposit-criteria.test.ts`, `attempts-criteria.test.ts` — "the business and collection
    date ranges". Each covers: both ranges under their PascalCase names (the contract's own example queries); the
    legacy `FromDate`/`ToDate` never sent; either end sent alone; one range left off entirely; the day sent as
    typed; a From later than its To passed through; empty ends dropped, never sent as `''`. Each landing is today
    on the window the screen always had: business on ACRs, collection on Deposits and Attempts. A range on the
    other axis lights the Filtered chip. `AcrNumber`/`DepositNumber` are sent trimmed and never as the ULID.
  - `attempts-criteria.test.ts`, "the Served-by pair": the pair ANDs with `CollectorStaffId`; UNASSIGNED sends
    only the Kind; a half-chosen pair sends neither key. The landing sends no pair.
  - `served-by.test.ts`, "the Attempts screen": the new `attempts` row of `SERVED_BY_SCREENS` is pinned. It uses
    the assignment reading, offers Accountants, takes no free text, and matches Collections' row but not the ACRs
    row. All five Kinds resolve, and an off-roster id is not honoured.
  - `day-span.test.ts` (new, 7 cases): the earliest and latest DAY in any order, absences skipped, `null` when there
    are no days, one date when both ends share a day, and a separator from `t()`.
  - `acr-columns.test.ts`: the derived *Collection Date* (`collectionDate`) sits directly after `acrDate`. It shows
    a span of days, one date on a single day, and is blank on an idle ACR. It has no `field`, and its filter
    matches what it shows. First and Last Collected are in the tail. The completeness union is now 19 fields.
    `deposit-columns.test.ts`: the derived *Business Date* (`businessDate`) sits directly before `depositedAt` and
    shows the span of the lines' `acrDate` (the contract's 08-20 … 09-10 sample). One day shows one date; no lines
    shows blank. `attempts-columns.test.ts`: `businessDay` and `attemptTime` lead the default grid, now split 6/3.
    `csv.test.ts`: both ACR collected-at ends are written as raw ISO, and blank on an idle ACR.
  - Mutations run, each red and then restored: attempts Served-by dropped (4 red); attempts business To miswired
    (2); ACR collection From sent as `FromDate` (4); ACR landing blanked (5); `DepositNumber` dropped (6); deposit
    landing blanked (4); span max inverted (4); single-day collapse removed (3); deposit business column removed
    (8); ACR span reading only its first end (2); the `attempts` row switched to collector reading (3);
    `businessDay` off the attempts default grid (7). Vitest **2369** green (137 files).
- [x] the screen renders against the contract stub (loading, empty, error, refusal):
  - `tools/four-filters-drive.mjs` (new) passes **80/80**. It stubs 1993's three sample rows verbatim, plus an idle
    ACR, a same-day ACR and a one-line deposit. On each of the three screens it checks that:
    - the landing query is exactly the landing pair plus `Limit`, with no legacy pair;
    - there are four optional date ends;
    - Business Date and Collection Date are default headers, side by side;
    - typing does not fire a query; Search sends both ranges, then an end alone; Reset returns to the landing query;
    - loading shows the loading status and no grid;
    - an inverted range is sent as typed and gets the empty state, whose hint names both ranges;
    - a 500 reads as a server fault;
    - the contract's 400 binding failure (ProblemDetails) reads as a rejection.

    Per screen it checks:
    - **ACRs:** Business Date shows `2026-09-02` and Collection Date `2026-09-05 – 2026-09-12`; an idle ACR is
      blank, and a same-day ACR shows one date; `AcrNumber=1207` is sent; a non-digit number does not search.
    - **Deposits:** `2026-08-20 – 2026-09-10`; the contract's `BusinessDateFrom/To` + `DepositNumber` example is
      sent; a non-digit number does not search.
    - **Attempts:** the Served-by `<select>` offers Accountants and Unassigned and lands on Everyone. The contract's
      `ServedByKind=ACCOUNTANT&ServedById=4466` + business-day example is sent with `CollectorStaffId` beside it;
      UNASSIGNED sends only the Kind; Reset clears it; the resolver's 400 envelope shows the server's message.

    No raw key shows and no page error is thrown.
  - `tools/collection-drive.mjs` still passes **220/220**. It now reads the new wire names and the renamed
    Collection Date header. The ACR CSV has 19 columns. It scrolls before reading Card Total, which is now past the
    1600px viewport. `collections-filters-drive.mjs` passes **44/44** (the shared `DateField`) and
    `acr-closed-by-drive.mjs` **41/41**.
- **Outstanding (not AFK):** no drive against a live SIS.Api with 1993 was run. Every envelope is stubbed.

## Blocked by

- BackOffice [1993](C:\Work\DMSCO\BackOffice-spec1976\.issues\1993-acrs-deposits-and-attempts-take-the-same-four-filters.md) must be **done** and its `## Web contract` written
- [315](315-collections-takes-the-four-filters-and-shows-both-dates.md)

## Comments

**Built (2026-09-25), AFK.** Built against BackOffice 1993's `## Web contract` (`status: done`) and cross-checked
against the committed `AcrInquiryOptions`, `DepositInquiryOptions`, `CollectionAttemptInquiryOptions`,
`AcrInquiryModel` and `DepositInquiryLineModel` on BackOffice main. The contract and the code agree. Only three
fields were added to the web models: `AcrInquiryRow.firstCollectedAt` / `lastCollectedAt` (`string | null`) and
`DepositInquiryLine.acrDate`.

- **Criteria:** each of the three modules drops `fromDate`/`toDate` for the four named ends, sent one by one as 315
  does. `AcrNumber`/`DepositNumber` are now real filters. Attempts gains `servedBy` on the new `attempts` row of
  `SERVED_BY_SCREENS` (assignment reading, like Collections) and keeps `CollectorStaffId` beside it. Landings are
  unchanged in meaning: ACRs by business date, the other two by collection date. Attempts does not land
  default-to-mine.
- **Toolbars:** 315's `DateField` moved to its own file (`DateField.tsx`), so all four toolbars share it. The ACR
  and deposit number boxes are digits-only via `pattern`.
- **Columns:** ACR date is now headed Business Date, and the derived Collection Date span sits beside it. Deposits
  gets a derived Business Date span beside Collection Date (`depositedAt`). On Attempts, Business Date (default
  now) sits beside Collection Date (`attemptTime`). The span logic is `day-span.ts`, with the `grid.daySpan` key.
- Decisions are in `.afk/HITL-316.md`.

**Review round.** `/code-review` found no correctness bugs. `/standards-review` found no hard standards violations
and no spec defects.
- **Fixed from it:** in a first cut the ACR span was drawn on the `firstCollectedAt` field, so the CSV headed only
  the first instant "Collection Date". The span is now a derived column like the Deposits one, and the raw ends
  export as First Collected and Last Collected. Also fixed: the stale "four screens" wording in `ServedByPicker`.
- **Declined:** a `{ from, to }` date-range type. Flat keys keep the PascalCase mapping one-to-one, as 315 ruled.
  Also declined: sharing `DISABLED_CLASS` between `DateField` and `CollectionsToolbar`. It is one Tailwind string,
  and exporting it from a component file costs Fast Refresh.
- **Left for the owner (HITL-316):** Attempts landing on "mine" (story 76 leans that way); the deposit business
  days missing from the CSV (story 81); the "Business date" and "Collection date" terms not yet in `CONTEXT.md`.
- **Flagged, pre-existing, not this ticket's:** the server replaced the ACR row's `netCollectedTotal` with
  `bankedTotal` (BackOffice 1183), so the web's Net Collected column would render blank against a live door.
