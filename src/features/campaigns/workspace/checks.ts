import type { CampaignRule, RuleCampaignChecks, RuleCheckMessage, RuleCheckSeverity, RuleCondition } from '@/core/models/rule-campaign'
import { isConditionGroup } from '@/core/rules/sentence'

// HQ's checks of a draft, read where they point (ticket 508). Pure. HQ points each message at
// rule → block → field BY ID; the builder finds it on the rules as they are on screen, so a block
// moved since the save is still found and one deleted since is "gone" — never someone else's place.
// Whether the draft may be sent for approval is HQ's errors alone; warnings never block (511 reads
// the same verdict).

/** What a block is, for the "where" of a message. */
export type CheckBlockKind = 'condition' | 'effect' | 'filter' | 'value'

/** Where a message points, on screen. Indexes are 0-based places in their own list. */
export type CheckPlace =
  | { at: 'campaign' }
  | { at: 'rule'; ruleId: string; ruleIndex: number; field: string | null }
  | {
      at: 'block'
      ruleId: string
      ruleIndex: number
      kind: CheckBlockKind
      blockId: string
      /** A condition's or an effect's catalogue type; null for a filter or a value. */
      type: string | null
      index: number
      /** The group a condition sits in; null at the top of When. */
      groupId: string | null
      field: string | null
    }
  /** The rule or block is no longer on screen (deleted since the save); `ruleIndex` = its rule's
   *  place when only the block is gone. */
  | { at: 'gone'; ruleIndex: number | null }

export interface LocatedCheck {
  message: RuleCheckMessage
  place: CheckPlace
  /** Stable within one answer — the list's key. */
  key: string
}

function findCondition(items: RuleCondition[], id: string, groupId: string | null): { index: number; groupId: string | null; type: string } | null {
  for (let i = 0; i < items.length; i++) {
    const c = items[i]
    if (c.id === id) return { index: i, groupId, type: c.type }
    if (isConditionGroup(c)) {
      const inner = findCondition(c.items, id, c.id)
      if (inner) return inner
    }
  }
  return null
}

export function locateCheck(rules: CampaignRule[], m: RuleCheckMessage): CheckPlace {
  if (m.ruleId == null) return { at: 'campaign' }
  const ruleIndex = rules.findIndex((r) => r.id === m.ruleId)
  if (ruleIndex < 0) return { at: 'gone', ruleIndex: null }
  const rule = rules[ruleIndex]
  const field = m.field ?? null
  if (m.blockId == null) return { at: 'rule', ruleId: rule.id, ruleIndex, field }
  const base = { at: 'block' as const, ruleId: rule.id, ruleIndex, blockId: m.blockId }
  const cond = findCondition(rule.when.items, m.blockId, null)
  if (cond) return { ...base, kind: 'condition', type: cond.type, index: cond.index, groupId: cond.groupId, field }
  const effect = rule.then.findIndex((e) => e.id === m.blockId)
  if (effect >= 0) return { ...base, kind: 'effect', type: rule.then[effect].type, index: effect, groupId: null, field }
  const filter = rule.filters.findIndex((f) => f.id === m.blockId)
  if (filter >= 0) return { ...base, kind: 'filter', type: null, index: filter, groupId: null, field }
  const value = rule.values.findIndex((v) => v.id === m.blockId)
  if (value >= 0) return { ...base, kind: 'value', type: null, index: value, groupId: null, field }
  return { at: 'gone', ruleIndex }
}

/**
 * How the builder reads a message's severity. Only a warning is a warning: a severity this client
 * does not know (the contract is provisional, BackOffice 2758) reads as an error, so it blocks
 * approval rather than slip through.
 */
export const severityOf = (m: RuleCheckMessage): RuleCheckSeverity => (m.severity === 'warning' ? 'warning' : 'error')

/** Every message, located: errors first, then warnings, HQ's order kept within each. */
export function locateChecks(rules: CampaignRule[], checks: RuleCampaignChecks): LocatedCheck[] {
  const keyed = checks.messages.map((message, i) => ({ message, place: locateCheck(rules, message), key: String(i) }))
  return [...keyed.filter((l) => severityOf(l.message) === 'error'), ...keyed.filter((l) => severityOf(l.message) === 'warning')]
}

/** One block's messages: all of them, and by field (`''` = the block as a whole). */
export interface BlockChecks {
  all: RuleCheckMessage[]
  byField: Record<string, RuleCheckMessage[]>
}

/** The located messages, indexed once per answer and edit: by block id, and on each rule itself. */
export interface ChecksIndex {
  blocks: ReadonlyMap<string, BlockChecks>
  rules: ReadonlyMap<string, RuleCheckMessage[]>
}

export const NO_BLOCK_CHECKS: BlockChecks = { all: [], byField: {} }

/** Indexes `located`, keeping its order (errors first) within every list. */
export function indexChecks(located: LocatedCheck[]): ChecksIndex {
  const blocks = new Map<string, BlockChecks>()
  const rules = new Map<string, RuleCheckMessage[]>()
  for (const { place, message } of located) {
    if (place.at === 'rule') {
      const list = rules.get(place.ruleId) ?? []
      list.push(message)
      rules.set(place.ruleId, list)
    } else if (place.at === 'block') {
      const b = blocks.get(place.blockId) ?? { all: [], byField: {} }
      b.all.push(message)
      ;(b.byField[place.field ?? ''] ??= []).push(message)
      blocks.set(place.blockId, b)
    }
  }
  return { blocks, rules }
}

/**
 * The approval verdict: the draft's errors block "Ask for approval", its warnings never do. Every
 * message counts, found on screen or not — HQ checked the SAVED draft, and that is what is sent.
 */
export function approvalVerdict(checks: RuleCampaignChecks): { errors: number; warnings: number; blocked: boolean } {
  const warnings = checks.messages.filter((m) => severityOf(m) === 'warning').length
  const errors = checks.messages.length - warnings
  return { errors, warnings, blocked: errors > 0 }
}

/**
 * Where a click on a message takes the reader: the rule to expand, the panel or filter editor to
 * open (`open`, the builder's one open id), then the control to focus — the first of `ids` on the
 * page, else the first control inside `within`. Null when the message points at no place on screen.
 * The ids are the ones the builder gives its controls (`BlockPanel`, `RuleValues`, `RuleCard`).
 */
export function focusTarget(place: CheckPlace): { ruleId: string; open: string | null; ids: string[]; within: string | null } | null {
  if (place.at === 'campaign' || place.at === 'gone') return null
  const { ruleId } = place
  if (place.at === 'rule') return { ruleId, open: null, ids: [`rule-name-${ruleId}`], within: null }
  const { blockId, field } = place
  switch (place.kind) {
    case 'filter': {
      // The filter editor's controls (`./FilterEditor`, opened with the filter's id as its `data`).
      const lookup = field ? FILTER_LOOKUPS[field] : undefined
      if (field === 'name' || field === 'scope') return { ruleId, open: blockId, ids: [`filter-${blockId}-${field}`], within: null }
      return { ruleId, open: blockId, ids: [], within: lookup ? `#filter-editor-${blockId} [data-lookup="${lookup}"]` : `#filter-editor-${blockId}` }
    }
    case 'value':
      return { ruleId, open: null, ids: [field === 'name' ? `value-name-${blockId}` : `value-formula-${blockId}`], within: null }
    default:
      // A group has no panel: its own all / any is the first control in it.
      if (place.type === 'group') return { ruleId, open: null, ids: [], within: `[data-condition-group="${blockId}"]` }
      // An EN + AR field's English input carries `-en`.
      return { ruleId, open: blockId, ids: field ? [`panel-${blockId}-${field}`, `panel-${blockId}-${field}-en`] : [], within: `[data-block-panel="${blockId}"]` }
  }
}

/** A filter's pick fields → the editor's search input for them. */
const FILTER_LOOKUPS: Record<string, string> = { cats: 'cats', colls: 'colls', skus: 'skus', exclCats: 'excl' }
