// The rule engine's promotion wire model (BackOffice ADR 0097 and its 2847 addendum; tickets 2846-2847,
// renamed by 2862; the 2737 brief's section "HQ contract: promotions (2846-2847)"). A **promotion** is
// the weekly flyer or an ad-hoc set of campaigns: grouping metadata only — no promotion door writes a
// ruleset version or asks for approval. An uploaded promotion (`origin: upload`) owns the campaigns
// whose ids start with `<promotionCode>-`; a hand-made one (`origin: manual`) is a label.
//
// This is the RULE ENGINE's promotion. The bonus-buy engine's promotion (`BbyPromotion`, SAP's WAK1
// container on Bonus Buy Maintenance) is a different concept and shares nothing with these types.
//
// Field names are copied from the contract, checked against the reply and body types of SIS.Api's
// `RulePromotionWebEndpoints.cs` and `RulePromotionService.cs` (pricing2): a guessed field must not
// appear here. Every day is LOCAL; `windowFrom` / `windowUntil` are a `DateTime?` on the wire
// (`2026-10-09T00:00:00`, null without a window) and `windowUntil` is INCLUSIVE, the last day a
// campaign runs — never the campaign JSON's exclusive `window.until`.
//
// The closed lists are string unions PLUS `string`: a value HQ adds later still parses and renders.

import type { RuleUploadState } from './rule-upload'

/**
 * A promotion's state, derived by HQ on every list call: `live` when any campaign is in the newest
 * version with its window not ended, else `pending` while an upload waits, else `ended` when every
 * window is past, else `disabled`.
 */
export type RulePromotionState = 'live' | 'pending' | 'ended' | 'disabled' | (string & {})

/** Where a promotion came from: an upload's activation, or an author by hand. */
export type RulePromotionOrigin = 'upload' | 'manual' | (string & {})

/** A campaign row's status: `Pending` is a campaign only a pending upload holds (any case is accepted as a filter). */
export type RulePromotionCampaignStatus = 'Published' | 'Disabled' | 'Pending' | (string & {})

/**
 * `POST Rules/Authoring/Promotions/List` — one row per promotion, newest first, then ONE no-promotion
 * row: `promotionCode: null, origin: null`, names and note "". A campaign stamped with a code that is
 * neither a record nor an upload is listed as its own row with `origin: null` (its page is a 404):
 * the no-promotion row is told by `promotionCode`, never by `origin`.
 */
export interface RulePromotionSummary {
  promotionCode: string | null
  /** "" until someone names it (an upload's promotion has no names of its own). */
  nameEn: string
  nameAr: string
  /** Null on the no-promotion row and on a stray code's row. */
  origin: RulePromotionOrigin | null
  note: string
  /** A pending re-upload's new campaigns are left out until activated. */
  campaignCount: number
  skuCount: number
  windowFrom: string | null
  /** INCLUSIVE: the last day a campaign runs. */
  windowUntil: string | null
  state: RulePromotionState
  /** Set only when `live`. */
  liveVersionNo: number | null
  /** Null without an upload. */
  revision: number | null
  /** Null without an upload. */
  uploadState: RuleUploadState | null
  /** Null without an upload. */
  uploadedBy: string | null
  /** Null without an upload. */
  uploadNote: string | null
  /** Who published the version its last activation made; null when never activated. */
  approvedBy: string | null
  createdAt: string
}

/**
 * One campaign of a promotion's page (`Promotions/Campaigns`). `mechanic` is the upload's, `builder`
 * for a campaign no upload made, or null for one uploaded before 2846.
 */
export interface RulePromotionCampaignRow {
  id: string
  nameEn: string
  nameAr: string
  /** The upload generated the Arabic name. */
  nameArGenerated: boolean
  mechanic: string | null
  skuCount: number
  ruleCount: number
  windowFrom: string | null
  /** INCLUSIVE. */
  windowUntil: string | null
  status: RulePromotionCampaignStatus
  /** BO ask J (BackOffice 2855, NOT built): the row's own promotion, null for none. Absent until it lands. */
  promotionCode?: string | null
  /** BO ask J (BackOffice 2855, NOT built): how many budgets the campaign holds. Absent until it lands. */
  budgets?: number
}

/** `POST Rules/Authoring/Promotions/Campaigns` — one page of a promotion's campaigns, rows by id. */
export interface RulePromotionCampaignPage {
  /** Null for the campaigns in no promotion, and for `all`. */
  promotionCode: string | null
  /** The filtered count, every page. */
  total: number
  page: number
  pageSize: number
  /** Per mechanic, the rows matching `q` and `status` (not `mechanic`); a null mechanic uncounted. Every key is shown. */
  mechanics: { [mechanic: string]: number }
  /** The promotion's campaigns whose Arabic name the upload generated, unfiltered. */
  generatedNames: number
  campaigns: RulePromotionCampaignRow[]
  /** BO ask J (BackOffice 2855, NOT built): the campaigns with at least one budget, unfiltered. Absent until it lands. */
  withBudget?: number
}

/** The body of `Promotions/Campaigns`: null or "" = no promotion; `all: true` = every campaign (`promotionCode` unread). */
export interface RulePromotionCampaignsBody {
  promotionCode: string | null
  all?: boolean
  /** Matches the id and both names, any case. */
  q?: string
  mechanic?: string
  status?: string
  /** 1-based; past the last page is an empty page. */
  page: number
  /** Default 50, at most 200. */
  pageSize: number
}

/** A promotion record as the writes answer it (`Create`, `Update`, `Delete`). */
export interface RulePromotionRecord {
  promotionCode: string
  nameEn: string
  nameAr: string
  origin: RulePromotionOrigin
  note: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

/** One campaign an Assign took from another promotion, or an Unassign took out of one. */
export interface RulePromotionMove {
  id: string
  from: string
}

/** `Assign` / `Unassign`'s reply: `promotionCode` null on an Unassign. All or none. */
export interface RulePromotionAssignment {
  promotionCode: string | null
  changed: string[]
  moved: RulePromotionMove[]
}

/** The body of `Create` and `Update`: a null `nameAr` or `note` on an Update keeps it; the code never changes. */
export interface RulePromotionBody {
  promotionCode: string
  nameEn: string
  nameAr?: string | null
  note?: string | null
}

/** The body of `Assign` (`promotionCode` set) and `Unassign` (`campaigns` alone): 1 to 2,000 ids. */
export interface RulePromotionAssignBody {
  promotionCode?: string
  campaigns: string[]
}
