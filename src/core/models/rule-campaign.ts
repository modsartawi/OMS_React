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
 * name, so a rename never breaks a rule (2734 point 3). Its steps narrow each other; the picks
 * within a step match any: category codes (`cats`), collection codes (`colls`), material SKUs
 * (`skus`), then the never-discount categories (`exclCats`, Prescription A006 by default — 506).
 * `scope` is `items` (merchandise), `fees` (fee lines) or `itemsAndFees`.
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

/**
 * What "Create campaign" sends (ticket 502): the name in both languages — both required — and the
 * optional features. HQ answers with the whole new draft (code, id and empty schedule included):
 * the client never mints a code or an id.
 */
export interface RuleCampaignCreate {
  name: Says
  features: RuleCampaignFeatures
}

/**
 * What the rule builder's Save sends (ticket 505): the campaign's rules as the marketer left them.
 * It saves the campaign's DRAFT — for a live campaign, the working copy an approver publishes later
 * (2759) — and HQ answers with the whole campaign as saved. Block and rule ids a new block was given
 * in the browser travel as they are.
 */
export interface RuleCampaignDraft {
  rules: CampaignRule[]
}

// ── The block catalogue (ticket 504; HQ's door is BackOffice 2758) ──────────────────────────────
// What condition and effect types exist, their fields, units and palette groups. The builder reads
// a rule through it: `@/core/rules/sentence` turns a block into a sentence from the catalogue's
// field kinds, and the palette (505) groups and gates blocks by it. Fetched once and cached.

/**
 * How a field's value reads in a sentence. The client formats it by kind and never parses it:
 * a `formula` is shown as written (ADR 0089 — syntax and meaning are HQ's).
 */
export type RuleFieldKind =
  /** A filter id of this rule; `''` = all merchandise. */
  | 'items'
  /** A bundle's parts, `[{ of: filterId, count }]`. */
  | 'itemParts'
  /** An amount in the campaign's currency. */
  | 'money'
  | 'count'
  | 'days'
  /** A discount: a percent or an amount, as the block's `unitFrom` field says. */
  | 'discount'
  /** Points: a number or a named value, in points (`PTS`) or a currency's worth, per `unitFrom`. */
  | 'points'
  /** A machine code — a SKU, an activity, a value map, a campaign, a pattern. */
  | 'code'
  /** A list of codes — stores, channels. */
  | 'codes'
  /** Free text the marketer wrote in one language (an audience name, an attribute value). */
  | 'text'
  /** One of `options`. */
  | 'choice'
  /** Any of `options`. */
  | 'choices'
  /** An expression, shown as written. */
  | 'formula'
  /** When points activate or expire: `{ mode: 'afterDays' | 'afterHours' | 'on' | 'none', value }`. */
  | 'timing'
  /** A budget id of this campaign. */
  | 'budget'
  | 'flag'
  /** A marketer's EN + AR text; `role` says which. Shown under the sentence, never inside it. */
  | 'says'

/** A block is a condition (When) or an effect (Then). */
export type RuleBlockKind = 'condition' | 'effect'

/** What an EN + AR field is for. */
export type RuleSaysRole = 'notMet' | 'receiptLabel' | 'cashierPrompt' | 'message'

export interface RuleCatalogueField {
  key: string
  kind: RuleFieldKind
  /** The values a `choice` / `choices` field takes. */
  options?: string[]
  /** For `discount` / `points`: the sibling field that holds the unit. */
  unitFrom?: string
  /** For `says`. */
  role?: RuleSaysRole
  /** Read as a trailing clause, left out when empty, zero, false or `default`. */
  clause?: boolean
  default?: unknown
  /** The sentence agrees in number with this field. */
  plural?: boolean
}

export interface RuleCatalogueBlock {
  type: string
  kind: RuleBlockKind
  /** The palette group (Basket, Customer, Discounts, Points, …). */
  group: string
  /** The campaign feature that must be on for the palette to offer it. */
  feature: keyof RuleCampaignFeatures | null
  /** False for a block the map has not decided — the palette leaves it out. */
  decided: boolean
  /** The field whose value picks the sentence's wording. */
  variant?: string
  fields: RuleCatalogueField[]
}

export interface RuleBlockCatalogue {
  /** Palette groups, in palette order. */
  groups: { key: string; kind: RuleBlockKind }[]
  blocks: RuleCatalogueBlock[]
  /** What the guided ƒx helper offers (ticket 507). */
  formula: RuleFormulaGuide
}

// ── Lookups (ticket 506; HQ's doors are BackOffice 2758) ────────────────────────────────────────
// What "Certain items…" searches on HQ: categories, collections, and materials by SKU or name.

export type RuleLookupKind = 'categories' | 'collections' | 'materials'

/** One hit of a lookup: a category, a collection or a material (its SKU), and its name. */
export interface RuleLookupItem {
  code: string
  name: string
}

// ── The guided ƒx helper (ticket 507; HQ's doors are BackOffice 2758) ───────────────────────────
// A named value and the formula condition are written only through the helper: its Fields,
// Functions, Recipes and operator chips come from the catalogue (`formula`), and the validator is
// HQ's check door. The client never parses the expression language (ADR 0089): it inserts text
// and shows what HQ answers.

/** What a formula field, value or result is — its type badge. */
export type RuleFormulaType = 'money' | 'number' | 'text' | 'date' | 'items' | 'bool'

/** What a formula box needs: a named value is a number, the formula condition a yes / no test. */
export type RuleFormulaExpect = 'number' | 'bool'

/** A field a rule may read (`session.total`, `profile.tier`, `item.price` …). */
export interface RuleFormulaField {
  path: string
  type: RuleFormulaType
  /** The Fields list's group (`sale`, `profile`, `item`). */
  group: string
}

/** A function of the expression language: its signature and an example, as HQ writes them. */
export interface RuleFormulaFunction {
  name: string
  signature: string
  example: string
  /** What Insert puts in, and where the cursor goes inside it (an offset; absent = after it). */
  snippet: string
  caret?: number
}

/**
 * A ready-made formula. `{filter}` in it stands for one of the rule's filters, by its current name,
 * which the marketer picks; a recipe with it needs the rule to have a filter. `{current}` stands for
 * the formula the box already has (a cap wraps it); a recipe with it needs one written first.
 */
export interface RuleFormulaRecipe {
  key: string
  expect: RuleFormulaExpect
  formula: string
}

export interface RuleFormulaGuide {
  fields: RuleFormulaField[]
  functions: RuleFormulaFunction[]
  /** The operator chips, in order (`+`, `>=`, `and` …). */
  operators: string[]
  recipes: RuleFormulaRecipe[]
}

/**
 * What the validator sends: the formula, what its box needs, and the rule's filters and the named
 * values it may read (a named value reads only the values above it), so HQ checks the draft as it
 * is on screen, unsaved, and tries it on its sample basket in the campaign's currency.
 */
export interface RuleFormulaCheckRequest {
  campaignId: string
  expect: RuleFormulaExpect
  formula: string
  filters: RuleItemFilter[]
  values: RuleNamedValue[]
}

/** One thing wrong with a formula. `start` / `end` mark the bad word (offsets into the formula). */
export interface RuleFormulaProblem {
  code: string
  message: string
  start: number | null
  end: number | null
}

/** HQ's check of a formula: its errors, or its type and its result on the sample basket. */
export interface RuleFormulaCheck {
  ok: boolean
  type: RuleFormulaType | null
  errors: RuleFormulaProblem[]
  warnings: RuleFormulaProblem[]
  /** The result on HQ's sample basket; null when it cannot be tried there. */
  result: number | boolean | string | null
}
