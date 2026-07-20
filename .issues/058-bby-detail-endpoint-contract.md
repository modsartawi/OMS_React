---
type: wayfinder-ticket
wayfinder: grilling
map: 053
status: done
blocked-by: 055
---

# 058 — Detail-by-number endpoint contract

## Question

Design the **request/response contract** for the detail endpoint that feeds the Details modal
(built later on SIS.Api; called via `src/core/api.ts`). Using the field inventory from ticket 055,
pin:

- **Path & verb** (e.g. `Bby/Detail?bbyNumber=` or `Bby/{number}`) returning the full `BbyModel`
  shape as a **DTO** — Header/Org block, **Buy** rows (prereqs + material-grouping members), **Get**
  rows (conditions, discount type/value, scale, `ConditionType`), and the `Document` total-discount
  branch.
- Whether server-side **material-description enrichment** (`IMaterialInfoRepository`) is part of the
  DTO or fetched separately.
- How grouping members are delivered (nested under the grouping row vs a flat list keyed by
  `MatGrouping`/`CondNumber`) so the modal's drilldown (ticket 060) can render them.
- Error/`not-found` behaviour when a number resolves in the list but not in the detail repo.

Deliverable: a concrete detail-DTO sketch ready for the spec and the backend team. Explicitly
**omit** the live-basket `LiveStatus` fields (out of scope). Reference: `BonusBuyDetailController.cs`.

## Answer

Contract resolved with the user (grilling, 2026-07-20). Field inventory:
[055-bbymodel-field-inventory.md](055-bbymodel-field-inventory.md). **Two endpoints**, because
grouping members can be **~1000 SKUs** and must not bloat the detail payload.

### Decisions the grill settled

1. **Org fields (SalesOrg / DistChannel / Plant / Currency)** — **projected server-side**, sourced
   from **`BbyCond000`** (user correction: org lives there, not only on `BbyCond201/202`). The detail
   DTO carries a self-contained `org` block, so the modal is deep-linkable without the list row.
   Backend: pick org off the condition rows already read (assert/first — flag if it varies per row).
2. **Material `description`** — **enriched server-side, inline** on each Buy/Get row DTO (batch the
   listed materials through `IMaterialInfoRepository`, matching WPF's batch-once). The SPA has no
   material repo. Member descriptions are enriched **per page** by the members endpoint (below) — so
   we never eagerly enrich a 1000-SKU grouping.
3. **Grouping members** — **lazy, paged sub-endpoint**, opened as a modal (ticket 060). The detail
   row carries only `isGrouping` + `memberCount`; the member arrays are **not** in the detail payload.
4. **Free-goods (`DiscountType "N"`)** — **not expected**. The new promotion engine has no free-goods
   type; free-goods is modelled as a **100%-discount Get**. So `N` is dropped from the required code
   set; the server-side `ConditionType` throw becomes a **defensive guard** (return gracefully for a
   stray legacy `N` rather than 500), **not** a gating requirement.
5. **`Conditions` dict → array** on the wire (each `BbyCondModel` already carries `CondNumber`);
   simpler TS consumer.
6. **Not-found** — a number that resolves in the list but not in the detail repo
   (`GetBonusBuyByNumber` returns `null` header) is a **business** outcome, not a crash: envelope
   `success:false`, code **`BBY_NOT_FOUND`**, HTTP 404. Per api-envelope, the modal shows the
   message, not "unexpected".

### Endpoint A — detail

`GET Bby/Detail?bbyNumber={n}` → `HttpGeneralResponse<BbyDetailDto>` (envelope, api-envelope rule).
Codes carried **raw** (client maps via `t()`): `bbyStatus` A/I/D/X · `linkCategory*` A/O ·
`condTargetType` R/P/M/G · `discountType` P/R/% (N legacy-only) · `scaleType` A/B/C ·
`conditionType` ZB01/02/12/03/13 · `prereqType` MGP/MAT.

```ts
interface BbyDetailDto {
  header: {
    bbyNumber: string; description: string; bbyProfile: string;
    validFrom: string; validTo: string;          // yyyyMMdd (raw — client formats)
    validFromTime: string; validToTime: string;  // HHMMSS
    promoNumber: string; offerId: string;
    linkCategoryBuy: string; linkCategoryGet: string; // A=And / O=Or
    bbyStatus: string;                              // A/I/D/X
    condTargetType: string;                         // R=Document -> total-discount layout
    minValue: number; maxValue: number;             // minValue doubles as total-discount requirement
    limitNumber: number; score: number;
    isStackable: boolean; allowNestedStacking: boolean;
    loyGroups: string; loyTiers: string;
  };
  org: {                                            // projected off BbyCond000 (decision 1)
    salesOrganization: string; distributionChannel: string;
    plant: string; currency: string;
  };
  buy: BbyBuyRow[];
  // Get side is EITHER the rows OR the total-discount card, switched on condTargetType === 'R':
  get: BbyGetRow[];                                 // [] when condTargetType === 'R'
  totalDiscount: BbyTotalDiscount | null;           // non-null only when condTargetType === 'R'
}

interface BbyBuyRow {                               // from BbyPrereqModel via BuildBuyRow
  lineItemPos: string;        // MatItemPos
  prereqType: string;         // MGP=grouping / MAT=material
  isGrouping: boolean;        // matGrouping set AND prereqType===MGP
  identifier: string;         // matGrouping (grouping) else materialNumber
  materialNumber: string | null;   // null for grouping
  description: string | null;      // enriched server-side; null for grouping
  qty: number; uom: string;
  minValue: number;
  memberCount: number;        // when isGrouping — feeds Endpoint B / the drilldown modal
}

interface BbyGetRow {                               // from BbyCondModel via BuildGetRow
  condNumber: string;
  isGrouping: boolean;        // matGrouping set
  identifier: string;         // matGrouping else joined material (via BbyCond000 by condNumber)
  materialNumber: string | null;
  description: string | null; // enriched server-side; null for grouping
  discountType: string;       // P/R/% (N not expected — decision 4)
  conditionType: string;      // ZB01/02/12/03/13
  condValue: number; condValueP: number;   // client shows condValueP when discountType==='%', else condValue
  scaleType: string;          // A=From / B=UpTo / C=Equal
  qty: number; uom: string;
  pricingUnit: number; pricingUnitUom: string;
  memberCount: number;        // when isGrouping
}

interface BbyTotalDiscount {                        // condTargetType === 'R' (Document mode)
  discountType: string; conditionType: string;
  condValue: number; condValueP: number;            // client formats: condValueP if '%', else condValue
  requirement: number;        // = header.minValue (:121)
  // currency indicator derived client-side from discountType + org.currency
}
```

**Row-visibility filter (backend must replicate `BuildRows` :251-265):** Buy prereq rows with
`prereqType === MGP` AND a non-empty `MaterialNumber` are the status-`2` generated members — **skip
them from `buy[]`**; they belong to Endpoint B.

### Endpoint B — grouping members (lazy, paged)

`GET Bby/GroupingMembers?bbyNumber={n}&side={buy|get}&groupingKey={k}&page={p}&pageSize={s}`
→ `HttpGeneralResponse<BbyGroupMembersDto>`. Called when the drilldown modal opens (ticket 060);
scales to ~1000 SKUs.

```ts
interface BbyGroupMembersDto {
  side: 'buy' | 'get'; groupingKey: string;   // matGrouping (buy) / condNumber (get)
  total: number; page: number; pageSize: number;
  members: { materialNumber: string; description: string; qty: number; uom: string }[];
}
```

- Buy members = WPF `_groupMembers[matGrouping]` (`:207-225`), Qty/Uom from the prereq.
- Get members = WPF `_getGroupMembers[condNumber]` (`:231-249`) off `ItemConditions`
  (`BbyCond000`), qty falling through to the nested `BbyCondModel`.
- `description` enriched **per page** server-side (avoids enriching the whole 1000-SKU union).

### Backend notes to carry to the endpoint build (pre-existing BackOffice defects — not fixed here)

- **`BbyCond000Model.Condition` is null off `GetBonusBuyByNumber`** — the controller sets it in-memory
  (`:350`). Endpoint B (and Get-row material resolution) must replicate the `CondNumber` join
  server-side.
- **`BbyCond202` never loaded** — `LoadBbyModel` (:140-141) queries `BbyCond201` twice (copy-paste
  bug). Confirm whether **Get-side grouping members** need `BbyCond202`; if so, fix at source before
  Endpoint B is trustworthy.
- **Free-goods `N` throw** (`ConditionType` derivation :222-230) — per decision 4, add a defensive
  guard (no 500), but not expected in new-engine BBYs.

`LiveStatus` live-basket join excluded per scope. Feeds ticket 060 (detail-modal prototype).
