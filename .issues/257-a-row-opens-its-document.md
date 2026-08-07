---
status: open
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

- [ ] `acr-scope.test.ts` — with `?acr=` set: which filters are **overridden and disabled**, that the
      criteria sent carry `AcrId` and **omit** store/collector/period entirely, and that clearing
      restores the ordinary today-defaulted criteria. Round-trips through the URL · pure
- [ ] `tools/collection-drive.mjs` extended — `Collections ▸` from an ACR row lands on Cash Collections
      with the chip present and the four filter inputs **visibly disabled**; removing the chip drops
      the param and restores today; the URL is shareable (reload reproduces the scoped view);
      `Receipt ▸` and `Form ▸` carry `target=_blank` and resolve to a rendering document · flow
      (Playwright)

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
