// The rule campaign as HQ stores it (spec 2737; BackOffice 2758 and 2759, the brief's "HQ contract"
// sections, re-pointed in ticket 522). `RuleCampaign` is the campaign JSON of the rule language,
// schema 1, exactly as HQ stores and the engine reads it; `RuleDraft` is what `Rules/Authoring/
// Drafts/Load` answers around it. Field names, enum words and refusal codes are copied from the
// contract: a guessed field must not appear here.
//
// Every date and time on the wire is LOCAL (the estate's wall clock): a day is `yyyy-MM-dd`, a time
// `HH:mm`, a moment `yyyy-MM-ddTHH:mm:ss`, never with a `Z`. A time HQ never set is
// `0001-01-01T00:00:00` (`RULE_NEVER`): read it as absent, never show it.

/** A marketer's text in both languages — a name, a "not met" message, a receipt label, a cashier
 *  prompt. Both halves are entered by the marketer and both are shown wherever the value is read. */
export interface Says {
  en: string
  ar: string
}

/** The optional features a campaign switches on (`coupons`, `points`); they gate menus and blocks. */
export const RULE_FEATURES = ['coupons', 'points'] as const
export type RuleFeature = (typeof RULE_FEATURES)[number]

/** The days of a window, Sunday first. */
export const RULE_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type RuleWeekday = (typeof RULE_WEEKDAYS)[number]

/** Daily hours inside a window. They may cross midnight (`22:00` until `02:00`). */
export interface RuleWindowHours {
  from: string
  until: string
}

/**
 * When a campaign applies. `until` is EXCLUSIVE; an absent `from` is "immediately", an absent
 * `until` open-ended, absent `days` every day and absent `hours` all day.
 */
export interface RuleCampaignWindow {
  from?: string | null
  until?: string | null
  days?: RuleWeekday[]
  hours?: RuleWindowHours | null
}

export type RuleAudienceMembers = 'any' | 'identified' | 'earning'

export interface RuleCampaignAudience {
  countries?: string[]
  channels?: string[]
  stores?: string[]
  members?: RuleAudienceMembers
}

export type RuleBudgetScope = 'campaign' | 'profile' | 'store' | 'session' | 'coupon'
export type RuleBudgetLimit = 'uses' | 'money' | 'pointsGiven' | 'pointsTaken'
export type RuleBudgetPeriod = 'lifetime' | 'day' | 'week' | 'month'

/** "Limit the <limit> to <value> per <scope>, <period>" (ADR 0091). `id` is at most 40 characters. */
export interface RuleCampaignBudget {
  id: string
  name: Says
  scope: RuleBudgetScope
  limit: RuleBudgetLimit
  value: number
  period: RuleBudgetPeriod
}

export type RuleValueMapMeaning = 'targetPrice' | 'percentOff' | 'amountOff'

/** A number per material (ADR 0095): `entries` are `[material, number]`. */
export interface RuleValueMap {
  means: RuleValueMapMeaning
  unit: string
  entries: [string, number][]
}

/**
 * A named cart-item filter. Conditions (`of`), effects (`filter`) and bundle lists (`filter`)
 * reference it BY `id`, never by name, so a rename is one field (2734 point 3). A collection pick
 * writes its lookup's `articles` here; a new filter excludes Prescription (A006).
 */
export interface RuleItemFilter {
  id: string
  name: string
  categories?: string[]
  articles?: string[]
  exclude?: { categories?: string[] }
}

/**
 * The rule language's expression (ADR 0089): operator-first JSON arrays, `$`-paths and decimals —
 * `["round", ["*", "$eligible", 0.10], 0, "halfUp"]`. `@/core/rules/expr` prints it as text and
 * reads text back.
 */
export type RuleExpr = number | string | boolean | null | RuleExpr[]

/** A named value: it reads only the values above it. */
export interface RuleNamedValue {
  name: string
  expr: RuleExpr
}

/** A condition, keyed by its `check`; its other fields are the catalogue's. */
export interface RuleCondition {
  check: string
  says?: Says
  [field: string]: unknown
}

/** The catalogue's nested group of conditions. */
export const RULE_GROUP_CHECK = 'group'
export type RuleConditionGroup = RuleCondition & { mode: unknown; conditions: RuleCondition[] }

/** An effect, keyed by its `effect`; its other fields are the catalogue's. */
export interface RuleEffect {
  effect: string
  [field: string]: unknown
}

/** The effect that takes points as a tender: a rule with one says what a short member gets (`partial`). */
export const RULE_BURN_POINTS = 'burnPoints'
/** A discount's `kind` for a percent (`amount` is in the sale's currency). */
export const RULE_PERCENT_KIND = 'percent'
/** A points effect's `unit` for plain points (`SAR` is a currency's worth). */
export const RULE_POINTS_UNIT = 'PTS'

/** One list of a bundle: N units of a filter, by id. */
export interface RuleBundleList {
  filter: string
  count: number
}

/** A rule's bundle, priced by a bundle effect. */
export interface RuleBundle {
  lists: RuleBundleList[]
  sameAttribute?: string
  max?: number
}

export type RulePartial = 'refuse' | 'scale'

export interface CampaignRule {
  id: string
  name: string
  /** What a points burn does when the member is short: refuse the rule, or scale it down. */
  partial?: RulePartial
  filters: RuleItemFilter[]
  values: RuleNamedValue[]
  bundle?: RuleBundle | null
  /** Every condition must hold; empty reads "always". */
  when: RuleCondition[]
  then: RuleEffect[]
}

/** The campaign JSON (schema 1). `id` is at most 40 of `A-Z a-z 0-9 . _ -`, picked by the author. */
export interface RuleCampaign {
  id: string
  name: Says
  window?: RuleCampaignWindow
  audience?: RuleCampaignAudience
  budgets?: RuleCampaignBudget[]
  onlineOnly?: boolean
  valueMap?: RuleValueMap | null
  rules: CampaignRule[]
}

// ── The draft (Rules/Authoring/Drafts/*, BackOffice 2758 + 2759) ─────────────────────────────────

/** A time HQ never set. */
export const RULE_NEVER = '0001-01-01T00:00:00'

/** A draft's approval state: being edited, waiting for an approver (frozen), or sent back. */
export type RuleDraftState = 'editing' | 'pending' | 'sentBack'

/** The live campaign's status: published, disabled, or `''` for one that never went live. */
export type RuleCampaignStatus = 'Published' | 'Disabled' | ''

/** The evaluation tree (ADR 0090) a draft publishes with, as `Rules/Authoring/Order` answers it. */
export interface RuleEvaluationTree {
  groups: { id: string; name: Says; mode: 'stackable' | 'first' | 'highest'; scope: 'session' | 'item'; campaigns: string[] }[]
  order: ({ campaign: string } | { group: string })[]
}

/**
 * One of HQ's issues with a campaign. `rule` and `index` are 0-based (null outside a rule / a
 * list); `path` is where it points (`campaign.rules[1].when[1].conditions[0].amount`), `where` the
 * same in words; `message` is HQ's own text, shown as data.
 */
export interface RuleIssue {
  severity: 'error' | 'warning'
  rule: number | null
  ruleId: string | null
  block: string | null
  index: number | null
  field: string | null
  where: string
  message: string
  path: string
}

/** HQ's offline-safe verdict: why a campaign needs HQ, in both languages. */
export interface RuleOfflineVerdict {
  safe: boolean
  onlineOnly: boolean
  reasons: { code: string; en: string; ar: string }[]
}

/** A validation: errors block activation, warnings never do. `offline` is null while errors stand. */
export interface RuleValidation {
  canActivate: boolean
  errors: RuleIssue[]
  warnings: RuleIssue[]
  offline: RuleOfflineVerdict | null
}

/**
 * `Rules/Authoring/Drafts/Load` (and every door that answers "the draft"). With no draft it is the
 * newest version (`source: published`, `revision` 0). `origin` is `restore:N`, `copy:CODE`,
 * `template:CODE` or `''`.
 */
export interface RuleDraft {
  code: string
  source: 'draft' | 'published'
  revision: number
  features: RuleFeature[]
  campaign: RuleCampaign
  name: Says
  publishedVersionNo: number
  updatedAt: string
  updatedBy: string
  validation: RuleValidation | null
  state: RuleDraftState
  tree: RuleEvaluationTree | null
  origin: string
  campaignStatus: RuleCampaignStatus
  requestedBy: string
  requestedAt: string
  requestNote: string
  reviewedBy: string
  reviewedAt: string
  reviewNote: string
}

/** `Rules/Authoring/Drafts/Save`: the draft's whole state at the revision loaded (0 on the first
 *  save — which is also how a campaign is created). `tree` absent keeps the live order. */
export interface RuleDraftSave {
  campaign: RuleCampaign
  features: RuleFeature[]
  revision: number
  tree?: RuleEvaluationTree
}

/** One row of `Rules/Authoring/Drafts/List`, last saved first. */
export interface RuleDraftSummary {
  campaign: string
  name: Says
  revision: number
  features: RuleFeature[]
  publishedVersionNo: number
  updatedAt: string
  updatedBy: string
  state: RuleDraftState
  requestedBy: string
}

/** `Rules/Authoring/Drafts/Delete`'s answer. */
export interface RuleDraftDeleted {
  campaign: string
  deleted: true
}

/**
 * One row of the campaigns list. PROVISIONAL - no list door yet (BO ask A, ticket 524): 524 composes
 * it from Drafts/List, Order and the live ruleset behind one `ruleCampaignApi.list()`. The fields
 * are the draft's own words; `state` is null for a live campaign with no draft.
 */
export interface RuleCampaignListRow {
  campaign: string
  name: Says
  state: RuleDraftState | null
  campaignStatus: RuleCampaignStatus
  publishedVersionNo: number
  window: RuleCampaignWindow | null
  features: RuleFeature[]
  updatedAt: string
  updatedBy: string
}

// ── The block catalogue (`Rules/Authoring/Catalogue`, BackOffice 2758; re-pointed in ticket 523) ──
// What condition, effect and setting blocks exist, their fields, units, palette groups and
// sentences, gated by the campaign's features: a block of a feature the campaign lacks is not listed
// (nor a budget `scope: coupon` without coupons, nor a `pointsGiven` / `pointsTaken` limit without
// points). The builder reads a rule through it: `@/core/rules/sentence` fills a block's `sentence`
// (its fields in braces) from the block's values, and the palette (505) groups blocks by it.

/** A block of a rule: a condition (`rule.when[]`) or an effect (`rule.then[]`). */
export type RuleBlockKind = 'condition' | 'effect'
/** A catalogue block is a rule's block or a setting (a filter, a value, a budget, the window …). */
export type RuleCatalogueKind = RuleBlockKind | 'setting'

/** A field's value type in the builder's panel (BackOffice `RuleFieldTypes`). */
export type RuleFieldType =
  | 'money'
  | 'count'
  | 'points'
  | 'percent'
  | 'number'
  /** EN + AR text, `{ en, ar }`. */
  | 'text'
  | 'code'
  | 'choice'
  | 'codes'
  | 'bool'
  /** The id of one of the rule's filters. */
  | 'filter'
  /** The id of one of the campaign's budgets. */
  | 'budget'
  /** A literal, a named value (`"$name"`) or an expression (`RuleExpr`). */
  | 'formula'
  /** `{ afterDays }` or `{ on: 'yyyy-MM-dd' }`. */
  | 'pointsDate'
  | 'date'
  | 'time'
  | 'conditions'
  | 'object'
  | 'objects'
  | 'entries'

/** One field of a block, as its JSON names it. */
export interface RuleCatalogueField {
  /** The JSON property. */
  name: string
  type: RuleFieldType
  required: boolean
  /**
   * The unit the panel shows beside the value: `currency` (the sale's), `%`, `units`, `points`,
   * `days`, `bundles`; two words joined by `|` when the field's sibling decides (`currency|%` by a
   * discount's `kind`, `SAR|PTS` by a points effect's `unit`); null for none.
   */
  unit: string | null
  /** A `choice`'s values, only those the campaign's features allow. */
  values: string[] | null
  /** The lookup that fills the field; null when it is typed. */
  lookup: RuleLookupKind | null
  /** What the field holds when the author does not say. */
  default: unknown
  /** An object's or objects' own fields. */
  fields: RuleCatalogueField[] | null
}

export interface RuleCatalogueBlock {
  kind: RuleCatalogueKind
  /** The `check` / `effect` value, or the setting's JSON property. */
  type: string
  /** The palette group, one of the catalogue's `groups`' ids. */
  group: string
  name: Says
  /** How the block reads, its fields in braces: "the subtotal of {of} is at least {amount}". */
  sentence: Says
  /** The feature that switches it on; null for always. */
  feature: RuleFeature | null
  /** The offline-safe verdict's reason a block of this type gives its campaign; null for none. */
  offline: string | null
  /** What the spec leaves undecided about the block; null when settled. */
  open: string | null
  /** Where it goes: `rule.when[]`, `rule.then[]`, `rule.filters[]`, `campaign.budgets[]` … */
  path: string
  fields: RuleCatalogueField[]
  /** A block the checker accepts as written at `path`: a new block's defaults. */
  example: unknown
}

export interface RuleCatalogueGroup {
  id: string
  kind: RuleCatalogueKind
  name: Says
}

export interface RuleBlockCatalogue {
  /** The rule language's schema version the blocks are written in. */
  schema: number
  /** The features the catalogue was asked for, as HQ understood them. */
  features: RuleFeature[]
  /** Every feature a campaign may switch on. */
  allFeatures: RuleFeature[]
  /** Palette groups, in palette order — only those with a block listed. */
  groups: RuleCatalogueGroup[]
  conditions: RuleCatalogueBlock[]
  effects: RuleCatalogueBlock[]
  settings: RuleCatalogueBlock[]
  /** The lookups the fields name. */
  lookups: RuleLookupKind[]
}

// ── Lookups (`Rules/Authoring/Lookups/{lookup}`, BackOffice 2758) ───────────────────────────────
// What a field picks from. There is no countries or channels lookup (BO ask E): Settings ▸ Audience
// keeps a fixed list for those (`@/core/rules/lookups`).

export type RuleLookupKind = 'categories' | 'collections' | 'materials' | 'stores' | 'audiences' | 'valueMaps' | 'budgets'

/** A material search needs at least this many characters, else HQ refuses it (`RULES_BAD_LOOKUP`). */
export const RULE_MATERIAL_SEARCH_MIN = 3

/**
 * One hit of a lookup, at most 50. `code` is what the field takes; `name` is as far as the master
 * holds it (categories, collections and stores have English names only, `ar` empty); `detail` a
 * second line (a material's category, a store's engine, a budget's sentence, a map's meaning +
 * unit). A collection's `articles` are what a pick writes into a filter; `entries` a value map's
 * count; `neverDiscount` a category no discount should reach by default (A006).
 */
export interface RuleLookupItem {
  code: string
  name: Says
  detail: string | null
  articles: string[] | null
  entries: number | null
  neverDiscount: boolean
}

// ── Validate (`Rules/Authoring/Validate`, BackOffice 2758) ──────────────────────────────────────

/** `Rules/Authoring/Validate`: the campaign as the builder holds it (unsaved), and its tree. */
export interface RuleValidateRequest {
  campaign: RuleCampaign
  tree?: RuleEvaluationTree
}

// ── Value maps (`Rules/Authoring/ValueMaps/Upload`, BackOffice 2758) ────────────────────────────

/**
 * The upload's answer. Nothing is stored: `campaign` is the campaign sent with the map's entries
 * replaced (null when refused), which the page saves as the draft. A file issue has `block: file`
 * and `where: "line 3"`.
 */
export interface RuleValueMapUpload {
  accepted: boolean
  entries: number
  campaign: RuleCampaign | null
  errors: RuleIssue[]
  warnings: RuleIssue[]
}

// ── Approval (ticket 511; HQ's doors and Ua permissions are BackOffice 2759) ─────────────────────
// An author asks for approval and only an approver activates. The roles say what the dashboard
// draws; the server refuses whatever the reader may not do (the standard envelope), whatever is drawn.

/** The reader's roles on rule campaigns. One person may hold both. */
export interface RuleCampaignRoles {
  author: boolean
  approver: boolean
}

/**
 * What a lifecycle act sends: the actor's note — for the approver when asking (optional), for the
 * author when sending back (required), for the version history when activating (optional). HQ
 * answers an ask, an activate, a send back or a disable with the whole campaign in its new state.
 */
export interface RuleCampaignTransition {
  note: string
}

// ── Budgets (`Rules/Authoring/Budgets` + `Budgets/SetLimit`, BackOffice 2758 over 2744) ─────────
// Settings ▸ Budgets saves the campaign's budgets inside the draft, like the other Settings pages. A
// live campaign's counters are read beside it, and a live budget's LIMIT changes on its own door:
// limits are live settings outside the ruleset version pin (ADR 0091), so changing one never
// republishes.

/**
 * One budget of the newest version, with the limit in force (`limitValue`: the live limit when one
 * is set, else `declared`) and what this period (`periodKey`) has used, held and overshot, SUMMED
 * over every scope key — `counters` is how many keys (members, stores, sessions, codes) counted.
 * `limitValue` is per key. The overshoot is computed per key and never hidden (ADR 0091).
 */
export interface RuleBudgetView {
  campaign: string
  budget: string
  name: Says
  scope: RuleBudgetScope
  limit: RuleBudgetLimit
  period: RuleBudgetPeriod
  declared: number
  limitValue: number
  periodKey: string
  used: number
  held: number
  overshoot: number
  counters: number
}

/** `Budgets/SetLimit`'s answer: the limit now in force, the one before, and how many counters are above it. */
export interface RuleBudgetLimitSet {
  campaignId: string
  budgetId: string
  limitValue: number
  previousLimit: number
  countersAbove: number
}

// ── Versions (ticket 512; HQ's doors are BackOffice 2759) ────────────────────────────────────────
// Every activation publishes an immutable version with who, when and the approver's note. Restore
// makes an earlier version the campaign's NEW draft — never an in-place rollback: the live version
// tills run is untouched until that draft is approved and activated in turn.

/** Who did something, and when (local). */
export interface RuleCampaignStamp {
  by: string
  at: string
}

/** One published version, as the Versions page lists it. `at` is a local moment. */
export interface RuleCampaignVersion extends RuleCampaignStamp {
  version: number
  /** The note written when it was activated; empty when none was. */
  note: string
}

/** One version opened read-only: its rules as they were published. */
export interface RuleCampaignVersionDetail extends RuleCampaignVersion {
  rules: CampaignRule[]
}

/**
 * A group's mode in the evaluation order (ADR 0090): every triggered campaign stacks; the first
 * that actually yields wins; or the most discount money wins (points do not count).
 */
export type RuleOrderGroupMode = 'stackable' | 'first' | 'highest'
/** What a group decides over: the whole session, or each unit (item discounts only). */
export type RuleOrderGroupScope = 'session' | 'item'

/** A flat evaluation group (ADR 0090): its campaigns by id, in their order. */
export interface RuleOrderGroup {
  id: string
  name: string
  mode: RuleOrderGroupMode
  scope: RuleOrderGroupScope
  items: string[]
}

/** One place in the stackable base: a campaign (`c`, its id) or a group (`g`, its id). */
export type RuleOrderNode = { c: string } | { g: string }

/**
 * The evaluation order (ticket 513, BackOffice 2759): the stackable base list, top to bottom, with
 * the groups placed in it. HQ answers and saves the DRAFT order; it publishes with the next version.
 */
export interface RuleEvaluationOrder {
  base: RuleOrderNode[]
  groups: RuleOrderGroup[]
}

// ── Templates (ticket 503; HQ's doors are BackOffice 2759) ───────────────────────────────────────
// A template is a campaign draft with NAMED PLACEHOLDERS that the Create dialog fills (2759's
// default, not yet decided there). Anywhere in the draft, a value that is exactly
// `{ "placeholder": "<key>" }` is replaced by the placeholder's value as it is typed (a number, a
// code, a list of codes), and `{{<key>}}` inside a string — a name, a "not met" message, a receipt
// label, a formula — is replaced by the value as text. The client fills; HQ re-checks the values.

/**
 * How a placeholder is asked for: a typed `number` within `min`–`max`; `pick`, the builder's item
 * picker on a lookup (one code or more); or `choice`, one of `options`.
 */
export type RuleTemplatePlaceholderKind = 'number' | 'pick' | 'choice'

export interface RuleTemplatePlaceholder {
  key: string
  /** The template author's label, shown as data ("Minimum basket (SAR)", "Percent off"). */
  label: string
  kind: RuleTemplatePlaceholderKind
  /** `number`: the bounds, inclusive; null = unbounded. */
  min?: number | null
  max?: number | null
  /** `pick`: what the picker searches. */
  lookup?: RuleLookupKind
  /** `choice`: the codes it takes, with their names. */
  options?: { code: string; name: string }[]
  /** What the field starts with: a number, a code, or a list of codes for `pick`. */
  default: RuleTemplateValue | null
}

/** A placeholder's value: a number, a code (`choice`), or codes (`pick`). */
export type RuleTemplateValue = number | string | string[]

/** The campaign a template makes, with placeholders standing in for its values. */
export interface RuleTemplateDraft {
  name: Says
  features: RuleFeature[]
  /** Who the campaign is for, when the template says (the prototype's tier template); absent = HQ's
   *  default audience, as for a blank campaign. */
  audience?: RuleCampaignAudience
  rules: CampaignRule[]
}

export interface RuleCampaignTemplate {
  id: string
  name: Says
  /** One line on what the template is for — the author's text, shown as data. */
  description: string
  /** Only an enabled template makes campaigns; a draft one is listed and cannot be used. */
  enabled: boolean
  placeholders: RuleTemplatePlaceholder[]
  draft: RuleTemplateDraft
}

/**
 * What "Create from a template" sends: the values the marketer gave, by placeholder key, and the
 * draft the client filled with them. HQ re-fills the template from `values` to check the draft, mints
 * the code and id, and answers with the whole new draft.
 */
export interface RuleCampaignFromTemplate {
  values: Record<string, RuleTemplateValue>
  draft: RuleTemplateDraft
}

// ── The simulator (ticket 514; HQ's door is BackOffice 2758's dry run) ───────────────────────────
// A dry run of the rule engine on a basket: nothing is held, closed or counted. HQ answers per-line
// effects, session-level effects, a trace per campaign and the near misses; the client only groups
// and draws them (it never evaluates a rule — ADR 0089).

/** One basket line as it is sent: a material by its SKU and a whole quantity. */
export interface RuleSimBasketLine {
  sku: string
  qty: number
}

export interface RuleSimRequest {
  basket: RuleSimBasketLine[]
  /** The store's code; its country, sales org, currency and engine are HQ's to look up. */
  store: string
  /** The member on the sale; null = a walk-in. */
  memberId: string | null
  channel: string
  /** The sale's moment, LOCAL: `yyyy-MM-ddTHH:mm:ss`, never a `Z`. */
  at: string
  /** Run every campaign's working copy (its draft) instead of its live version. */
  includeDrafts: boolean
  /** Run this one campaign's working copy, the others live ("Simulate the working copy"). */
  draftId: string | null
}

/** One line of the priced basket, in the order sent; `line` is 1-based. Money is in `currency`. */
export interface RuleSimLine {
  line: number
  sku: string
  name: string
  qty: number
  gross: number
  discount: number
  net: number
}

/**
 * What a campaign does to the sale: money off, a free unit, points earned, points taken as a tender,
 * a coupon it will create at close, or a message for the receipt or the cashier.
 */
export type RuleSimEffectKind = 'discount' | 'freeUnit' | 'points' | 'pointsTaken' | 'createCoupon' | 'message'

export interface RuleSimEffect {
  campaignId: string
  code: string
  kind: RuleSimEffectKind
  /** The basket line it lands on; null = a session-level effect. */
  line: number | null
  /** Money (discount, free unit's worth, points taken), in the result's currency. */
  amount: number | null
  /** A free unit's count. */
  quantity: number | null
  /** Points earned. */
  points: number | null
  /** The receipt label, or the message / cashier prompt, in both languages. */
  label: Says | null
  /** `createCoupon`: the code of the coupon campaign it will create a code of. */
  coupon: string | null
}

/**
 * How a campaign came out: applied; triggered nothing ("not met"); not run at all (out of its
 * schedule, audience or country, a draft not chosen — HQ says why); stopped by a budget; or lost
 * inside its group to another campaign.
 */
export type RuleSimOutcome = 'applied' | 'notMet' | 'skipped' | 'budget' | 'lost'

export interface RuleSimConditionTrace {
  conditionId: string
  /** The condition's "not met" text in both languages, as the marketer wrote it. */
  says: Says
  met: boolean
}

export interface RuleSimRuleTrace {
  ruleId: string
  name: string
  /** False when HQ did not reach the rule (the campaign was skipped, or an earlier rule ended it). */
  ran: boolean
  conditions: RuleSimConditionTrace[]
}

export interface RuleSimTrace {
  campaignId: string
  code: string
  name: Says
  outcome: RuleSimOutcome
  /** HQ's words for a skip or a budget stop ("not for SA", "ended 2026-09-04"); null otherwise. */
  reason: string | null
  /** The evaluation group it sits in; null = the stackable base. */
  group: { id: string; name: string; mode: RuleOrderGroupMode } | null
  /** `lost`: the code of the campaign that won the group. */
  lostTo: string | null
  rules: RuleSimRuleTrace[]
}

/** How far a campaign is from applying: money to add, or more items of one of its filters. */
export type RuleSimGap = { kind: 'money'; amount: number } | { kind: 'items'; count: number; of: string }

export interface RuleSimNearMiss {
  campaignId: string
  code: string
  gap: RuleSimGap
  /** What it would give, as its receipt label reads ("15% off"), in both languages. */
  offer: Says
}

export interface RuleSimResult {
  /** The store's currency; every money figure of the result is in it. */
  currency: string
  /** The store's engine: on `BonusBuy` rule campaigns never apply there. */
  engine: 'Rule' | 'BonusBuy'
  lines: RuleSimLine[]
  totals: { gross: number; discount: number; net: number }
  effects: RuleSimEffect[]
  trace: RuleSimTrace[]
  nearMisses: RuleSimNearMiss[]
}

// ── Campaign coupons (ticket 515, BackOffice 2755) ──
//
// A coupon campaign's codes live in SIS.Coupons under a template the campaign owns (ADR 0094). A
// code carries NO redemption limit of its own: "each code once" and "once per customer" are the
// campaign's coupon and profile budgets (ADR 0094, Settings ▸ Budgets), so nothing below has a
// limit field — `uses` is a count, never a count against a cap.

/** Where a code is: HQ answers it, `expired` included (past its own `until` at HQ's local day). */
export type RuleCouponStatus = 'unused' | 'used' | 'disabled' | 'expired'

/** How a code came to be: one of Create coupons' three kinds, or a CSV import (516). */
export type RuleCouponKind = 'random' | 'universal' | 'personal' | 'imported'

/** One code of the campaign. Days are local `yyyy-MM-dd`, `created` a local moment, never a `Z`. */
export interface RuleCampaignCoupon {
  code: string
  status: RuleCouponStatus
  kind: RuleCouponKind
  /** How many sales redeemed it. */
  uses: number
  /** The member it is bound to (a personal code), or null for anyone. */
  member: string | null
  /** The batch it was created in. */
  batch: string
  created: string
  /** First day it works; null = at once. */
  from: string | null
  /** Last day it works; null = no end of its own (the campaign's end still applies). */
  until: string | null
}

/** The characters a random code is drawn from. */
export type RuleCouponCharset = 'lettersAndDigits' | 'letters' | 'digits'

/** How a random or personal code is shaped: `PREFIX-RANDOM-SUFFIX`, the dashes HQ's. */
export interface RuleCouponShape {
  prefix: string
  suffix: string
  /** How many random characters. */
  length: number
  charset: RuleCouponCharset
}

/** A batch's validity, in local days (null = at once / no end of its own). */
export interface RuleCouponValidity {
  from: string | null
  until: string | null
}

/**
 * What Create coupons sends (ticket 515): one batch of one kind. HQ mints the codes and the batch
 * id. No kind carries a redemption limit (ADR 0094).
 */
export type RuleCouponBatchCreate =
  | ({ kind: 'random'; count: number } & RuleCouponShape & RuleCouponValidity)
  | ({ kind: 'universal'; code: string } & RuleCouponValidity)
  | ({ kind: 'personal'; members: string[] } & RuleCouponShape & RuleCouponValidity)

/** HQ's answer to a create: the batch id and how many codes it holds. */
export interface RuleCouponBatch {
  batch: string
  count: number
}

// ── Campaign coupons: CSV import and delete unused (ticket 516, BackOffice 2755) ──

/** One row of an import: a code (upper-cased) and the member it binds to, or null for anyone. */
export interface RuleCouponImportRow {
  code: string
  member: string | null
}

/**
 * HQ's check of an import's rows before anything is imported: the codes SIS.Coupons already holds
 * (in any campaign), and the member ids it does not know. Every other row is good to import.
 */
export interface RuleCouponImportCheck {
  inUse: string[]
  unknownMembers: string[]
}

/** What Delete unused answers: the batch's unused codes it removed, and the codes that stay. */
export interface RuleCouponUnusedDeleted {
  deleted: number
  kept: number
}

// Customer sessions, for support, are `@/core/models/rule-session` (ticket 527, the real 2760 shapes).

// ── Support's look-ups (ticket 519): the coupon finder and a member's rule-engine view ──────────
// Provisional like the rest of this file: BackOffice 2754 (the coupon and its wallet) and 2744 (the
// budgets used) name no door for them yet. Days are local `yyyy-MM-dd`, moments local, never a `Z`.

/** One sale that redeemed a code. */
export interface RuleCouponUse {
  /** When the sale closed — a local moment. */
  at: string
  store: string
  /** The customer session's sale id (Campaigns ▸ Sessions opens it). */
  saleId: string
}

/** A code found across every campaign: where it belongs, where it is, and who used it. */
export interface RuleCouponFound {
  code: string
  campaignId: string
  campaignCode: string
  campaignName: Says
  batch: string
  kind: RuleCouponKind
  status: RuleCouponStatus
  /** First day it works; null = at once. */
  from: string | null
  /** Last day it works; null = no end of its own. */
  until: string | null
  /** The member it is bound to, or null for anyone. */
  member: string | null
  /** Oldest first, as HQ answers them. */
  uses: RuleCouponUse[]
}

/** How support looks a member up: by loyalty id, or by mobile. */
export type RuleMemberKey = 'loyaltyId' | 'mobile'

/** A member's points balance: spend points and tier points named separately, and what is pending. */
export interface RuleMemberPoints {
  /** Spend points: what the member can redeem. */
  spend: number
  /** Tier points: what the member's tier is counted on. */
  tier: number
  /** Points earned but still pending (the return window); not yet in the spend balance. */
  pending: number
}

/** A member as the rule engine reads them. */
export interface RuleMember {
  /** The loyalty id. */
  id: string
  name: string
  mobile: string | null
  /** The tier's name as HQ answers it; null when the member has none. */
  tier: string | null
  points: RuleMemberPoints
}

/** One code in the member's coupon wallet: bound to them, enabled, unredeemed and in date (2754). */
export interface RuleWalletCoupon {
  code: string
  campaignId: string
  campaignCode: string
  campaignName: Says
  from: string | null
  until: string | null
}

/** One profile-scope budget the member has used: its counter for the member in its current period. */
export interface RuleMemberBudget {
  campaignId: string
  campaignCode: string
  campaignName: Says
  budgetId: string
  name: string
  limit: RuleBudgetLimit
  /** The limit's figure. */
  value: number
  period: RuleBudgetPeriod
  /** The member's counter in the current period (lifetime: ever). May pass `value` (ADR 0091). */
  used: number
  /** The campaign's currency, for a money or points limit; null when not known. */
  currency: string | null
}

// ── The store engine switch (ticket 517, re-pointed in 528; BackOffice 2745, ADR 0093) ──────────
// `POST Rules/Switch/Flip` and `GET Rules/Switch/History` (grant RuleEngineSwitch 02 / 03); the
// store list is `POST Rules/Authoring/Lookups/stores` (grant RuleAuthoring — see ticket 528).

/** Which promotion engine a store runs. A store HQ holds no row for runs `BonusBuy`. */
export type PromotionEngine = 'BonusBuy' | 'Rule'

/** `POST Rules/Switch/Flip`: the store, the engine it moves to and the reason (required). There is
 *  no `from`: HQ reads it under a lock. */
export interface StoreEngineFlip {
  storeCode: string
  engine: PromotionEngine
  reason: string
}

/** What a flip from Rule back to BonusBuy leaves in flight at the store. A warning, never a block:
 *  each list holds at most 100 entries, and `truncated` says one was cut. */
export interface RuleEngineInFlight {
  /** The published campaigns: none of them reaches the store's tills from its next shift open. */
  liveCampaigns: { code: string; nameEn: string; nameAr: string }[]
  /** The store's paying sessions (local times): they keep the engine they were opened under. */
  openSessions: { sessionId: string; channel: string; openedAt: string; paidAt: string }[]
  /** The store-scope budget counters with something used or held at the store. */
  storeBudgets: { campaignId: string; budgetId: string; periodKey: string; used: number; held: number }[]
  truncated: boolean
}

/** One flip, as the flip answers it and as the history lists it. `changedAt` is local; `inFlight`
 *  is null when the flip warned of nothing (every flip but Rule → BonusBuy, or nothing in flight). */
export interface StoreEngineChange {
  storeCode: string
  fromEngine: PromotionEngine
  engine: PromotionEngine
  changedBy: string
  changedAt: string
  reason: string
  inFlight: RuleEngineInFlight | null
}

/** The store's engine now. `isSet` is false when HQ holds no row (it then reads BonusBuy, and
 *  `changedAt` / `changedBy` are null). */
export interface StoreEngineReading {
  storeCode: string
  engine: PromotionEngine
  isSet: boolean
  changedAt: string | null
  changedBy: string | null
}

/** `GET Rules/Switch/History?storeCode=`: the engine now and its flips, newest first (at most 200). */
export interface StoreEngineHistory {
  store: StoreEngineReading
  changes: StoreEngineChange[]
}

/** One answer of `Rules/Authoring/Lookups/stores`: an open store, its (English) name, and in
 *  `detail` the engine HQ holds it on. At most 50 per search. Only the fields the switch reads. */
export interface StoreEngineLookupItem {
  code: string
  name: Says
  detail: string | null
}
