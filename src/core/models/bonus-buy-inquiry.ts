// Wire shapes for the Bby/* inquiry endpoints (spec 061; contracts 057/058).
// DESIGNED CONTRACTS, built later on SIS.Api — the feature ships code-complete /
// runtime-blocked against these (the NC 032–038 / cache-reset 051–052 posture).
// Field casing is the camelCase ASP.NET Core emits. All values are RAW (dates
// `yyyyMMdd`, times `HHMMSS`, single-letter codes); the client formats + labels
// them at the render tier and preserves the raw values for CSV export.

/**
 * One summary row off GET Bby/List — full 28-field `BbyHeader` parity (contract 057
 * §2), plus one server-computed `isActive` (the active gate for THIS row against the
 * server's `@today`) so the grid's "valid today" marker never re-implements the date
 * compare. Every scalar is raw; `bbyStatus`/`linkCategory*`/`condTargetType` stay codes.
 */
export interface BbyInquiryRow {
  bbyNumber: string
  description: string
  bbyProfile: string
  validFrom: string // yyyyMMdd
  validTo: string // yyyyMMdd
  validFromTime: string // HHMMSS
  validToTime: string // HHMMSS
  promoNumber: string
  linkCategoryBuy: string // A=And / O=Or
  linkCategoryGet: string // A=And / O=Or
  bbyStatus: string // A=Activated / I=Inactive / D=Draft / X=Deleted
  offerId: string
  limitNumber: number
  minValue: number
  maxValue: number
  condTargetType: string // R=Document / P / M / G
  includes: string
  excludes: string
  score: number
  originFilter: string
  priceListType: string
  isStackable: boolean
  allowNestedStacking: boolean
  stackingExcludes: string
  loyGroups: string
  loyTiers: string
  createdAt: string // ISO-8601; client formats
  createdBy: string
  /** Derived server-side: `bbyStatus === 'A' AND validFrom ≤ @today ≤ validTo`. */
  isActive: boolean
}

/**
 * GET Bby/List response `data` — an object (not a bare array) carrying the cap flag.
 * `capReached` is true when the 1000-row `CreatedAt DESC` cap truncated the result.
 * An empty result is `{ rows: [], capReached: false }` (success), not an error.
 */
export interface BbyListResult {
  rows: BbyInquiryRow[]
  capReached: boolean
}

/**
 * GET Bby/Detail?bbyNumber={n} — the per-row Details modal payload (contract 058,
 * spec 061; ticket 066). Self-contained: `org` is projected server-side off
 * `BbyCond000`; `buy[]`/`get[]` carry the material `description` enriched inline;
 * `totalDiscount` is non-null ONLY when `condTargetType === 'R'` (Document mode),
 * where `get[]` is empty. Every scalar is RAW (dates `yyyyMMdd`, times `HHMMSS`,
 * single-letter codes); the client formats + labels at the render tier.
 */
export interface BbyDetailDto {
  header: {
    bbyNumber: string
    description: string
    bbyProfile: string
    validFrom: string // yyyyMMdd
    validTo: string // yyyyMMdd
    validFromTime: string // HHMMSS
    validToTime: string // HHMMSS
    promoNumber: string
    offerId: string
    linkCategoryBuy: string // A=And / O=Or
    linkCategoryGet: string // A=And / O=Or
    bbyStatus: string // A/I/D/X
    condTargetType: string // R=Document -> total-discount layout
    minValue: number // doubles as the Document total-discount basket requirement
    maxValue: number
    limitNumber: number
    score: number
    isStackable: boolean
    allowNestedStacking: boolean
    loyGroups: string
    loyTiers: string
    /** Not on the flat header; some detail payloads carry them, some don't. */
    includes?: string
    excludes?: string
  }
  org: { salesOrganization: string; distributionChannel: string; plant: string; currency: string }
  buy: BbyBuyRow[]
  get: BbyGetRow[] // [] when condTargetType === 'R'
  totalDiscount: BbyTotalDiscount | null // non-null only when condTargetType === 'R'
}

/** One Buy-side prerequisite line. `isGrouping && memberCount > 0` → a material
 *  grouping whose members open the drilldown (slice 067). */
export interface BbyBuyRow {
  lineItemPos: string
  prereqType: string // MGP=grouping / MAT=material
  isGrouping: boolean
  identifier: string
  materialNumber: string | null
  description: string | null
  qty: number
  uom: string
  minValue: number
  memberCount: number
}

/** One Get-side condition line. Show `condValueP` (with `%`) when
 *  `discountType === '%'`, else `condValue` (with the org currency). */
export interface BbyGetRow {
  condNumber: string
  isGrouping: boolean
  identifier: string
  materialNumber: string | null
  description: string | null
  discountType: string // P|R|%
  conditionType: string // ZB01/02/12/03/13
  condValue: number
  condValueP: number
  scaleType: string // A=From / B=UpTo / C=Equal
  qty: number
  uom: string
  pricingUnit: number
  pricingUnitUom: string
  memberCount: number
}

/** The single Document-mode total-discount figure (`condTargetType === 'R'`).
 *  `requirement` mirrors `header.minValue` — the basket value that qualifies. */
export interface BbyTotalDiscount {
  discountType: string
  conditionType: string
  condValue: number
  condValueP: number
  requirement: number
}

/** Which side of a Bonus Buy a grouping sits on — selects the keying the server
 *  resolves members against (Buy → `matGrouping`, Get → `condNumber`, contract 058
 *  §3 / ticket 067). Rides through as the `side` query param verbatim. */
export type BbySide = 'buy' | 'get'

/** One member SKU of a material grouping (Buy or Get). `description` is enriched
 *  server-side per page (not carried on the grouping row itself) — only the opened
 *  grouping's current page is ever fetched, so a ~1,000-SKU grouping stays cheap. */
export interface BbyGroupMember {
  materialNumber: string
  description: string
  qty: number
  uom: string
}

/**
 * GET Bby/GroupingMembers?bbyNumber=&side=&groupingKey=&page=&pageSize= — the paged
 * members drilldown behind a grouping's "N members" chip (spec 061, ticket 067).
 * `side` echoes the requested side; `groupingKey` echoes the Buy `matGrouping` or the
 * Get `condNumber`. `total` is the full member count (drives the pager range/footer);
 * `members` is only the requested page. DESIGNED contract, built later on SIS.Api.
 */
export interface BbyGroupMembersDto {
  side: BbySide
  groupingKey: string
  total: number
  page: number
  pageSize: number
  members: BbyGroupMember[]
}

/**
 * GET Bby/Access — the screen-open grant probe (nav show/hide + in-page guard).
 * `screenAllowed` is the server's answer; `probed` records whether the endpoint
 * actually answered. While the endpoint is absent (404 / network) the client FAILS
 * OPEN (`screenAllowed:true, probed:false`) — this is a read-only inquiry and the
 * list endpoint's own `403 ACCESS_DENIED` is the real boundary (spec 061 / 056).
 */
export interface BbyInquiryAccessResult {
  screenAllowed: boolean
  probed: boolean
}
