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
