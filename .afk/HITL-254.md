# HITL — ticket 254 (Cash Collections opens on today)

Decisions taken unattended, and the open items a human should look at.

## Q: The two column groups' union must be "the whole wire row", but the WPF only ever showed 19 of `CollectionInquiryModel`'s 24 fields. Where do the other five go?

**Decision taken:** Into the forensic tail, appended after the ticket's ten in the
ticket's own order — `retainedFloat`, `closerOperatorId`, `closerName`, `salesDate`,
`currencyKey`. The one field withheld from the grid entirely, `collectionReceiptId`, is
named in an exported `NON_COLUMN_FIELDS` with its reason inline, so the completeness test
still proves the row is fully accounted for.

**Why:** 254's Proof asks the columns test to assert that "every field on the wire row
appears in exactly one of the two groups, and their union is the whole row" — and 258 leans
on that to write the row unpacked. Five wire fields with nowhere to go would have made that
assertion unwritable, or made it a lie.

**Revisit if:** a reviewer reads "nothing is dropped" as a statement about the WPF's column
picker rather than about the row. Then the five extras move to a third, explicitly-argued
group and the export takes their union instead.

## Q: 244 §7 says the currency code goes "in the column header rather than per cell (per-cell only if a result can ever mix currencies)". HQ-wide scope spans KSA and Bahrain, so a result **can** mix. Which is it?

**Decision taken:** Both, conditionally. One currency in the result → the code goes in each
money column's header (`Net Collected (SAR)`). More than one → the headers stay bare and the
`Currency` column is promoted into the default set even with the More-columns toggle off.
Every figure always formats to **its own row's** currency either way.

**Why:** It is the exact condition 244 §7 attaches, and `loy/member/sales-columns.ts` already
solved the same problem the same way (its conditional Currency column). A fixed choice would
be wrong on one of the two estates.

**Revisit if:** mixed results turn out to be routine rather than rare — then Currency belongs
in the default set unconditionally and the header suffix goes away.

## Q: Ticket 254's Proof names `criteria.test.ts` / `columns.test.ts`, but `features/collection/` is ONE feature holding four screens, so those names collide with 255 and 256.

**Decision taken:** Screen-prefixed — `collections-criteria.ts`, `collections-columns.ts`
and their suites. `cap.ts` is **not** prefixed: the cap rule and the page size are identical
on all four screens and genuinely shared within the one feature.

**Why:** `loy/member/*-columns.test.ts` is the repo's precedent for prefixing inside a
multi-screen feature, and the spec cites it by that name.

**Revisit if:** never, probably — but 255/256 must follow the same prefix rather than
inventing a third convention.

## Q: Does 254 build the `?acr=` chip?

**Decision taken:** No. Ticket 254's Boundaries, Proof and Done-when never mention it; 244 §8
homes the drill-down with the row actions, which is
[257](../.issues/257-a-row-opens-its-document.md). 254 leaves `AcrId` out of the criteria
type entirely rather than half-wiring it.

**Why:** A disabled-filter chip with nothing that can set it is dead code the reviewer has to
evaluate twice.

**Revisit if:** 257 finds the chip needs the criteria type to have carried `acrId` all along —
it is one field and one branch in `buildCollectionsParams`.

## Q: Query-parameter casing for `[AsParameters] CollectionInquiryOptions`.

**Decision taken:** PascalCase (`FromDate`, `ToDate`, `StoreId`, `CollectorOperatorId`,
`Limit`), matching the C# property names exactly.

**Why:** 243's research asset states the house "101 idiom" — query names equal property names —
and `features/oms/deliveries/filter.ts` already writes `FromDate`/`ToDate`/`Limit` that way.
(ASP.NET's binding is case-insensitive, so this is about legibility against the contract, not
about whether it binds.)

## Q: `new Date()` in a screen that lands on "today" — read once, or per render?

**Decision taken:** Read **once at mount** for the landing state and the "is this still today"
chip; **re-read on Reset**.

**Why:** A screen left open across midnight must not silently re-scope itself under a
supervisor mid-reconciliation. Reset is the deliberate act, so that is where the clock is read
again. The pure module never calls `new Date()` at all — every function takes `today` as an
argument, which is what makes the landing state testable.

## Review findings triaged (built-in /code-review, then /standards-review)

**Fixed in this slice, all six:**

1. `today` was frozen at mount while Reset re-read the clock — after midnight the "Filtered"
   chip would have been permanently lit and its ✕ unable to clear it. `today` is now state and
   moves with Reset.
2. The date pair was not enforced: clearing one native date input sent a **half-open** window,
   which the service reads as unbounded and would have returned the chain's whole history
   truncated at the cap. Both inputs are now `required` and the builder drops a broken pair
   (`deliveries/filter.ts`'s own guard).
3. The always-on floating filter searched the **raw ISO** value while the cell showed the
   formatted one, so typing the date on screen matched nothing. Date columns now carry a
   `filterValueGetter`; sorting still uses the raw value. Pinned by both a unit test and a
   drive check that the raw ISO now matches *zero* rows.
4. The chip was measured against the **draft** rather than the issued query — it lit on a
   keystroke over an unfiltered grid, and went dark when the box was cleared over a filtered
   one. `isLandingCriteria` became `isLandingQuery(appliedParams, today)`.
5. The cap banner printed `2000-row`; it now prints `2,000-row`.
6. (Retracted by the reviewer, recorded because it is worth having written down.) A concern
   that a bare-date `ToDate` against the timestamp column `CollectedAt` would make the landing
   query always empty is **wrong**: `PosCollectionInquiryService.cs:39` does
   `options.ToDate?.AddDays(1).Date` with `cr.CollectedAt < @ToDate`, a genuinely day-inclusive
   window. 243's research asset records this for `Acr/Inquiry` but not for this endpoint —
   worth adding there.

**Accepted as-is, with the argument:**

- *"The `Filtered` chip is scope creep."* Kept. 254 is explicitly templated on BBY Inquiry,
  whose toolbar carries exactly this chip; with finding 4 fixed it states a true thing about
  the grid. It is a different chip from the `?acr=` one 257 owns.
- *"The mixed-currency column promotion wasn't asked for."* Kept — see the second Q above; it
  is the branch 244 §7 explicitly sanctions.
- *"`buildCollectionsParams` re-implements `buildQuery`'s empty-dropping."* Kept.
  `bonus-buy-inquiry/list-params.ts` and `deliveries/filter.ts` both do the same and say why:
  the builder's output is what the test asserts, so the object has to be honest on its own.

**Noted, deliberately NOT extracted (graduation candidates on a later consumer):**

- `ListShimmer` / `EmptyState` are now near-verbatim in this Page, BBY Inquiry and four Nphies
  pages. `core/ui/` is where they belong, but extracting them means editing six shipped screens
  from a slice that was chartered to copy a shape, not to refactor the ones it copied from.
- `GRID_PAGE_SIZE = 50` is the third independent 50 (`core/nphies/list-window.ts`,
  `admin/ua-admin/page-size.ts`). Same reasoning.

Both follow the spec's own idiom for the CSV escaping primitives: *"a `@/core` graduation
candidate on the third consumer — noted, not extracted now."* A human should decide whether the
Collections wave or a hardening ticket does it.

## Outstanding / not this ticket

- **No live call.** `CollectionWeb/Collections` does not exist yet (BackOffice 1090); the
  drive stubs the envelope at Playwright, exactly as 253 stubbed `CollectionWeb/Access`.
  Ticket 259 is the wave-joining event and nothing here has touched a real SIS.Api.
- **`collectionReceiptId` is on the contract but unused** until 257 opens the receipt with it.
  It is deliberately not a column.
- **Row action and export** are 257 and 258 by the ticket's own Boundaries.
- **BackOffice note, logged not acted on:** `CollectionInquiryModel.CollectionReceiptNo` is an
  `int`, so 258's identity-column rule (`="…"` wrapper, leading zeros survive) will be
  wrapping a number, not a zero-padded string. Worth confirming with 1090 that the projection
  keeps it an `int` rather than pre-padding it — the receipt *document*'s `noText` is padded,
  and the two must not be confused. Not edited: that repo has its own tracker.
