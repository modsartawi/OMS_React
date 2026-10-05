/**
 * Wire shapes of the `BbyMaintainWeb` door family (BackOffice spec 2374, tickets 2376–2382).
 *
 * ⚠️ **Read from the spec, not from shipped DTOs.** When ticket 416 was built, none of
 * BackOffice 2376–2382 had landed, so these are this client's reading of spec 2374's API
 * contract table and its outcome rule. Reconcile them field by field against the DTOs when
 * the doors ship. The names follow the spec's own words (`promoNumber`, `salesFrom`, `status`).
 */

/** GET BbyMaintainWeb/Access — the screen grant `BackOfficeScreen[BbyMaintain,03]`. */
export interface BbyMaintainAccessResult {
  screenAllowed: boolean
}

/**
 * SAP's `KONBBYH.STATUS` as `BbyHeader.BbyStatus`: blank = Activated, `1` = Planned,
 * `2` = Deactivated. Typed `string` because it is the server's code, read through
 * `overviewStatus` rather than trusted to be one of the three.
 */
export type BbyStatusCode = string

/** One row of GET Promotion/List. */
export interface BbyPromotionListItem {
  promoNumber: string
  name: string
  salesFrom: string
  salesTo: string
  bonusBuyCount: number
}

/** One row of a promotion's Bonus Buys – Overview grid. */
export interface BbyOverviewRow {
  bbyNumber: string
  text: string
  validFrom: string
  validTo: string
  status: BbyStatusCode
}

/** GET Promotion/{number} — the promotion with its bonus buys. */
export interface BbyPromotion {
  promoNumber: string
  name: string
  salesFrom: string
  salesTo: string
  bonusBuys: BbyOverviewRow[]
}

/** POST Promotion/Save. No `promoNumber` → the server mints `P` + 9 digits. */
export interface BbyPromotionSave {
  promoNumber: string | null
  name: string
  salesFrom: string
  salesTo: string
}

/**
 * One refusal or warning from the validator: a `BBY-` code plus its text in both
 * languages (spec 2374, "every refusal at once, in English and Arabic"). `number` names
 * the bonus buy a promotion-level act refused; `field` the field a copy refused on.
 */
export interface BbyRefusal {
  code: string
  en: string
  ar: string
  number?: string | null
  field?: string | null
}

/** The in-band outcome every write answers with a 200 (spec 2374 §Outcomes). */
export type BbyMaintainStatus = 'saved' | 'refused' | 'deleted' | 'notFound'

export interface BbyMaintainOutcome {
  status: BbyMaintainStatus
  number: string | null
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
}
