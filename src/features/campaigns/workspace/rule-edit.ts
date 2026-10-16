import type { CampaignRule, RuleCondition, RuleEffect } from '@/core/models/rule-campaign'
import { isConditionGroup } from '@/core/rules/sentence'

// The rule builder's edits (ticket 505), each a pure function from the campaign's rules to new
// rules — the history reducer (`./builder-history`) applies them. Nothing is changed in place: an
// edit copies the path it touches and shares the rest, so Undo's snapshots stay as they were.
// An edit that finds nothing to change answers the SAME array, which the history takes as "no step".
//
// Rules and blocks are found by id; a condition can sit inside a group (the catalogue's `group`
// block) at any depth.

type Rules = CampaignRule[]

function mapRule(rules: Rules, ruleId: string, fn: (r: CampaignRule) => CampaignRule): Rules {
  let changed = false
  const next = rules.map((r) => {
    if (r.id !== ruleId) return r
    const n = fn(r)
    if (n !== r) changed = true
    return n
  })
  return changed ? next : rules
}

/** Moves the item with `id` by `delta` places within `list`; the same list when it cannot. */
function moveIn<T extends { id: string }>(list: T[], id: string, delta: number): T[] {
  const i = list.findIndex((x) => x.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/**
 * Applies `fn` to the condition list that holds `blockId` (the rule's When, or a group's items, at
 * any depth); the same list when no list holds it.
 */
function inConditionList(items: RuleCondition[], blockId: string, fn: (list: RuleCondition[]) => RuleCondition[]): RuleCondition[] {
  if (items.some((c) => c.id === blockId)) return fn(items)
  let changed = false
  const next = items.map((c) => {
    if (!isConditionGroup(c)) return c
    const inner = inConditionList(c.items, blockId, fn)
    if (inner === c.items) return c
    changed = true
    return { ...c, items: inner }
  })
  return changed ? next : items
}

/** Applies `fn` to the condition list a new condition goes into: the When (`groupId` null) or a group. */
function intoConditionList(items: RuleCondition[], groupId: string, fn: (list: RuleCondition[]) => RuleCondition[]): RuleCondition[] {
  let changed = false
  const next = items.map((c) => {
    if (!isConditionGroup(c)) return c
    const inner = c.id === groupId ? fn(c.items) : intoConditionList(c.items, groupId, fn)
    if (inner === c.items) return c
    changed = true
    return { ...c, items: inner }
  })
  return changed ? next : items
}

const withWhenItems = (r: CampaignRule, items: RuleCondition[]): CampaignRule => (items === r.when.items ? r : { ...r, when: { ...r.when, items } })
const withThen = (r: CampaignRule, then: RuleEffect[]): CampaignRule => (then === r.then ? r : { ...r, then })

// ── Rules ────────────────────────────────────────────────────────────────────────────────────────

export const addRule = (rules: Rules, rule: CampaignRule): Rules => [...rules, rule]

export const renameRule = (rules: Rules, ruleId: string, name: string): Rules =>
  mapRule(rules, ruleId, (r) => (r.name === name ? r : { ...r, name }))

export const moveRule = (rules: Rules, ruleId: string, delta: number): Rules => moveIn(rules, ruleId, delta)

export const deleteRule = (rules: Rules, ruleId: string): Rules => {
  const next = rules.filter((r) => r.id !== ruleId)
  return next.length === rules.length ? rules : next
}

export const setWhenMode = (rules: Rules, ruleId: string, mode: 'all' | 'any'): Rules =>
  mapRule(rules, ruleId, (r) => (r.when.mode === mode ? r : { ...r, when: { ...r.when, mode } }))

export const setPartial = (rules: Rules, ruleId: string, partial: CampaignRule['partial']): Rules =>
  mapRule(rules, ruleId, (r) => (r.partial === partial ? r : { ...r, partial }))

// ── Blocks ───────────────────────────────────────────────────────────────────────────────────────

/** A condition at the end of the rule's When, or of the group `groupId`. */
export const addCondition = (rules: Rules, ruleId: string, groupId: string | null, condition: RuleCondition): Rules =>
  mapRule(rules, ruleId, (r) =>
    withWhenItems(r, groupId === null ? [...r.when.items, condition] : intoConditionList(r.when.items, groupId, (list) => [...list, condition])),
  )

export const addEffect = (rules: Rules, ruleId: string, effect: RuleEffect): Rules =>
  mapRule(rules, ruleId, (r) => withThen(r, [...r.then, effect]))

/** One field of a condition (at any depth) or an effect. */
export const setBlockField = (rules: Rules, ruleId: string, blockId: string, key: string, value: unknown): Rules =>
  mapRule(rules, ruleId, (r) => withThen(withWhenItems(r, setIn(r.when.items, blockId, key, value)), setIn(r.then, blockId, key, value)))

/** `list` with the block `blockId` (inside a group too) given `key = value`; the same list when nothing changed. */
function setIn<T extends { id: string; [field: string]: unknown }>(list: T[], blockId: string, key: string, value: unknown): T[] {
  let changed = false
  const next = list.map((b) => {
    if (b.id === blockId) {
      if (b[key] === value) return b
      changed = true
      return { ...b, [key]: value }
    }
    if (isConditionGroup(b as unknown as RuleCondition)) {
      const inner = setIn(b.items as T[], blockId, key, value)
      if (inner === b.items) return b
      changed = true
      return { ...b, items: inner }
    }
    return b
  })
  return changed ? next : list
}

/** Moves a condition within its own list (the When or its group), or an effect within the Then. */
export const moveBlock = (rules: Rules, ruleId: string, blockId: string, delta: number): Rules =>
  mapRule(rules, ruleId, (r) => withThen(withWhenItems(r, inConditionList(r.when.items, blockId, (list) => moveIn(list, blockId, delta))), moveIn(r.then, blockId, delta)))

/** Deletes a condition (a group with everything in it) or an effect. */
export const deleteBlock = (rules: Rules, ruleId: string, blockId: string): Rules =>
  mapRule(rules, ruleId, (r) => {
    const then = r.then.filter((e) => e.id !== blockId)
    return withThen(withWhenItems(r, inConditionList(r.when.items, blockId, (list) => list.filter((c) => c.id !== blockId))), then.length === r.then.length ? r.then : then)
  })
