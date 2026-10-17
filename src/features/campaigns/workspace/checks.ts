import type { CampaignRule, RuleCondition, RuleIssue, RuleValidation } from '@/core/models/rule-campaign'
import { RULE_GROUP_CHECK } from '@/core/models/rule-campaign'
import { blockType, isConditionGroup } from '@/core/rules/sentence'
import { keyOf } from './block-keys'

// HQ's checks of a draft, read where they point (ticket 508; schema 1 in 522). Pure. The checks are
// the SAVED draft's validation (`Drafts/Load` / `Save` answer it): each issue points by `path`
// (`campaign.rules[1].when[1].conditions[0].amount`) into the campaign HQ checked. The builder
// reads that path in the rules as they were saved, takes the block's builder key, and finds the
// key on the rules as they are on screen — so a block moved since the save is still found and one
// deleted since is "gone", never someone else's place. Errors block "Ask for approval"; warnings
// never do (511 reads the same verdict).

export type CheckSeverity = 'error' | 'warning'

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
      /** A condition's, effect's or value's builder key; a filter's id. */
      blockId: string
      /** A condition's or an effect's catalogue type; null for a filter or a value. */
      type: string | null
      index: number
      /** The key of the group a condition sits in; null at the top of When. */
      groupId: string | null
      field: string | null
    }
  /** The rule or block is no longer on screen; `ruleIndex` = its rule's place when only the block is gone. */
  | { at: 'gone'; ruleIndex: number | null }

export interface LocatedCheck {
  message: RuleIssue
  place: CheckPlace
  /** Stable within one answer — the list's key. */
  key: string
}

type Step = { name: string; index: number | null }

/** `campaign.rules[1].when[0].amount` → steps; null for a path that is not one. */
export function pathSteps(path: string): Step[] | null {
  const steps: Step[] = []
  for (const part of path.split('.')) {
    const m = /^([^[\]]+)(?:\[(\d+)\])?$/.exec(part)
    if (!m) return null
    steps.push({ name: m[1], index: m[2] === undefined ? null : Number(m[2]) })
  }
  return steps
}

/** A condition's place on screen, by its key: its index and its group's key. */
function findCondition(items: RuleCondition[], key: string, groupId: string | null): { index: number; groupId: string | null; c: RuleCondition } | null {
  for (let i = 0; i < items.length; i++) {
    const c = items[i]
    if (keyOf(c) === key) return { index: i, groupId, c }
    if (isConditionGroup(c)) {
      const inner = findCondition(c.conditions, key, keyOf(c))
      if (inner) return inner
    }
  }
  return null
}

const rest = (steps: Step[]): string | null => (steps.length ? steps.map((s) => (s.index === null ? s.name : `${s.name}[${s.index}]`)).join('.') : null)

/** Where an issue points on screen: read in the saved rules, found by key or id in the present ones. */
export function locateCheck(saved: CampaignRule[], present: CampaignRule[], issue: RuleIssue): CheckPlace {
  const steps = pathSteps(issue.path ?? '')
  if (!steps || steps[0]?.name !== 'campaign' || steps[1]?.name !== 'rules' || steps[1].index === null) return { at: 'campaign' }
  const was = saved[steps[1].index]
  const ruleIndex = was ? present.findIndex((r) => r.id === was.id) : -1
  if (ruleIndex < 0) return { at: 'gone', ruleIndex: null }
  const rule = present[ruleIndex]
  const head = steps[2]
  const after = steps.slice(3)
  const atRule = (field: string | null): CheckPlace => ({ at: 'rule', ruleId: rule.id, ruleIndex, field })
  if (!head) return atRule(null)
  const block = (kind: CheckBlockKind, blockId: string, type: string | null, index: number, groupId: string | null, field: string | null): CheckPlace => ({
    at: 'block',
    ruleId: rule.id,
    ruleIndex,
    kind,
    blockId,
    type,
    index,
    groupId,
    field,
  })
  if (head.index === null) return atRule(rest(steps.slice(2)))
  switch (head.name) {
    case 'when': {
      // Walk the saved conditions down through groups' `conditions[i]`.
      let list = was.when
      let c = list[head.index]
      let i = 0
      while (c && after[i]?.name === 'conditions' && after[i].index !== null && isConditionGroup(c)) {
        list = c.conditions
        c = list[after[i].index!]
        i++
      }
      if (!c) return { at: 'gone', ruleIndex }
      const found = findCondition(rule.when, keyOf(c), null)
      if (!found) return { at: 'gone', ruleIndex }
      return block('condition', keyOf(c), blockType(found.c), found.index, found.groupId, rest(after.slice(i)))
    }
    case 'then': {
      const e = was.then[head.index]
      const index = e ? rule.then.findIndex((x) => keyOf(x) === keyOf(e)) : -1
      if (index < 0) return { at: 'gone', ruleIndex }
      return block('effect', keyOf(e), blockType(rule.then[index]), index, null, rest(after))
    }
    case 'filters': {
      const f = was.filters[head.index]
      const index = f ? rule.filters.findIndex((x) => x.id === f.id) : -1
      if (index < 0) return { at: 'gone', ruleIndex }
      return block('filter', f.id, null, index, null, rest(after))
    }
    case 'values': {
      const v = was.values[head.index]
      const index = v ? rule.values.findIndex((x) => keyOf(x) === keyOf(v)) : -1
      if (index < 0) return { at: 'gone', ruleIndex }
      return block('value', keyOf(v), null, index, null, rest(after))
    }
    default:
      return atRule(rest(steps.slice(2)))
  }
}

/** Only a warning is a warning: a severity this client does not know reads as an error, so it blocks. */
export const severityOf = (m: RuleIssue): CheckSeverity => (m.severity === 'warning' ? 'warning' : 'error')

/** Every issue of a validation, errors first, then warnings, HQ's order kept within each. */
export const issuesOf = (v: RuleValidation | null | undefined): RuleIssue[] => (v ? [...v.errors, ...v.warnings] : [])

/** Every issue, located: errors first, then warnings. */
export function locateChecks(saved: CampaignRule[], present: CampaignRule[], validation: RuleValidation | null | undefined): LocatedCheck[] {
  const keyed = issuesOf(validation).map((message, i) => ({ message, place: locateCheck(saved, present, message), key: String(i) }))
  return [...keyed.filter((l) => severityOf(l.message) === 'error'), ...keyed.filter((l) => severityOf(l.message) === 'warning')]
}

/** One block's issues: all of them, and by field (`''` = the block as a whole). */
export interface BlockChecks {
  all: RuleIssue[]
  byField: Record<string, RuleIssue[]>
}

/** The located issues, indexed: by block key (or filter id), and on each rule itself. */
export interface ChecksIndex {
  blocks: ReadonlyMap<string, BlockChecks>
  rules: ReadonlyMap<string, RuleIssue[]>
}

export const NO_BLOCK_CHECKS: BlockChecks = { all: [], byField: {} }

export function indexChecks(located: LocatedCheck[]): ChecksIndex {
  const blocks = new Map<string, BlockChecks>()
  const rules = new Map<string, RuleIssue[]>()
  for (const { place, message } of located) {
    if (place.at === 'rule') {
      const list = rules.get(place.ruleId) ?? []
      list.push(message)
      rules.set(place.ruleId, list)
    } else if (place.at === 'block') {
      const b = blocks.get(place.blockId) ?? { all: [], byField: {} }
      b.all.push(message)
      // A field's first segment (`label.ar` → `label`) is its control.
      ;(b.byField[(place.field ?? '').split(/[.[]/)[0]] ??= []).push(message)
      blocks.set(place.blockId, b)
    }
  }
  return { blocks, rules }
}

/** The approval verdict: the saved draft's errors block "Ask for approval", its warnings never do. */
export function approvalVerdict(validation: RuleValidation | null | undefined): { errors: number; warnings: number; blocked: boolean } {
  const errors = validation?.errors.length ?? 0
  const warnings = validation?.warnings.length ?? 0
  return { errors, warnings, blocked: errors > 0 }
}

/**
 * Where a click on a message takes the reader: the rule to expand, the panel or filter editor to
 * open (`open`), then the control to focus — the first of `ids` on the page, else the first control
 * inside `within`. Null when the message points at no place on screen.
 */
export function focusTarget(place: CheckPlace): { ruleId: string; open: string | null; ids: string[]; within: string | null } | null {
  if (place.at === 'campaign' || place.at === 'gone') return null
  const { ruleId } = place
  if (place.at === 'rule') return { ruleId, open: null, ids: [`rule-name-${ruleId}`], within: null }
  const { blockId } = place
  const field = place.field ? place.field.split(/[.[]/)[0] : null
  switch (place.kind) {
    case 'filter':
      if (field === 'name') return { ruleId, open: blockId, ids: [`filter-${blockId}-name`], within: null }
      return { ruleId, open: blockId, ids: [], within: field ? `#filter-editor-${blockId} [data-lookup="${field}"]` : `#filter-editor-${blockId}` }
    case 'value':
      return { ruleId, open: null, ids: [field === 'name' ? `value-name-${blockId}` : `value-formula-${blockId}`], within: null }
    default:
      if (place.type === RULE_GROUP_CHECK) return { ruleId, open: null, ids: [], within: `[data-condition-group="${blockId}"]` }
      return { ruleId, open: blockId, ids: field ? [`panel-${blockId}-${field}`, `panel-${blockId}-${field}-en`] : [], within: `[data-block-panel="${blockId}"]` }
  }
}
