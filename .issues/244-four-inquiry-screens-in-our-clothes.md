---
type: wayfinder-ticket
wayfinder: grilling
map: 240
status: done
blocked-by: —
---

# 244 — Four inquiry screens in our clothes

## Question

The documents are facsimiles; the screens around them are ours. Settle the shape of all four —
Collection Inquiry, ACR Inquiry, Deposit Inquiry, Collection Attempts — as one conversation, since
they are variations on a single template.

Grill the user on:

- **The template.** The WPF versions are all modelled on `SalesRequestInquiry` — filter strip,
  read-only grid, Find/Clear/Export, a row action. Does the web reuse an existing oms-react inquiry
  screen as its template, and which one? (`features/oms/deliveries` and the BBY Inquiry screen are
  the candidates.)
- **Filters and defaults.** WPF Collection Inquiry offers store / collector / from–to date, with a
  `Limit` of 200. What does a supervisor actually filter by first, what is the default period, and
  what happens on an unfiltered Find. Same pass over the other three.
- **Columns.** Which columns each grid shows, in what order, and which are money (and therefore
  currency-aware). The WPF grids are the starting point, not the answer — the user may have been
  living with columns they never use.
- **Row actions and drill-down.** Collection Inquiry's `ViewReceiptCommand` opens the سند قبض.
  ACR Inquiry has a Detail button that scopes Collection Inquiry to one ACR's collections
  (`AcrId` as an exclusive filter) *and* a form button that opens the ACR document. How does that
  drill-down read on the web — a route, a filtered navigation, a side pane?
- **Nav placement and naming.** Which area (`features/oms/*` or a new one), which URL prefix, what
  the menu group is called, and what each item is called in English for an en-only UI whose
  documents are Arabic.
- **Who gets in.** The supervisor and the accountant — one permission or two? Do they see the same
  four screens? Does either see stores other than their own? Note what `243` finds about the
  existing WPF permission names and reconcile.
- **Paging and volume.** How many collections a supervisor's typical period returns, and whether
  these grids page (the `GridPager` in `@/core/ui`) or cap like the WPF `Limit`.

Use `/grilling` and `/domain-modeling`; fold any new vocabulary into `CONTEXT.md`.

## Answer

All four screens are **one feature in a new area**, templated on BBY Inquiry, opening on today and
paging in the browser. The WPF's `Limit` box does not survive the port; nothing else about the
skeleton changes.

### 1. The template — BBY Inquiry's shape, copied, not extracted

`features/pricing/bonus-buy-inquiry` is the only screen in this repo built to the same WPF
skeleton these four descend from: access gate → toolbar producing a **criteria draft** that only
Search/Reset promote to a query → AG Grid → row action → export, plus the cap banner. Deliveries
was rejected as the template: saved grid views and `ViewManager` are machinery four read-only
grids would inherit and never use.

**Copied, not extracted.** No shared inquiry shell in `core/` — the abstraction would be designed
before the four screens exist to prove it, and a feature may not import a feature, so "copy" here
is literal duplication of a *shape*, not of code.

### 2. One feature, in a new top-level area

`src/features/collection/` — **a new area**, not `features/oms/`. The rule ties folder = URL
prefix = menu group, and this is a finance surface (collection supervisor, accountant), not order
management; four items would have made the OMS group five items of two unrelated kinds. It follows
`callcenter`, `loy` and `nphies`, each of which minted its own group the same way. The WPF's
`Retail\OMS\` heritage was weighed and discounted — that folder is a grab-bag (Coupons, Nupco,
Slots, Reports).

One feature, not four siblings: the rule's "tight cluster of screens". Four Pages, one `api.ts`
over all five endpoints, one `collection` i18n namespace, both document renderers, and the shared
helpers as **relative** imports — four siblings would have forced every one of those up into
`core/` before the second screen was built. The `246`/`247` prototypes already sit at
`features/oms/collection/__prototype__/{voucher,acr}/` and **move** to `features/collection/`.

| Menu item | Route |
|---|---|
| Cash Collections | `/collection/collections` |
| ACRs | `/collection/acrs` |
| Deposits | `/collection/deposits` |
| Collection Attempts | `/collection/attempts` |

Group label **Collections**. Document print routes: `/collection/receipt/:receiptNo`,
`/collection/acr/:acrId`.

### 3. Volume — the `Limit` box is deleted, the browser pages

**The scope is HQ-wide**: the supervisor and the accountant both see every store — there is no
per-store scoping on any of these screens, and the server's `StoreId` is a filter, not a guard. A
normal day across the chain is **hundreds of rows**, so the WPF's `Limit = 200` truncates daily
and silently.

The web asks for a generous `Limit` (~2,000) and renders the whole result into **AG Grid's
built-in client-side pagination at 50/page**. The amber cap banner fires only when the result
actually reached the limit.

**Rejected: true server paging** (`@/core/ui/GridPager`). It is the idiom Ua Users and Loy Actions
use, but none of the four endpoints has `Skip`/`Offset`/a total count — only `Limit` — so it means
real SQL (`OFFSET/FETCH` + `COUNT`) on four endpoints *on top of* the five doors 243 already
sized, and it would confine sort, per-column filter and Export to the current page. Client paging
keeps all three operating on the whole result set. **`Limit` therefore stops being a user-facing
field** — it becomes a system cap.

### 4. Landing state — today, auto-loaded, all four

From/To default to **today** and the search fires on mount. The WPF loads nothing until `Load` and
defaults no dates (unlike its own `CloseActionInquiry`/`DocumentPayment`, which do default to
today) — the web answers "what has come in today" before anyone touches a control. Always under
the cap; widening is one date edit. Uniform across all four, which is what makes them one
template. Known cost, accepted: at 9am "today" is nearly empty and yesterday's closures are one
edit away. Dates still travel **as a pair**, per the server contract.

### 5. Filters — the server's own `Options`, minus `Limit`

| Screen | Filter strip |
|---|---|
| Cash Collections | From · To · Store · Collector *(+ the `?acr=` chip)* |
| ACRs | From · To · ACR No# · Collector · Status *(All / OPEN / CLOSED, segmented)* |
| Deposits | From · To · Deposit No# · Collector · Bank · Status *(All / POSTED / VOID)* |
| Collection Attempts | From · To · Store · Collector · Reason code |

The WPF's `""`/`OPEN`/`CLOSED` and `""`/`POSTED`/`VOID` radio groups become segmented controls.

### 6. Columns — reordered, with a forensic tail behind a toggle

WPF shows every field it has: 19 columns on Cash Collections, 15 on ACR, 15 on Deposit, 9 on
Attempts. The web leads with identity and money in reading order and folds the rest behind a
**More columns** toggle beside the filter-row toggle. Nothing is dropped, and **Export always
writes every field regardless of what is shown** (the BBY precedent).

Cash Collections, as the worked example — default: `Receipt No#`, `Store`, `Store Name`,
`Collector`, `Collected`, `Net Collected`, `Variance`, `Card Total`, `Reason`. Behind the toggle:
`Opened`, `Closed`, `System Cash`, `Counted Cash`, `Float`, `Counted (Net)`, `Card Slips`,
`Reason Detail`, `Collector Id`, `Z Reports`.

**The floating-filter row is ON by default** — every WPF grid ships `ShowAutoFilterRow="True"`,
and it earns its keep: with a HQ-wide result and only four server filters, the per-column row is
how you find one store's variance without re-querying. This deliberately **inverts BBY's** default
(off, behind a toggle); the toggle still exists to reclaim the height.

### 7. Money — `money.ts` graduates to `@/core`

Every row carries `CurrencyKey`, and `features/loy/member/money.ts` already solved this exact
problem (`currencyDecimals`: KSA + Bahrain, BHD the estate's only 3-decimal currency; fixed
`en-US` grouping so two readers never see the same line differently; **blank, not `0.00`**, for a
missing figure; the sign left as the row's own). A feature may not import a feature, so it
**moves up to `@/core/money.ts`** and Loy imports it from there — exactly how `pager.ts` graduated
at ticket 232 when it acquired its second consumer.

Money columns render right-aligned, grouped, to the row's own currency's decimals, with the
**currency code in the column header** rather than repeated per cell (per-cell only if a result
can ever mix currencies).

### 8. Row actions and the ACR drill-down

- **Cash Collections** → `Receipt ▸` opens `/collection/receipt/:receiptNo` **in a new tab**.
- **ACRs** → `Collections ▸` routes to `/collection/collections?acr=<AcrId>`; `Form ▸` opens
  `/collection/acr/:acrId` **in a new tab**.
- **Deposits** → no document; slips are ordinary links opening in a new tab (all `Open Slip(s)`
  ever did).
- **Collection Attempts** → **none**, matching the WPF, which withholds one deliberately: an
  attempt is immutable evidence, not a voucher.

**The drill-down.** `?acr=` opens Cash Collections scoped to that ACR, showing a removable chip
that visibly **overrides and disables** From/To/Store/Collector — which is honest, because the
server treats `AcrId` as an **exclusive** filter and ignores store/collector/period entirely.
Clearing the chip drops the param and returns the ordinary today-filtered screen. One grid, one
column set, one shareable URL; the WPF opens a second window to the same effect, and this reuses
the `?bby=` deep-link idiom. A side pane and an AG Grid master-detail row were both rejected — the
latter is an Enterprise feature we do not have.

**New tab, not overlay.** The grid keeps its search, scroll and selection, and a document becomes
an address that can be pasted into a ticket. `Acr/Report?acrId=` makes the ACR side free; **the
receipt side is not** — `CollectionInquiry` has no receipt-number filter, so a by-number lookup is
a real (small) server change. Homed in
[245](245-the-shape-of-a-print-ready-document.md), which already owns "what identifies a
document".

### 9. Deposit Inquiry — the one screen that isn't a flat list

`{ Rows, Balances }`, each row carrying `Lines` and `Attachments`. Rendered **stacked, as the WPF
has it**: the deposit grid; below it a detail region following the selected row (its claimed-ACR
lines with drift flagged, its slips as links); below that the **per-collector balance** table in a
collapsible panel labelled *POSTED only*. Everything arrives in the one response, so no region
costs a fetch. A detail modal was rejected — a deposit whose banked total no longer matches is
precisely what the accountant opens this screen to find, and drift should be visible in place.

### 10. Permissions — four existing grants, one probe

The four WPF `ControllerID` grants are reused **unchanged** (`CollectionInquiry`, `AcrInquiry`,
`DepositInquiry`, `CollectionAttempts`), so a WPF user's existing rights carry to the web and no
new permission is designed or seeded. **Supervisor vs accountant is pure grant assignment, not
screen design** — both see whatever finance assigns them; neither is scoped to a subset of stores.

One `Collection/Access` probe returns all four booleans in a single call (the menu needs them at
once); each menu item appears only if granted and the **group is hidden entirely when none are**.
A **ragged group is allowed** — a user granted only Deposits sees one item, not three that would
refuse them. The endpoint grant filter remains the real boundary; the probe only hides the menu.

### Deliberately not decided here

- **The receipt's by-number lookup** → [245](245-the-shape-of-a-print-ready-document.md).
- **Export format** (the WPF grids export **XLSX**, not CSV — `CollectionAttemptsController`
  documents "pure read + XLSX grid export") → [248](248-whether-the-web-owes-a-spreadsheet.md),
  which this ticket unblocks. All four screens carry an Export button; its output is 248's call.
- **Mocking and wave sequencing** — 243 already ruled mocking *required*; 245 owns it.

### What this closes on the map

The fog patch *"Deposit Inquiry and Collection Attempts in detail"* is **answered here, not
graduated**: both screens' columns and filters are settled above, Deposit's balance summary earns
its own stacked surface, and neither justifies a ticket of its own — they are two of the four
variations on the one template this ticket settled. Collection Attempts in particular is the
smallest screen in the suite (one flat list, no document, no row action).

Four terms folded into `CONTEXT.md`: **collection**, **ACR**, **deposit**, **collection attempt**.
