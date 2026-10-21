// The campaign upload's wire model (ADR 0097; BackOffice 2836-2838, the 2737 brief's section "HQ
// contract: campaign uploads (2836-2838)"). A **campaign upload** is one workbook for one **promotion**:
// read all or none, held as the promotion's ONE pending upload, activated as a whole into ONE ruleset
// version. Field names are copied from the contract, checked against the reply types of SIS.Api's
// `RuleCampaignUploadWebEndpoints.cs`: a guessed field must not appear here.
//
// Every date on the wire is LOCAL. `windowFrom` / `windowUntil` are the sheet's days and
// `windowUntil` is INCLUSIVE (the campaign JSON's `window.until` is the day after it): show the
// sheet's day as sent. On the read they are a `DateTime?` (`2026-10-09T00:00:00`, null when no
// campaign could be read); on a summary a never-set one is `0001-01-01T00:00:00`.
//
// The closed lists are string unions PLUS `string`: a value HQ adds later still parses and renders.

import type { RuleCampaign } from './rule-campaign'

/** The workbook's mechanics (closed list); any other word still parses. */
export type RuleUploadMechanic =
  | 'percentOff'
  | 'amountOff'
  | 'targetPrice'
  | 'perSkuValue'
  | 'buyNGetMFree'
  | 'buyNGetM'
  | 'buyXGetY'
  | 'bundlePrice'
  | 'minSubtotal'
  | (string & {})

/** A promotion's or a campaign's stacking: `compete` (blank in the sheet) or `stacks`. */
export type RuleUploadStacking = 'compete' | 'stacks' | (string & {})

/** A Campaigns row's Kind. */
export type RuleUploadKind = 'percent' | 'amount' | 'price' | (string & {})

/** A promotion's upload state. */
export type RuleUploadState = 'pending' | 'sentBack' | 'activated' | (string & {})

/**
 * One error or warning of a read. `at` is `Campaigns!12:Value`, `Items!40` or `Upload`; `row` 0 is
 * the whole sheet and `column` "" the whole row.
 */
export interface RuleUploadIssue {
  at: string
  sheet: string
  row: number
  column: string
  message: string
}

/** One campaign the read composed, in the rule language. */
export interface RuleUploadCampaign {
  code: string
  /** `<PromotionCode>-<Code>`. */
  id: string
  /** Its row on the Campaigns sheet. */
  row: number
  mechanic: RuleUploadMechanic
  stacking: RuleUploadStacking
  /** HQ generated the Arabic name: the sheet's NameAr was blank. */
  nameArGenerated: boolean
  /** The campaign JSON (schema 1); null only if HQ ever sent none. */
  campaign: RuleCampaign | null
}

/**
 * `POST Rules/Authoring/Uploads/Read` — what HQ made of the workbook. Any error: `accepted: false,
 * stored: false, revision: 0`, nothing stored. No error: the promotion's pending upload is stored (or
 * replaced at the next revision), `stored: true`; no ruleset version is written.
 */
export interface RuleUploadReport {
  accepted: boolean
  stored: boolean
  promotionCode: string
  stacking: RuleUploadStacking
  note: string
  /** The pending upload's revision; 0 when nothing was stored. */
  revision: number
  /** Count per mechanic: every key it holds is shown, unknown ones included. */
  mechanics: { [mechanic: string]: number }
  skuCount: number
  /** The first day any campaign runs; null when no campaign could be read. */
  windowFrom: string | null
  /** The LAST day any campaign runs, inclusive; null when no campaign could be read. */
  windowUntil: string | null
  campaigns: RuleUploadCampaign[]
  errors: RuleUploadIssue[]
  warnings: RuleUploadIssue[]
}

/** The read's summary as stored beside an upload (days as `yyyy-MM-dd`; null with no window). */
export interface RuleUploadReadSummary {
  mechanics: { [mechanic: string]: number }
  skuCount: number
  windowFrom: string | null
  windowUntil: string | null
  /** How many Arabic names HQ generated. */
  generatedNames: number
  warnings: { at: string; message: string }[]
}

/** `Uploads/List` row (and `SendBack`'s reply): a promotion's upload as the approver reads it. */
export interface RuleUploadSummary {
  promotionCode: string
  state: RuleUploadState
  revision: number
  stacking: RuleUploadStacking
  note: string
  fileName: string
  uploadedBy: string
  uploadedAt: string
  campaignCount: number
  skuCount: number
  windowFrom: string
  /** Inclusive, as the sheet says it. */
  windowUntil: string
  summary: RuleUploadReadSummary | null
  /** "" until reviewed. */
  reviewedBy: string
  /** `0001-01-01T00:00:00` until reviewed. */
  reviewedAt: string
  reviewNote: string
  /** The version the promotion's last activation made; 0 when never activated. */
  versionNo: number
}

/** One campaign of an opened upload beside its live version (`live` null when it is not live). */
export interface RuleUploadCampaignItem {
  id: string
  competes: boolean
  /** Null on a `disabling` row: the upload no longer holds it. */
  campaign: RuleCampaign | null
  live: RuleCampaign | null
}

/** `POST Rules/Authoring/Uploads/Load { promotionCode }` — an upload, opened. */
export interface RuleUploadDetail {
  upload: RuleUploadSummary
  campaigns: RuleUploadCampaignItem[]
  /** The promotion's live campaigns the upload no longer holds: an activation disables them. */
  disabling: RuleUploadCampaignItem[]
  /** What an activation would refuse now; empty when it would publish (a stale-order line first). */
  errors: string[]
}

/** `POST Rules/Authoring/Uploads/Activate { promotionCode, revision, note? }` — the one version it made. */
export interface RuleUploadActivation {
  versionNo: number
  promotionCode: string
  revision: number
  publishedAt: string
  publishedBy: string
  activated: string[]
  disabled: string[]
  warnings: string[]
}

/** The body of `Uploads/Load`. */
export interface RuleUploadRef {
  promotionCode: string
}

/** The body of `Uploads/Activate` (note optional) and `Uploads/SendBack` (note required). */
export interface RuleUploadReviewBody {
  promotionCode: string
  revision: number
  note?: string
}
