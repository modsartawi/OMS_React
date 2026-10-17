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
export const RULE_CAMPAIGN_STATUSES = ['draft', 'waitingForApproval', 'live', 'disabled'] as const
export type RuleCampaignStatus = (typeof RULE_CAMPAIGN_STATUSES)[number]

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
export const RULE_FILTER_SCOPES = ['items', 'fees', 'itemsAndFees'] as const
export type RuleFilterScope = (typeof RULE_FILTER_SCOPES)[number]

export interface RuleItemFilter {
  id: string
  name: string
  cats: string[]
  colls: string[]
  skus: string[]
  exclCats: string[]
  scope: RuleFilterScope
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

// The guessed vocabulary INSIDE a block's open fields — named here, in the PROVISIONAL file, so a
// re-point (520) edits one place and the compiler finds every reader (spec 2737 standards reviews).

/** The catalogue's `group` block: a nested all / any of conditions. */
export const RULE_GROUP_TYPE = 'group'
export type RuleConditionGroup = RuleCondition & { mode: unknown; items: RuleCondition[] }

/** One part of a bundle (an `itemParts` field): N units of a filter, by id. */
export interface RuleItemPart {
  of: string
  count: number | null
}

/** A `timing` field: none, N days or hours after, or `on` a local `yyyy-MM-dd` day. */
export const RULE_TIMING_MODES = ['none', 'afterDays', 'afterHours', 'on'] as const
export type RuleTimingMode = (typeof RULE_TIMING_MODES)[number]
export interface RuleTiming {
  mode: RuleTimingMode
  value: number | string | null
}

/** A discount's `unitFrom` word for a percent (anything else is an amount, in a currency). */
export const RULE_PERCENT_UNIT = 'percent'
/** A points field's `unitFrom` word for plain points (anything else is a currency's worth). */
export const RULE_POINTS_UNIT = 'PTS'
/** The effect that takes points as a tender: a rule with one says what a short member gets (`partial`). */
export const RULE_BURN_POINTS = 'burnPoints'

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

/** A stamp with the actor's note — an ask for approval, a send back. */
export type RuleCampaignNoteStamp = RuleCampaignStamp & { note: string }

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
  approval: RuleCampaignNoteStamp | null
  /** Set on a draft an approver sent back (ticket 511): who, when and why, until it is asked again.
   *  Optional: a campaign never sent back may leave it out. */
  sentBack?: RuleCampaignNoteStamp | null
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

// ── Lookups (tickets 506, 509; HQ's doors are BackOffice 2758) ──────────────────────────────────
// What "Certain items…" searches on HQ: categories, collections, and materials by SKU or name; and
// what Settings ▸ Audience picks from: countries, sales channels and stores.

export type RuleLookupKind = 'categories' | 'collections' | 'materials' | 'countries' | 'channels' | 'stores'

/** One hit of a lookup: a category, a collection, a material (its SKU), a country, a channel or a
 *  store, and its name. */
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

// ── The checks (ticket 508; HQ's door is BackOffice 2758) ────────────────────────────────────────
// HQ validates the saved draft and answers its messages, each pointed at rule → block → field BY
// ID. Errors block "Ask for approval" (511); warnings do not. The client never decides what is wrong
// with a rule: it shows HQ's messages where they point.

export type RuleCheckSeverity = 'error' | 'warning'

/**
 * One of HQ's messages about the draft. `message` is HQ's own text, shown as data. `ruleId` null =
 * the campaign as a whole; `blockId` = a condition (in a group too), an effect, a filter or a named
 * value of that rule, null = the rule itself; `field` = the block's catalogue field key (a filter's
 * or a value's own `name` / `formula`), null = the block as a whole.
 */
export interface RuleCheckMessage {
  severity: RuleCheckSeverity
  code: string
  message: string
  ruleId: string | null
  blockId: string | null
  field: string | null
}

/** HQ's checks of a campaign's saved draft. */
export interface RuleCampaignChecks {
  messages: RuleCheckMessage[]
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

// ── Settings (ticket 509; HQ's doors are BackOffice 2758) ────────────────────────────────────────
// Settings ▸ Details, Schedule, Audience, Features and Offline each save on their own: one door per
// page, each taking its page's part (`RuleCampaignSchedule`, `RuleCampaignAudience`,
// `RuleCampaignFeatures`, below for the other two) and answering the whole campaign as saved. A
// feature switched off while a block uses it is refused on the standard envelope.

/** What Settings ▸ Details saves: the name in both languages (both required) and the description. */
export interface RuleCampaignDetails {
  name: Says
  description: string
}

/** What Settings ▸ Offline saves: "online only" — keep an offline-safe campaign off offline tills. */
export interface RuleCampaignOffline {
  offlineOptOut: boolean
}

/** One reason HQ gives for a campaign needing HQ (a budget, the member profile, a coupon …). */
export interface RuleOfflineReason {
  code: string
  /** HQ's own sentence, shown as data. */
  message: string
}

/**
 * HQ's offline-safe verdict on the campaign's saved draft, worked out from its rules, budgets and
 * audience. `safe` ignores the campaign's own "online only" choice (`offlineOptOut`): it says
 * whether an offline till COULD run it, and `reasons` say why not.
 */
export interface RuleOfflineVerdict {
  safe: boolean
  reasons: RuleOfflineReason[]
}

// ── Budgets (ticket 510; HQ's doors are BackOffice 2758, the live limits 2744) ──────────────────
// Settings ▸ Budgets saves the campaign's budgets as a list, like the other Settings pages. A live
// campaign's counters are read beside it, and a live budget's LIMIT changes on its own door: limits
// are live settings outside the ruleset version pin (ADR 0091), so changing one never republishes.

/** What Settings ▸ Budgets saves: every budget of the campaign. A new one travels with the id the
 *  browser gave it, as a new rule's does. */
export interface RuleCampaignBudgets {
  budgets: RuleCampaignBudget[]
}

/**
 * A live campaign's counter for one budget, in its current period. For a per-key scope (member,
 * coupon code, store, sale) it is the HIGHEST counter of any one key — the one nearest its limit.
 * It may be above the limit (ADR 0091): an overshoot is shown, never clamped.
 */
export interface RuleBudgetUsage {
  budgetId: string
  used: number
}

/** A live budget's new limit — it applies at once, without a publish. */
export interface RuleBudgetLimitChange {
  value: number
}

// ── Versions (ticket 512; HQ's doors are BackOffice 2759) ────────────────────────────────────────
// Every activation publishes an immutable version with who, when and the approver's note. Restore
// makes an earlier version the campaign's NEW draft — never an in-place rollback: the live version
// tills run is untouched until that draft is approved and activated in turn.

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
  options?: RuleLookupItem[]
  /** What the field starts with: a number, a code, or a list of codes for `pick`. */
  default: RuleTemplateValue | null
}

/** A placeholder's value: a number, a code (`choice`), or codes (`pick`). */
export type RuleTemplateValue = number | string | string[]

/** The campaign a template makes, with placeholders standing in for its values. */
export interface RuleTemplateDraft {
  name: Says
  features: RuleCampaignFeatures
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

// ── The store engine switch (ticket 517; HQ's doors are BackOffice 2745, ADR 0093) ──────────────
// PROVISIONAL - shapes invented ahead of BackOffice 2745; re-point in ticket 520

/** Which promotion engine a store runs. A store HQ holds no row for runs `BonusBuy`. */
export type PromotionEngine = 'BonusBuy' | 'Rule'

/** One store as the switch lists it. `engine` is null when HQ holds no row for it (reads BonusBuy);
 *  `changedBy` / `changedAt` (local) / `reason` are the last flip's, null when never flipped. */
export interface StoreEngineRow {
  storeCode: string
  storeName: string
  engine: PromotionEngine | null
  changedBy: string | null
  changedAt: string | null
  reason: string | null
}

/** A flip: the store, the engine the admin saw it on (HQ refuses the flip when that is no longer
 *  so: another admin got there first), the engine it moves to and the admin's reason (required). */
export interface StoreEngineFlip {
  storeCode: string
  from: PromotionEngine
  engine: PromotionEngine
  reason: string
}

/** What is in flight at a store HQ is asked to flip back to bonus buys. A warning, never a block. */
export interface StoreEngineInFlight {
  liveCampaigns: { code: string; name: Says }[]
  /** Open call-center sessions at the store; `created` is local. */
  openSessions: { saleId: string; created: string }[]
  /** Store-scope budgets whose counters run at the store. */
  budgets: { campaignCode: string; budget: string }[]
}

/** One line of a store's switch history: who, when (local), from → to, and why. `from` is null for
 *  a store's first flip (no row, read as BonusBuy). */
export interface StoreEngineHistoryEntry {
  at: string
  by: string
  from: PromotionEngine | null
  to: PromotionEngine
  reason: string
}
