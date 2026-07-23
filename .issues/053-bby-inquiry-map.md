---
type: wayfinder-map
status: done
---

# 053 — BBY Inquiry screen (react rebuild of WPF BbyInquiry)

## Destination

An **approved, `/to-tickets`-ready spec** for a read-only **Bonus Buy (BBY) Inquiry** screen in
oms-react that answers "what promotions are active now, and what does each one actually do?" The
spec must pin:

- a **summary grid** defaulting to currently-active BBYs, searchable to *all* BBYs by **BBY number**
  or a **validity-window-overlap date range**;
- a per-row **Details modal** mirroring the SAP "Display Bonus Buy" layout (header + Buy prereqs +
  Get conditions), sourced from the richer `BbyModel` — reference:
  `C:\Work\DMSCO\BackOffice\Sartawi.POS\BB\PotentialBonusBuys\BonusBuyDetailController.cs`;
- the **two backend contracts** the frontend needs (list-search endpoint + detail-by-number
  endpoint) as *designed contracts* — the endpoints themselves are built separately on SIS.Api.

Building is a later `/to-tickets` → `/implement` pass; this map produces the locked spec plus two
prototypes to react to.

## Notes

Domain: Pricing / Bonus Buy (BBY = SAP "Bonus Buy" promotion). Consult `CONTEXT.md` (glossary) and
`/domain-modeling`; overlaps the sim promo-visibility work (map 039, tickets 039–052) which already
models `BbyPrereq → reward`. Every session: `/grilling` + `/domain-modeling` for decision tickets,
`/research` for AFK reads, `/prototype` for the two UX tickets.

**Grounding facts (from the WPF sources):**
- `BbyHeader` (flat, 28 fields) backs the WPF grid — `BbyInquiryView.xaml` lists the columns;
  `ValidFrom`/`ValidTo` are `yyyyMMdd` **strings**, `ValidFromTime`/`ValidToTime` are `HHMMSS`
  strings, `BbyStatus` is a code (A=Activated / I=Inactive / D=Draft / X=Deleted).
- The WPF `BbyInquiryController` has **no API** — it queries NHibernate directly (top 1000 by
  `CreatedAt`, client-side auto-filter) and offers Refresh + Export-to-Xlsx.
- The Details view (`BonusBuyDetailController`) renders a **`BbyModel`** (Prereqs=Buy,
  Conditions=Get, ItemConditions, material-grouping members, `CondTargetType=Document` total-
  discount mode) resolved via `IBonusBuyRepository.GetBonusBuyByNumber(bbyNumber)`. It also joins
  *live basket status* — **out of scope here** (inquiry has no basket).
- No SIS.Api read endpoint for BBY exists today (only `BonusBuyDownloadGrantEndpointFilter`).
- All server calls go through `src/core/api.ts` (api-envelope rule); the screen is a new feature
  under an area (feature-structure rule) — likely `features/pricing/…`, TBD by ticket 056.

## Decisions so far

<!-- destination shape fixed by the charting grill (2026-07-20): -->

- Destination is a **locked spec + prototypes**, not a build (wayfinder default). Backend is a
  **designed contract / boundary** — the endpoints are built separately.
- **Default view = currently-active**, but search (by number, or validity-overlap date range)
  surfaces inactive/past/future BBYs too.
- **Date-from/to search = validity-window overlap** (`ValidFrom`/`ValidTo`), i.e. "active during
  this period", not `CreatedAt`.
- **Fields UX** (as charted: summary grid + Details modal) — **refined by
  [059](059-bby-list-search-ux-prototype.md)**: the grid carries the **full 28-field header** (operator
  scans/filters/exports by header fields), and the Details modal is kept **on-demand** for the Buy→Get
  condition rows the header can't show. Full-header grid **and** a Details drill, not one instead of
  the other.
- [Bonus Buy domain model & glossary](054-bby-domain-glossary.md) — ubiquitous language pinned in
  `CONTEXT.md` (Buy→Get primary; `BbyPrereq`/`BbyCond` data terms; status A/I/D/X **display-only**).
  **"Active" = `BbyStatus=="A"` AND `ValidFrom≤today≤ValidTo`** (header-only string compare; a *new*
  concept — WPF never filtered). Non-active reachable via search. Engine's real gate is a separate
  `SyncApprovalStatus`, deliberately not reproduced.
- [Feature placement, nav & access gate](056-bby-feature-placement-access.md) — folds into the
  existing **Pricing** area (`/pricing/bonus-buy-inquiry`, folder/namespace `bonus-buy-inquiry`,
  "BBY Inquiry" leaf + `Search` icon); **gated** like `bonus-buy-download` via an `accessProbe` on a
  `BbyInquiry` screen grant (`screenAllowed`) — the `Web/Access` probe is a flagged backend contract.
- [Research: full BbyModel detail shape for the Details modal](055-bbymodel-detail-shape-research.md) —
  detail endpoint exists **only** for 3 child collections (Prereqs/Conditions/ItemConditions); every
  header scalar is already on flat `BbyHeader`. `GetBonusBuyByNumber` returns a clean POCO tree
  (JSON-serializable, cached per-BBY). Org fields + material `Description` are **not** on `BbyModel`
  (must be projected/enriched server-side). Two BackOffice defects (BbyCond202 never loaded; free-goods
  `N` throws) to design around in 058. Full inventory + code sets in
  [055-bbymodel-field-inventory.md](055-bbymodel-field-inventory.md). This unblocks 058 & 060.
- [Detail-by-number endpoint contract](058-bby-detail-endpoint-contract.md) — **two endpoints**:
  `GET Bby/Detail?bbyNumber=` returns a self-contained `BbyDetailDto` (header + `org` block projected
  server-side off **BbyCond000** + `buy[]`/`get[]` rows with `description` enriched inline, or a
  `totalDiscount` card when `condTargetType==='R'`); `GET Bby/GroupingMembers?…&side&groupingKey&page`
  is a **lazy, paged** member endpoint (members reach ~1000 SKUs — modal drilldown, ticket 060). `N`
  free-goods **dropped** (new engine = 100%-discount Get); not-found ⇒ business `BBY_NOT_FOUND`/404.
  Backend defects (Condition null off repo, BbyCond202 copy-paste, `N` throw) flagged to design around.
- [Details modal prototype (SAP "Display Bonus Buy" mirror)](060-bby-detail-modal-prototype.md) —
  **approved** ([prototype](060-bby-detail-modal-prototype.PROTOTYPE.html) /
  [artifact](https://claude.ai/code/artifact/f8efdfe3-7971-49b6-9c0b-d1ffcd805d19)). Title bar →
  **split-panel** Header (Organisation + Header/rules) → **Buy** → link strip → **Get** / total-discount
  card. Line items = **lightweight read-only tables** (not AG-Grid); grouping rows open a **paged
  members drilldown** (Endpoint B). Document `R` collapses Get to one discount card; loading skeleton +
  `BBY_NOT_FOUND` states; codes→`t()` labels. Unblocks nothing new — feeds `/to-spec`.
- [List/search endpoint contract](057-bby-list-search-endpoint-contract.md) — `GET Bby/List`;
  **exact-match** `bbyNumber`, validity-**overlap** on `yyyyMMdd` **strings** (`ValidFrom≤validTo AND
  ValidTo≥validFrom`, ordinal compare — no server parse), `activeOnly` (default true, pure-function
  param the client clears on any search), `CreatedAt DESC` **top-1000 cap** (no paging; `capReached`
  flag). Row DTO = **full 28-field `BbyHeader` parity**, raw codes/dates (+ derived `isActive`).
  Envelope: 400 `INVALID_DATE_*`, 403 `ACCESS_DENIED` = real gate. Folds in the access probe:
  `GET Bby/Access → {screenAllowed}`, **fail-open (shown) while the probe 404s**. Unblocks 059.
- [List + search UX prototype](059-bby-list-search-ux-prototype.md) — **approved**
  ([prototype](assets/059-bby-list-search-prototype.html) /
  [artifact](https://claude.ai/code/artifact/29051a87-8d77-416b-a137-0eabb931c7f7)). Toolbar = exact
  number + validity-overlap date-range + **Active-only** toggle (default on; any search auto-clears it,
  Reset restores). Grid = the **full 28-field header** (grouped headers · sticky Status+№ identity col ·
  sortable · toggleable per-column filter row) — the operator scans/filters/exports by header field, so
  the whole header is on the grid, **not** a curated summary. **Grid tech = AG Grid Community** (themed
  via its token API; reverses the 7-col-era hand-rolled pick — a wide Excel-like table is AG Grid's
  strength, unlike the sim grid). **Export = v1, CSV** of all 28 raw fields (resolves the Export fog;
  xlsx deferred). **Details ▸** kept **on-demand** (opens the 060 modal). States: cap banner / empty /
  loading. Feeds `/to-spec`.

## Not yet specified

<!-- fog toward the destination — graduates into tickets as the frontier advances -->

<!-- Export fog RESOLVED by 059: CSV of all 28 fields is v1 (AG Grid Community); xlsx a later ticket. -->
<!-- BbyHeaderHistory fog RULED OUT OF SCOPE (see Out of scope): v1 is current-state inquiry. -->

_None — the way to the destination is clear. All child tickets (054–060) resolved; both UX
prototypes approved._ **Destination reached: spec [061](061-bby-inquiry-spec.md) published
(`status: ready`) — consumable by `/to-tickets`.**

## Out of scope

<!-- ruled beyond the destination -->

- **`BbyHeaderHistory` / any header-change audit-trail affordance** — v1 is a **current-state**
  inquiry (destination: "what's active *now*, and what does each do?"); the WPF screen has no history
  view and both prototypes settled on current state. A history view returns only as a fresh effort if
  the scope is redrawn.

- **Live basket / offer-status** columns in the Details modal (the WPF drilldown's `LiveStatus`
  join) — inquiry has no transaction context.
- **Editing / creating / downloading** BBYs — this is inquiry-only. ("Downloading" = publishing a BBY
  to stores/engine via the download-grant; distinct from the in-scope **CSV export** of the inquiry
  grid, decision 059.)
- **Building the SIS.Api endpoints** — designed here as contracts, implemented in the backend repo.
