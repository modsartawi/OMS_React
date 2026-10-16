// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
//
// The rule campaign as the builder screens read it (spec 2737, ticket 501). No HQ contract exists
// yet: every field name below is taken from the owner-approved prototype's sample data
// (BackOffice `.scratch/proto/2734-rule-builder/data.js`) and ADR 0089's typed blocks, so that
// ticket 520 re-points ONE file when 2758/2759 write the real shapes. Feature code reads only what
// its screen needs from here; a guessed field must not spread further than that.
//
// Every date and time on the wire is LOCAL (the estate's wall clock): a day is `yyyy-MM-dd`, a
// moment `yyyy-MM-ddTHH:mm:ss`, never with a `Z`.

/** A marketer's text in both languages — a name, a "not met" message, a receipt label, a cashier
 *  prompt. Both halves are entered by the marketer and both are shown wherever the value is read. */
export interface Says {
  en: string
  ar: string
}

/**
 * Where a campaign is in its approval life, as HQ stores it: draft → waiting for approval →
 * (sent back → draft) | live → disabled. Scheduled / running / expired are NOT stored: they are a
 * live campaign read against its schedule at a local now (`@/core/rules/campaign-state`).
 */
export type RuleCampaignStatus = 'draft' | 'waitingForApproval' | 'live' | 'disabled'

/**
 * When a campaign applies, in local days. `until` is EXCLUSIVE (the prototype's schedule page:
 * "the end date is exclusive"); null `from` is "immediately", null `until` is open-ended. The two
 * hours are DAILY hours inside the window, not a start and end time.
 */
export interface RuleCampaignSchedule {
  from: string | null
  until: string | null
  /** Days of the week, 0 = Sunday; empty = every day. */
  days: number[]
  hoursFrom: string | null
  hoursTo: string | null
}

export interface RuleCampaignAudience {
  countries: string[]
  channels: string[]
  stores: string[]
  members: 'any' | 'identified' | 'earning'
}

/** The optional features a campaign switches on; they gate menus and palette items. */
export interface RuleCampaignFeatures {
  coupons: boolean
  points: boolean
}

export type RuleBudgetScope = 'campaign' | 'profile' | 'store' | 'session' | 'coupon'
export type RuleBudgetLimit = 'money' | 'uses' | 'pointsGiven' | 'pointsTaken'
export type RuleBudgetPeriod = 'lifetime' | 'day' | 'week' | 'month' | 'year'

/** "Limit the <limit> to <value> per <scope>, <period>" (ADR 0091). */
export interface RuleCampaignBudget {
  id: string
  name: string
  scope: RuleBudgetScope
  limit: RuleBudgetLimit
  value: number
  period: RuleBudgetPeriod
}

/**
 * A named cart-item filter. Conditions and effects reference it BY ID (`of`, `on`), never by
 * name, so a rename never breaks a rule (2734 point 3).
 */
export interface RuleItemFilter {
  id: string
  name: string
  cats: string[]
  colls: string[]
  skus: string[]
  exclCats: string[]
  scope: string
}

/** A named value: an expression HQ parses and validates. The client never parses it (ADR 0089). */
export interface RuleNamedValue {
  id: string
  name: string
  formula: string
}

/**
 * A condition block. Its `type` and its fields come from HQ's block catalogue (2758), so the
 * fields are open here; `says` is the marketer's "not met" sentence in both languages.
 */
export interface RuleCondition {
  id: string
  type: string
  says: Says
  [field: string]: unknown
}

export interface RuleWhen {
  mode: 'all' | 'any'
  /** Empty is legal and reads "always". */
  items: RuleCondition[]
}

/** An effect block; like a condition, its fields come from the catalogue. */
export interface RuleEffect {
  id: string
  type: string
  [field: string]: unknown
}

export interface CampaignRule {
  id: string
  name: string
  filters: RuleItemFilter[]
  values: RuleNamedValue[]
  when: RuleWhen
  then: RuleEffect[]
  /** What a points burn does when the member is short: refuse the rule, or scale it down. */
  partial: 'refuse' | 'scale'
}

/** Who did something, and when (local). */
export interface RuleCampaignStamp {
  by: string
  at: string
}

export interface RuleCampaign {
  id: string
  code: string
  name: Says
  description: string
  tags: string[]
  status: RuleCampaignStatus
  schedule: RuleCampaignSchedule
  audience: RuleCampaignAudience
  budgets: RuleCampaignBudget[]
  features: RuleCampaignFeatures
  offlineOptOut: boolean
  rules: CampaignRule[]
  created: RuleCampaignStamp | null
  /** The published version tills run, or null for a campaign never activated. */
  live: (RuleCampaignStamp & { version: number }) | null
  /** Set while the campaign waits for an approver. */
  approval: (RuleCampaignStamp & { note: string }) | null
}

/** One row of the campaigns list — the campaign without its rules, budgets and audience. */
export type RuleCampaignListRow = Pick<
  RuleCampaign,
  'id' | 'code' | 'name' | 'tags' | 'status' | 'schedule' | 'features' | 'created' | 'live'
>
