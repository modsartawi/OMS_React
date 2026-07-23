---
type: spec
status: ready
map: 053
---

# 061 — Bonus Buy (BBY) Inquiry screen (spec)

> Synthesized from wayfinder map [053](053-bby-inquiry-map.md) and its resolved tickets
> ([054](054-bby-domain-glossary.md) glossary · [055](055-bbymodel-detail-shape-research.md) detail
> research · [056](056-bby-feature-placement-access.md) placement/access · [057](057-bby-list-search-endpoint-contract.md)
> list contract · [058](058-bby-detail-endpoint-contract.md) detail contract · [059](059-bby-list-search-ux-prototype.md)
> list/search prototype · [060](060-bby-detail-modal-prototype.md) details-modal prototype). Consumable by `/to-tickets`.

## Problem Statement

A pricing operator needs to answer two everyday questions about Bonus Buy (BBY) promotions — *"which
promotions are active right now?"* and *"what does this specific promotion actually do — what must a
shopper buy, and what do they get?"* — without touching SAP or the WPF back-office client.

Today the only way to inspect BBYs is the legacy WPF `BbyInquiry` screen, which queries the database
directly (no API), lists the newest 1,000 rows with a client-side auto-filter, and opens a SAP-style
"Display Bonus Buy" detail view per row. The react back-office portal has no equivalent, so a web
operator has no read access to Bonus Buy data at all. This is a **read-only inquiry** — no create,
edit, download, or basket context — the operator is looking things up, not changing them.

## Solution

A new **BBY Inquiry** screen in the Pricing area (`/pricing/bonus-buy-inquiry`) that:

- Opens on the **currently-active** BBYs (status Activated **and** valid today) — the operator's most
  common question answered with zero clicks.
- Offers a search toolbar to reach **all** BBYs (any status, any validity window): exact **BBY
  number** lookup, and a **validity-overlap date range** ("active during this period"), plus an
  **Active only** toggle (default on) that any search auto-clears.
- Presents results in a wide, Excel-like **AG Grid** carrying the **full 28-field header**, with
  grouped column headers, a sticky Status + BBY-number identity column, sort, an on-demand per-column
  filter row, and **CSV export** of the current result set.
- Opens a per-row **Details modal** mirroring SAP "Display Bonus Buy": a header/organisation recap →
  **Buy side** (prerequisites) → **Get side** (conditions), or a single **total-discount card** in
  Document mode — with a lazy, paged **grouping-members drilldown** for material-grouping rows.
- Is **permission-gated** (the `BbyInquiry` screen grant) the same way the sibling Bonus Buy Download
  screen is, while degrading gracefully until the backend access probe ships.

All server data comes from three **designed-but-not-yet-built** SIS.Api endpoints under the `Bby/*`
prefix, consumed through `src/core/api.ts` per the api-envelope rule. Until they exist the feature is
built code-complete against the contracts (typecheck-green, driven with mocked envelopes), matching
the Notification Center / cache-reset posture already on this repo.

## User Stories

### Access & navigation

1. As a pricing operator with the `BbyInquiry` grant, I want a **BBY Inquiry** leaf under the Pricing
   menu group (lucide `Search` icon), so that I can find the screen alongside Simulation, Bonus Buy
   Download, and Coupons.
2. As an operator without the grant, I want the menu leaf **hidden**, so that I'm not shown a screen I
   can't use.
3. As an operator without the grant who deep-links to `/pricing/bonus-buy-inquiry`, I want an in-page
   **"access denied"** card rather than a broken screen, so that the boundary is clear.
4. As a platform maintainer, I want the nav-hide and the in-page guard to share **one** access probe
   call (one react-query cache entry keyed `['bonus-buy-inquiry','access']`), so that opening the app
   costs one network round-trip, not two.
5. As an operator, while the backend access probe **does not yet exist** (404 / network error), I want
   the screen to **fail open (shown)**, so that a read-only inquiry isn't blocked by a missing UX
   probe — the list endpoint's own `403 ACCESS_DENIED` remains the real security boundary.
6. As an operator, once the probe exists and returns `screenAllowed:false`, I want the leaf and route
   **hidden/denied**, so that the gate takes effect the moment the backend ships it.

### Default view

7. As an operator, I want the screen to **open showing currently-active BBYs** (status `A` AND
   `ValidFrom ≤ today ≤ ValidTo`) with no criteria entered, so that my most common question is answered
   immediately.
8. As an operator, I want each row's **"active now"** state marked (a green "valid today" marker on the
   identity cell driven by the server `isActive` flag), so that active status reads at a glance without
   me re-checking the dates.
9. As an operator, I want the grid **newest-first** (`CreatedAt` descending), so that recently-created
   promotions are at the top.

### Search & filter

10. As an operator, I want an **exact BBY-number** field, so that when I know the number I jump
    straight to that promotion (including inactive or deleted ones).
11. As an operator, I want issuing a **number search to auto-clear "Active only"**, so that a keyed
    lookup finds the BBY regardless of its status or validity.
12. As an operator, I want **"active during" from/to date pickers** that match on **validity-window
    overlap** (`ValidFrom ≤ to AND ValidTo ≥ from`), not creation date, so that I find every promotion
    that was/is/will be live in a period I care about.
13. As an operator, I want a **half-open range** to work — only a "from" (everything valid on/after it)
    or only a "to" (everything valid on/before it), so that I'm not forced to bound both ends.
14. As an operator, I want an **Active only** toggle defaulting **on** (sublabel "status A & valid
    today"), which any search (number or date) auto-clears and which shows a dismissable "filtered"
    chip, so that I always know whether I'm looking at the active default or a wider result.
15. As an operator, I want a **Reset** that returns to the active-only default with cleared criteria,
    so that I can get back to the home view in one click.
16. As an operator, I want the toolbar fields to **AND together**, so that a number + date range
    narrows rather than widens.
17. As an operator, I want a **per-column filter row** I can toggle on the grid (the WPF
    `ShowAutoFilterRow`), so that I can narrow the loaded result set by any field client-side without a
    round-trip.
18. As an operator, I want **sortable columns**, so that I can reorder the loaded set by validity,
    min/max, score, etc.

### The grid (full 28-field header)

19. As an operator, I want the grid to carry **all 28 header fields** — not a curated summary — so that
    I can scan, filter, and export by any header attribute (includes/excludes, loyalty tier, min/max,
    stacking, condition-target).
20. As an operator, I want the columns **grouped** under readable headers (Identity & offer · Validity ·
    Buy/Get rules · Stacking · Loyalty · Audit), so that 28 columns stay navigable.
21. As an operator, I want a **sticky Status + BBY-number identity column**, so that the row I'm reading
    is never lost when I scroll right through the wide table.
22. As an operator, I want raw codes rendered as **readable chips** (`R`→Document, `A`/`O`→And/Or,
    status A/I/D/X as a labelled badge), booleans as ✓/–, dates `yyyyMMdd→yyyy-MM-dd`, and times
    `HHMMSS→HH:mm`, so that the grid is legible — while the **underlying raw values are preserved for
    export**.
23. As an operator, I want a **Details ▸** action in the sticky identity column of each row, so that I
    can open the full SAP-style breakdown for that promotion.

### Result-set states

24. As an operator, when my result hits the **1,000-row cap**, I want an amber banner ("first 1,000,
    newest first — narrow your search"), so that I know the list is truncated and how to refine it.
25. As an operator, when a search matches **nothing**, I want a proper empty state, so that I can tell
    "no matches" apart from "still loading".
26. As an operator, while a search runs I want a **shimmer skeleton**, so that the screen reads as busy
    rather than broken.
27. As an operator, if my date input is **malformed or reversed** (`validFrom > validTo`), I want the
    server's business message surfaced (`INVALID_DATE_FORMAT` / `INVALID_DATE_RANGE`), not a generic
    "unexpected", so that I can fix my input.
28. As an operator, if the list call is **forbidden** (`403 ACCESS_DENIED`), I want the mapped business
    message, so that a permission failure explains itself.

### Export

29. As an operator, I want a **CSV export** of the current (filtered) result set covering all 28 raw
    header fields, so that I can open the data in Excel — the react equivalent of the WPF
    Export-to-Xlsx.
30. As an operator, I accept **CSV in v1** (xlsx deferred), so that export ships without waiting on an
    Enterprise grid feature or a server endpoint.

### The Details modal — header/organisation

31. As an operator, I want the Details modal titled with the **BBY number + status badge + validity
    badge + description**, so that I know exactly which promotion I opened and whether it's live.
32. As an operator, I want an **Organisation** panel (sales-org, distribution channel, plant, currency),
    so that I see the scope the promotion applies to. *(These org fields are projected server-side off
    `BbyCond000` — not on the flat header.)*
33. As an operator, I want a **Header & rules** panel (promo, offer, profile, status, validity window
    with times, condition target, limit, link Buy/Get, min/max, stackability, score, loyalty
    groups/tiers, includes/excludes), so that the promotion's settings are recapped in one focused place
    while I look at its conditions.

### The Details modal — Buy → Get

34. As an operator, I want a **Buy side** table (line position, material/grouping identifier + enriched
    description, kind, quantity + unit, min value) showing what the shopper must buy, with the side's
    **link category** (AND/OR) labelled, so that I understand the prerequisites.
35. As an operator, I want a **Get side** table (condition number, material/grouping + description,
    discount value + type, scale, quantity/pricing unit, condition type), so that I understand what the
    shopper receives.
36. As an operator, I want the discount **value formatted by type** — percentage shows `condValueP`
    with `%`, fixed shows `condValue` with the currency — so that the number reads correctly.
37. As an operator, I want a **"then" link strip** between Buy and Get, so that the buy→get relationship
    reads as a sequence rather than two unrelated tables.
38. As an operator, I want the Buy/Get lists rendered as **lightweight read-only tables** (not full AG
    Grid instances), so that a 1–3-row breakdown stays simple; large member sets never render inline.

### The Details modal — Document total-discount branch

39. As an operator, when a promotion is **Document mode** (`condTargetType === 'R'`), I want the Get
    grid replaced by a **single total-discount card** — the discount figure + type + condition type +
    the basket requirement (`header.minValue`), so that a basket-level percentage (e.g. an Al-Rajhi card
    5%-off-basket) reads as one clear figure.
40. As an operator, in Document mode I want the Buy side to show an **empty note** ("qualification is
    basket value") rather than a blank table, so that I understand there are no line prerequisites.

### The Details modal — grouping-members drilldown

41. As an operator, when a Buy or Get row is a **material grouping**, I want an inline **"N members"**
    chip, so that I can see it stands for many SKUs.
42. As an operator, I want clicking that chip to open a **members drilldown** (material number,
    description, quantity, unit), so that I can see exactly which SKUs the grouping covers.
43. As an operator, I want the members list **paged** (server-side, per-page description enrichment), so
    that a grouping with ~1,000 SKUs opens quickly and never bloats the detail payload.
44. As an operator, I want the drilldown to work for **both** Buy-side groupings (keyed by
    `matGrouping`) and Get-side groupings (keyed by `condNumber`), so that either side's memberships are
    inspectable.

### The Details modal — states & loading

45. As an operator, I want the modal to show a **loading skeleton** while the detail loads, so that the
    open feels responsive.
46. As an operator, if the number resolves in the list but has **no detail record**, I want a clear
    **"Bonus Buy not found"** card (server `BBY_NOT_FOUND`, HTTP 404 as a business outcome), not an
    "unexpected" crash, so that the rare gap is explained.
47. As an operator, I want to close the modal via the ✕, Escape, or backdrop click, and land back on my
    grid **exactly as I left it** (scroll, sort, filters, criteria intact), so that inspecting a row
    never costs me my place.
48. As an operator, I do **not** want any live-basket / offer-status column in the modal, because an
    inquiry has no transaction — that's out of scope.

### Localization & direction

49. As an operator, I want every label, header, badge, placeholder, and message to come through `t()`
    in the `bonus-buy-inquiry` namespace, so that the screen is ready for the planned Arabic/RTL
    retrofit as a data change.
50. As an operator on a future RTL locale, I want the layout to mirror correctly (logical Tailwind
    utilities; AG Grid `enableRtl`), so that the screen reads naturally right-to-left.

## Implementation Decisions

### Feature placement (from 056)

- **New feature, existing area.** `src/features/pricing/bonus-buy-inquiry/` — folder + default-export
  `BonusBuyInquiryPage.tsx` + `api.ts`. No new area folder or menu group (Pricing already exists).
- **i18n namespace `bonus-buy-inquiry`** — `src/locales/en/bonus-buy-inquiry.json`, registered in
  `src/core/i18n.ts` (import, `ns[]`, `resources`). Namespace == feature name.
- **Route** — one lazy entry in `src/app/router.tsx`: `pricing/bonus-buy-inquiry` →
  `BonusBuyInquiryPage`.
- **Menu** — one Pricing-group leaf in `src/layout/menu-model.ts`: label
  `bonus-buy-inquiry:menu.bbyInquiry`, lucide `Search`, `activePrefix: '/pricing/bonus-buy-inquiry'`,
  with the shared `accessProbe` below.

### Access gating (from 056 / 057 §4)

- `api.ts` exposes `access(): Promise<{ screenAllowed: boolean }>` calling **`GET Bby/Access`**.
- One `accessProbe` keyed `['bonus-buy-inquiry','access']`, `visible: (r) => r.screenAllowed === true`,
  drives **both** the shell nav-hide and the in-page route-guard denied-card (one shared call — the
  established sibling pattern: bonus-buy-download, coupons, simulation).
- **Graceful pre-build:** while `Bby/Access` is absent (404 / network), **fail open (shown)** — mirror
  the NC compose gate (038) which maps 404→allowed. Rationale: read-only screen; the list endpoint's
  `403 ACCESS_DENIED` is the true boundary, so an over-permissive menu can't leak data. (This inverts
  the generic fail-closed default *because* the server independently enforces the grant.)

### Endpoints consumed — all under `Bby/*`, through `src/core/api.ts` (api-envelope rule)

All are **designed contracts, built later on SIS.Api**. Envelope is the universal
`HttpGeneralResponse<T>`; `request()` unwraps `.data` and maps failures to `ApiError`.

**1. `GET Bby/List`** — the search (from 057). Params (all optional; `buildQuery` drops
`null`/`undefined`/`''`, so the client never pre-filters):

| Param | Type | Semantics | Default |
|---|---|---|---|
| `bbyNumber` | string | **Exact match**. When present the client also sends `activeOnly=false`. | — |
| `validFrom` | `yyyyMMdd` | Start of the **validity-overlap** window. | — |
| `validTo` | `yyyyMMdd` | End of the validity-overlap window. | — |
| `activeOnly` | bool | `true` ⇒ server active gate. Endpoint is a **pure function of params** — the *client* owns the "any search clears activeOnly" UX rule. | `true` |

- **Overlap on the raw `yyyyMMdd` strings** — zero-padded so ordinal string compare == date compare:
  `ValidFrom ≤ validTo AND ValidTo ≥ validFrom` (half-open when one bound is absent). **Day
  granularity**; `*Time` fields ride along for display only.
- **Active gate** (`activeOnly=true`): `bbyStatus == 'A' AND ValidFrom ≤ @today ≤ ValidTo`
  (server-local `@today`, ordinal compare) — the 054 definition, **not** the engine's fire-time gate.
- **Cap:** `ORDER BY CreatedAt DESC`, `TOP 1000`, no paging. Response is an object carrying the flag:
  ```ts
  { rows: BbyInquiryRow[] /* ≤1000, CreatedAt desc */, capReached: boolean }
  ```
- **Row DTO `BbyInquiryRow`** = full 28-field `BbyHeader` parity, **raw** strings/codes (dates
  `yyyyMMdd`, times `HHMMSS`, single-letter codes), plus one server-computed **`isActive: boolean`**
  (the active gate for that row against `@today`) so the grid's "active" marker never re-implements the
  date compare. Fields (wire order): `bbyNumber, description, bbyProfile, validFrom, validTo,
  validFromTime, validToTime, promoNumber, linkCategoryBuy, linkCategoryGet, bbyStatus, offerId,
  limitNumber, minValue, maxValue, condTargetType, includes, excludes, score, originFilter,
  priceListType, isStackable, allowNestedStacking, stackingExcludes, loyGroups, loyTiers, createdAt,
  createdBy` (+ derived `isActive`).

**2. `GET Bby/Detail?bbyNumber={n}`** — the modal (from 058). Returns a self-contained `BbyDetailDto`
(the `org` block projected server-side off `BbyCond000`; `buy[]`/`get[]` rows with material
`description` enriched inline; `totalDiscount` non-null only when `condTargetType === 'R'`). The
`get[]` array is empty in Document mode. Buy prereq rows that are status-`2` generated grouping members
(`prereqType===MGP` with a non-empty material number) are **excluded** from `buy[]` — they belong to
the members endpoint. Full DTO shape (inlined from the 058 prototype-grade contract):

```ts
interface BbyDetailDto {
  header: {
    bbyNumber: string; description: string; bbyProfile: string;
    validFrom: string; validTo: string; validFromTime: string; validToTime: string;
    promoNumber: string; offerId: string;
    linkCategoryBuy: string; linkCategoryGet: string;   // A=And / O=Or
    bbyStatus: string;                                   // A/I/D/X
    condTargetType: string;                              // R=Document -> total-discount layout
    minValue: number; maxValue: number;                  // minValue doubles as total-discount requirement
    limitNumber: number; score: number;
    isStackable: boolean; allowNestedStacking: boolean;
    loyGroups: string; loyTiers: string;
  };
  org: { salesOrganization: string; distributionChannel: string; plant: string; currency: string };
  buy: BbyBuyRow[];
  get: BbyGetRow[];                    // [] when condTargetType === 'R'
  totalDiscount: BbyTotalDiscount | null;   // non-null only when condTargetType === 'R'
}
interface BbyBuyRow {
  lineItemPos: string; prereqType: string /* MGP|MAT */; isGrouping: boolean;
  identifier: string; materialNumber: string | null; description: string | null;
  qty: number; uom: string; minValue: number; memberCount: number;
}
interface BbyGetRow {
  condNumber: string; isGrouping: boolean; identifier: string;
  materialNumber: string | null; description: string | null;
  discountType: string /* P|R|% */; conditionType: string /* ZB01/02/12/03/13 */;
  condValue: number; condValueP: number;   // show condValueP when discountType==='%', else condValue
  scaleType: string /* A=From|B=UpTo|C=Equal */; qty: number; uom: string;
  pricingUnit: number; pricingUnitUom: string; memberCount: number;
}
interface BbyTotalDiscount {
  discountType: string; conditionType: string;
  condValue: number; condValueP: number; requirement: number;   // = header.minValue
}
```

**3. `GET Bby/GroupingMembers?bbyNumber={n}&side={buy|get}&groupingKey={k}&page={p}&pageSize={s}`** —
the drilldown (from 058), lazy + paged, called only when a members chip is clicked. Scales to ~1,000
SKUs; `description` enriched per page.

```ts
interface BbyGroupMembersDto {
  side: 'buy' | 'get'; groupingKey: string;   // matGrouping (buy) / condNumber (get)
  total: number; page: number; pageSize: number;
  members: { materialNumber: string; description: string; qty: number; uom: string }[];
}
```

### Envelope / error contract (api-envelope rule)

- Empty result is `{rows:[],capReached:false}` (success), not an error.
- **400 business** → `INVALID_DATE_FORMAT` / `INVALID_DATE_RANGE`; surface via `apiErrorMessage` /
  `apiErrorCode`, never a bare `.message`.
- **403 business** → `ACCESS_DENIED` on the list (the real gate; the probe is only UX).
- **404 business** → `BBY_NOT_FOUND` on the detail (modal shows the message, not "unexpected").
- **401** → not handled in feature code (`handle401` clears session + redirects centrally).
- **≥500** → `server` kind, generic message.
- A stray legacy free-goods `discountType 'N'` is not expected (new engine models free goods as a
  100%-discount Get); the client maps it defensively rather than special-casing it.

### Client architecture — pure modules first (the tested seam)

The screen is a TanStack-Query Page over `api.ts`, with **behaviour pushed into pure modules** (the
sim `promoView` precedent, ticket 045) so the one meaningful test seam is in-memory:

- **`buildListParams(criteria)`** — pure map from toolbar state `{ bbyNumber, validFrom, validTo,
  activeOnly }` to the `Bby/List` query object, encoding the **"a non-empty number or date range forces
  `activeOnly:false`"** rule. This is the exact spot the 057 "client owns the UX rule" decision lives.
- **`formatters` / `codeLabels`** — pure `yyyyMMdd→yyyy-MM-dd`, `HHMMSS→HH:mm`, and code→`t()`-key
  maps (`bbyStatus` A/I/D/X, link A/O, condTarget R/P/M/G, discount P/R/%, condType ZB0x, scale
  A/B/C, prereq MGP/MAT). Raw values stay untouched for export.
- **`toDetailView(dto)`** — pure map from `BbyDetailDto` to the modal's render model: the two header
  panels (Organisation + Header & rules), Buy rows, and the **Get-vs-total-discount branch selected on
  `condTargetType === 'R'`**, plus per-row `isGrouping && memberCount>0` → drilldown-enabled. Mirrors
  045's approach exactly.
- **Grid config** — AG Grid Community column defs with grouped headers, the pinned identity column, and
  value-formatters that read the raw row and render chips/badges. **CSV** via AG Grid's
  `exportDataAsCsv` over raw values (prior art: `features/oms/deliveries/export.ts`; grouped headers +
  filter row: `grid-views.ts` / `ViewManager.tsx`).
- **Modal** — reuses `src/core/ui/Modal.tsx` (native `<dialog>`: focus trap, Escape, backdrop dismiss,
  focus restore — story 47 for free) at a wider `width`. The Buy/Get lists are plain tables; the
  members drilldown is a **second, nested** `Modal` opened from a chip, with its own paged query.
- **AG Grid theming** via the CSS-variable Theming API to the restyle tokens (the logical-tailwind rule
  exempts third-party widget internals — theme via token API, not physical-class overrides);
  `enableRtl` for direction. All chrome still goes through `t()`.

### Reconciliation note (059 ↔ 060)

Ticket 059's downstream note suggested the modal drop header scalars entirely (the grid owns all 28).
The **approved 060 prototype retains a focused header/organisation recap**, and the user approved it
("implement as in the artifact"). The spec follows the approved artifact: the **grid** is the
authoritative scan/filter/export surface for the full header; the **modal's header** is a compact recap
for context while reading that one BBY's conditions — not a second place to filter or export. No
conflict in behaviour, only a small overlap of displayed fields, deliberately kept for modal legibility.

## Testing Decisions

**What a good test asserts here:** external behaviour, not wiring — given toolbar state, the params
object produced; given a `BbyDetailDto`, the view model and which branch (rows vs total-discount) is
chosen; given raw codes/dates, the rendered labels; given a `capReached`/empty/error envelope, the
state the screen shows. Never assert on component internals or AG Grid's own DOM.

**Seams (confirmed with the user — stay on the current repo pattern; the vitest/RTL runner remains
deferred to the hardening ticket):**

1. **Pure module, in-memory (the primary seam — ideally the only one).** `buildListParams`,
   `formatters`/`codeLabels`, and `toDetailView` are pure and carry the real logic. Verify with an
   in-memory harness run under `node`/`tsx` — direct prior art: the sim `promoView` harness (ticket
   045, "harness 11/11"). Cases: number-forces-activeOnly-false; half-open date ranges; empty criteria
   ⇒ `{activeOnly:true}`; Document `R` selects the total-discount branch and empties Get; grouping row
   enables drilldown; each code→label; date/time formatting; `isActive` marker wiring.
2. **Component / Page (network stubbed at `api.ts`).** Grid states (default/searched/cap/empty/loading/
   denied) and the modal (scenarios + drilldown open/close). RTL is **not installed**, so until the
   runner lands these are verified by **driving the app with mocked envelopes + `typecheck`** — prior
   art: ticket 048 (drove the real component via Playwright) and the sibling gated pages.
3. **Flow (Playwright).** One end-to-end path — open screen → search (auto-clears active) → open the
   modal → open a grouping drilldown → CSV export — extending the existing smoke `tools/screen1-smoke.mjs`.

**Verification bar for `/implement`** (matching every BBY-adjacent ticket on this repo): `npm run
typecheck` green, `npm run build` green, the pure-module harness passing, and the flow driven with
mocked `Bby/*` envelopes. **Live-drive against SIS.Api is deferred** until the three `Bby/*` endpoints
are built — the tickets ship **code-complete / runtime-blocked**, same as the Notification Center
(032–038) and cache-reset (051–052) tickets.

## Out of Scope

- **Building the SIS.Api endpoints** (`Bby/List`, `Bby/Access`, `Bby/Detail`, `Bby/GroupingMembers`) —
  designed here as contracts, implemented separately in the backend repo.
- **Live basket / offer-status** in the modal (the WPF `LiveStatus` join) — an inquiry has no
  transaction context.
- **Editing, creating, or downloading** BBYs — inquiry only. ("Downloading" = publishing a BBY to
  stores via the download grant; that's the separate Bonus Buy Download screen. The in-scope **CSV
  export** of the grid is a different thing — a client-side data dump.)
- **`BbyHeaderHistory` / any header-change audit-trail view** — v1 is current-state inquiry; a history
  affordance returns only if scope is redrawn as a fresh effort.
- **xlsx export** — CSV ships in v1; xlsx (needs SheetJS or a server endpoint / Enterprise grid) is a
  later ticket.
- **Bootstrapping the vitest/RTL runner** — deferred to the hardening ticket; this feature verifies via
  the pure-module harness + Playwright drive + typecheck.
- **Reproducing the engine's fire-time gate** (`SyncApprovalStatus`, condition-level dates, intra-day
  time, loyalty) — the inquiry's "active" is the deliberately simpler header-only definition.

## Further Notes

- **Domain vocabulary** is pinned in `CONTEXT.md` (ticket 054): Buy side / Get side, BBY status,
  validity window, active/current, link category, condition target. Use it in code, keys, and copy.
- **Backend defects to design around** (flagged in 055/058, pre-existing in BackOffice — not fixed
  here): `BbyCond000Model.Condition` is null off `GetBonusBuyByNumber` (the endpoint must replicate the
  `CondNumber` join for Get-side member resolution); `BbyCond202` is never loaded (a copy-paste bug —
  confirm whether Get-side grouping members need it); the free-goods `N` `ConditionType` derivation
  throws (add a defensive guard). These are notes for the **backend** endpoint build, carried here so
  the contract consumers know the edges.
- **Prototypes** (primary sources for the build): list/search
  [`assets/059-bby-list-search-prototype.html`](assets/059-bby-list-search-prototype.html) and details
  modal [`060-bby-detail-modal-prototype.PROTOTYPE.html`](060-bby-detail-modal-prototype.PROTOTYPE.html)
  (artifact `https://claude.ai/code/artifact/f8efdfe3-7971-49b6-9c0b-d1ffcd805d19`). Build to match
  these; they encode the approved look and behaviour.
- **`/to-tickets` slicing hint** — natural tracer order: (0) feature scaffold + access gate + empty
  Page (the spine, gated, `Bby/Access` graceful); (1) `Bby/List` + `buildListParams` + the AG-Grid full
  header with default active view; (2) search toolbar + activeOnly rule + cap/empty/loading states;
  (3) CSV export; (4) `Bby/Detail` + `toDetailView` + the modal (header + Buy/Get + total-discount
  branch + not-found/loading); (5) `Bby/GroupingMembers` + the drilldown. Each independently
  code-complete against its mocked envelope.
