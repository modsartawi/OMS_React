---
status: done
spec: 249
blocked-by: 251, 252, 255, 256
---

# 257 — A row opens its document, and an ACR opens its collections

## What to build

The navigation out of the grids — the seam where the four screens meet the two documents. Held as its
own slice because it is the **only** ticket that needs both halves of the wave to exist, and folding
it into the screens would have blocked them on the documents for no reason.

**Row actions:**

- **Cash Collections** → `Receipt ▸` opens `/collection/receipt/:collectionReceiptId` **in a new tab**.
- **ACRs** → `Form ▸` opens `/collection/acr/:acrId` **in a new tab**.
- **ACRs** → `Collections ▸` routes to `/collection/collections?acr=<AcrId>` in the **same** tab.
- **Deposits** → slips are ordinary links in a new tab (already delivered by
  [256](256-deposits-shows-its-lines-and-balances.md)).
- **Collection Attempts** → none, deliberately.

⚠ **New tab, not overlay, and the reason is twofold**: the grid keeps its search, scroll and
selection, and **a document becomes an address** that can be pasted into a ticket or sent to a
colleague. The WPF opens a second window to the same effect.

**The `?acr=` drill-down** ([244 §8](244-four-inquiry-screens-in-our-clothes.md)):

`?acr=<AcrId>` opens Cash Collections scoped to that ACR, showing a **removable chip** naming it. The
chip visibly **overrides and disables** From/To/Store/Collector.

⚠ **The disabling is honesty, not decoration.** The server treats `AcrId` as an **exclusive** filter —
it ignores store, collector and period entirely when one is set. Leaving those inputs live would let a
user set a date range that silently does nothing. Clearing the chip drops the param and returns the
ordinary today-filtered screen.

One grid, one column set, one **shareable URL**. Reuses the `?bby=` deep-link idiom
(`core/bonus-buy/deep-link.ts`). ⚠ A side pane and an AG Grid master-detail row were both considered
and rejected — the latter is an **Enterprise** feature this repo does not have.

## Spine reach

logic (deep link, scope) · component (row actions, chip) · route (search param) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `acr-scope.test.ts` — with `?acr=` set: which filters are **overridden and disabled**, that the
      criteria sent carry `AcrId` and **omit** store/collector/period entirely, and that clearing
      restores the ordinary today-defaulted criteria. Round-trips through the URL · pure
      *(16 tests. The disabled set is pinned as a **set equality against the criteria's own keys**,
      not as a list: a fifth filter added to the toolbar without being disabled here would be a live
      input the server silently ignores, and that is the assertion that catches it. `?acr=` with an
      empty value reads as **not scoped** rather than as "the ACR whose id is the empty string".)*
- [x] `tools/collection-drive.mjs` extended — `Collections ▸` from an ACR row lands on Cash Collections
      with the chip present and the four filter inputs **visibly disabled**; removing the chip drops
      the param and restores today; the URL is shareable (reload reproduces the scoped view);
      `Receipt ▸` and `Form ▸` carry `target=_blank` and resolve to a rendering document · flow
      (Playwright) *(180/180 green; the 257 section adds 27 checks. Row 0 of each stubbed grid carries
      a **fixture key** as its id, so following a link renders a real document rather than the miss
      backstop; row 1's receipt id is **blanked on purpose** — 1089 is still in flight, so an empty
      one is a real arrival and must draw no link at all.)*

## Boundaries

- No new API — reuses `CollectionWeb/Collections` with `?acrId=`, still mocked at this point.
- i18n keys for the chip and the three row-action labels into the `collection` namespace.
- ⚠ The receipt link needs `collectionReceiptId` **on the grid row**, which is a real (small) server
  change owned by
  [1089](file:///C:/Work/DMSCO/BackOffice/.issues/1089-a-collection-receipt-has-an-identity-on-the-wire.md).
  Until that lands the mock supplies it; the link shape does not change when it goes live.

## Done when

Every row action opens the right destination in the right tab; the `?acr=` chip scopes, disables,
survives a reload and clears cleanly; the pure test and the drive are green.

## Blocked by

- [251](251-a-collection-receipt-prints-as-one-a4-sheet.md) — the receipt must exist to be opened.
- [252](252-an-acr-form-prints-across-its-pages.md) — likewise the ACR form.
- [255](255-acrs-and-attempts-list-on-the-same-template.md) — the ACR grid supplies both its actions.
- [256](256-deposits-shows-its-lines-and-balances.md) — so the whole suite's navigation lands as one
  reviewable change.

## As built

`acr-scope.ts` — the three addresses (`receiptHref`, `acrFormHref`, `collectionsForAcrHref`) and the
scope's rules, spelled **once**, following `core/bonus-buy/deep-link.ts`'s idiom. It stays in the
feature rather than graduating to `core/`: both ends of every one of these links are inside this
feature, and nothing outside it links here yet. `RowActions.tsx` builds the two action columns.

**The action column is composed at the Page, not folded into the field lists.** `collections-columns`
/ `acr-columns` carry a completeness proof — every wire field in exactly one group — and 258's export
writes their union. An action is neither a field nor exportable, so folding it in would put a column
of links in the accountant's CSV and weaken the assertion that catches a dropped field. ⚠ Note for
258: `ag-grid-community@36.0.1` has **no `suppressCsvExport` on `ColDef`** (checked against the
typings), so `colId: 'actions'` is the handle whichever writer 258 lands on must exclude.

**A blank id has no address.** `CollectionReceiptId` is a server change still in flight
([1089](file:///C:/Work/DMSCO/BackOffice/.issues/1089-a-collection-receipt-has-an-identity-on-the-wire.md)),
so an empty one is a real arrival; the cell draws **nothing** rather than a link to
`/collection/receipt/`, which is a route that cannot match — a 404 dressed as a working action.

**The URL is the scope's only home.** There is no `scopedAcr` state beside it, which is what makes
the view a shareable address: a reload, a paste and the Back button all reproduce it, and no copy can
drift from it. The Page holds the **applied criteria** (not the applied params) so that a scope that
arrives leaves them untouched and clearing it puts them straight back —
`collectionsParamsFor` owns that branch, and the Page never rebuilds it.

⚠️ **Overridden, not merely locked.** The four inputs are disabled *and show nothing* while scoped. A
greyed box still reading `2026-08-08 → 2026-08-08` over a grid scoped to an ACR spanning three weeks
says "this period was applied and then frozen" — the exact misreading the disabling exists to
prevent, since the door discarded it. Search is disabled with them: with all four overridden there is
nothing left to promote. The **Filtered chip is suppressed** while scoped — two chips over one grid
would be two accounts of why it is narrowed, and only the scope is true.

🚩 **The chip names the ACR by its ULID, not by its number**, and that is a recorded limitation rather
than a choice: `CollectionInquiryRow` carries neither `acrId` nor `acrNumber`, so a scoped screen has
**no ACR number anywhere on the wire** to read, and the client may not derive one. Naming it properly
is a **server change** (`AcrNumber` on the collections projection, sibling to 1089) — logged in
`.afk/HITL-257.md`, not guessed at here.

⚠️ **`Collections ▸` is withheld from a session that cannot open Cash Collections** (`Form ▸` stays).
The four grants are independent, so a ragged session is ordinary rather than hypothetical, and a
same-tab drill-down into `ScreenGate`'s denial would cost it the grid state the new-tab ruling exists
to protect. It reads the same cached probe the gate already resolved — and that read is now
`collectionAccessQuery()` in `api.ts`, so the key **and its options** are spelled once: react-query
merges concurrent observers' options, and a second reader that dropped `retry: false` would make a
refused probe retry under a gate whose whole ruling is to fail closed.

Nothing was added to Collection Attempts or Deposits, and both **absences are still asserted** by the
drive — an attempt is immutable evidence, and a deposit has no document at all.

🚩 Still no live SIS.Api: every `CollectionWeb/*` envelope is stubbed at Playwright and the two print
routes read checked-in fixtures. 259 is the wave-joining event.
