---
status: open
spec: 249
blocked-by: 250, 253
---

# 254 — Cash Collections opens on today and pages in the browser

## What to build

The first real screen, and **the template the other three copy**. Everything settled here is
structural: the criteria draft, the landing state, the paging model, the column split and the filter
row. [255](255-acrs-and-attempts-list-on-the-same-template.md) and
[256](256-deposits-shows-its-lines-and-balances.md) are variations on it.

**Templated on `features/pricing/bonus-buy-inquiry`** — the only screen in this repo built to the same
WPF skeleton these four descend from: access gate → toolbar producing a **criteria draft** that only
Search/Reset promote to a query → AG Grid → row action → export, plus the cap banner. Deliveries was
rejected as the template: saved grid views and `ViewManager` are machinery four read-only grids would
inherit and never use.

⚠ **Copied, not extracted.** No shared inquiry shell in `core/` — the abstraction would be designed
before four screens exist to prove it, and a feature may not import a feature. "Copy" here is literal
duplication of a *shape*, not of code.

**Landing on today, auto-loaded.** From/To default to **today** and the search fires on mount, so the
screen answers "what has come in today" before anyone touches a control. The WPF loads nothing until
`Load` and defaults no dates — but its own `CloseActionInquiry` and `DocumentPayment` do default to
today, so this follows the house pattern rather than inventing one. Known cost, accepted: at 9am
"today" is nearly empty and yesterday's closures are one date edit away. Dates travel **as a pair**,
per the server contract.

**Filters:** From · To · Store · Collector. A **criteria draft** that only Search commits — a
half-typed filter never fires a query. Reset returns the landing state (today, everything else
cleared). Empty filters are dropped rather than sent as `''`.

**Volume — the `Limit` box is deleted.** The scope of this screen is **HQ-wide**: both roles see every
store, and the server's `StoreId` is a filter, not a guard. A normal day across the chain is hundreds
of rows, so the WPF's `Limit = 200` truncates daily and **silently**. The web asks for a generous
`Limit` (~2,000) and renders the whole result into **AG Grid's built-in client-side pagination at
50/page**. `Limit` stops being a user-facing field and becomes a system cap, surfaced only by an
**amber banner that fires when the result actually reached it** — not merely when it is large.

⚠ **True server paging was rejected and should not be reintroduced without revisiting
[244 §3](244-four-inquiry-screens-in-our-clothes.md).** `@/core/ui/GridPager` is the idiom Ua Users
and Loy Actions use, but none of the four endpoints has `Skip`/`Offset`/a total count — only `Limit` —
so it would mean real `OFFSET/FETCH` + `COUNT` SQL on four endpoints on top of the doors, *and* it
would confine sort, per-column filter and export to the current page. Client paging keeps all three
operating over the whole result set, which is what [258](258-the-export-writes-a-summable-file.md)
depends on.

**Columns — reordered, with a forensic tail behind a toggle.** The WPF shows all 19; the web leads
with identity and money in reading order and folds the rest behind a **More columns** toggle.
**Nothing is dropped, only folded.**

- Default: `Receipt No#`, `Store`, `Store Name`, `Collector`, `Collected`, `Net Collected`,
  `Variance`, `Card Total`, `Reason`.
- Behind the toggle: `Opened`, `Closed`, `System Cash`, `Counted Cash`, `Float`, `Counted (Net)`,
  `Card Slips`, `Reason Detail`, `Collector Id`, `Z Reports`.

**The floating per-column filter row is ON by default.** Every WPF grid ships
`ShowAutoFilterRow="True"`, and it earns its keep: with an HQ-wide result and only four server
filters, the per-column row is how you find one store's variance without re-querying. ⚠ This
deliberately **inverts BBY Inquiry's** default (off, behind a toggle); the toggle still exists to
reclaim the height.

**Money** renders through `@/core/money.ts` (ticket 250): right-aligned, grouped, to the **row's own
currency's decimals**, **blank rather than `0.00`** for a missing figure, with the **currency code in
the column header** rather than repeated per cell.

## Spine reach

api (mocked) · logic (criteria, columns, cap) · component · route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `criteria.test.ts` — the today-defaulted date **pair**; a draft edit that does **not** produce
      a query until Search; Reset restoring the landing state; empty filters **dropped, not sent as
      `''`** · pure (prior art: `nphies/*/list-params.ts`, bby-inquiry)
- [ ] `columns.test.ts` — the forensic tail **hides nothing**: every field on the wire row appears in
      exactly one of the two groups, and their union is the whole row. This is the assertion
      [258](258-the-export-writes-a-summable-file.md) leans on · pure
- [ ] `cap.test.ts` — the banner fires when the result **reached** the cap and stays silent when it is
      merely large · pure
- [ ] `tools/collection-drive.mjs` extended — the screen loads **already populated with today** with
      no click; Search/Reset behave; the grid pages at 50 with the whole set present; the More-columns
      toggle reveals the tail; the floating filter row is **visible on arrival**; money is
      right-aligned with the currency in the header and a missing figure is **blank, not `0.00`** ·
      flow (Playwright)

## Boundaries

- **New API dependency:** `CollectionWeb/Collections` — **mocked here.** Backend
  [1090](file:///C:/Work/DMSCO/BackOffice/.issues/1090-a-browser-reaches-the-four-collection-inquiries.md)
  owns the door; [259](259-the-screens-call-the-real-door.md) joins them. All calls go through
  `@/core/api` per the `api-envelope` rule — no raw `fetch`, even against a mock.
- i18n keys into the `collection` namespace created by 253.
- No row action yet — [257](257-a-row-opens-its-document.md) adds it.
- No export yet — [258](258-the-export-writes-a-summable-file.md) adds it.

## Done when

`/collection/collections` opens showing today's collections without a click, pages at 50 over the
whole mocked result, toggles its forensic tail, filters per column on arrival, and banners only on a
genuine cap; the three pure tests and the drive are green.

## Blocked by

- [250](250-money-graduates-to-core.md) — money columns render through the graduated module.
- [253](253-the-collections-group-appears-only-for-a-granted-session.md) — the area, route and gate.
