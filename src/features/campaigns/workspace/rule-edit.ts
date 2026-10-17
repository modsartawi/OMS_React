import type { CampaignRule, RuleBundle, RuleCondition, RuleEffect, RulePartial } from '@/core/models/rule-campaign'
import { isConditionGroup } from '@/core/rules/sentence'
import { keyOf } from './block-keys'

// The rule builder's edits (ticket 505, schema 1 in 522), each a pure function from the campaign's
// rules to new rules — the history reducer (`./builder-history`) applies them. Nothing is changed in
// place: an edit copies the path it touches and shares the rest, so Undo's snapshots stay as they
// were. An edit that finds nothing to change answers the SAME array, which the history takes as
// "no step".
//
// Rules are found by id; conditions and effects by their builder key (`./block-keys`) — schema 1
// gives them no id. A condition can sit inside a group (`conditions`) at any depth.

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

/** Moves the item at `i` by `delta` places within `list`; the same list when it cannot. */
function moveAt<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Applies `fn` to the condition list that holds `key` (the When, or a group's, at any depth). */
function inConditionList(items: RuleCondition[], key: string, fn: (list: RuleCondition[]) => RuleCondition[]): RuleCondition[] {
  if (items.some((c) => keyOf(c) === key)) return fn(items)
  let changed = false
  const next = items.map((c) => {
    if (!isConditionGroup(c)) return c
    const inner = inConditionList(c.conditions, key, fn)
    if (inner === c.conditions) return c
    changed = true
    return { ...c, conditions: inner }
  })
  return changed ? next : items
}

/** Applies `fn` to the conditions of the group keyed `groupKey`, at any depth. */
function intoGroup(items: RuleCondition[], groupKey: string, fn: (list: RuleCondition[]) => RuleCondition[]): RuleCondition[] {
  let changed = false
  const next = items.map((c) => {
    if (!isConditionGroup(c)) return c
    const inner = keyOf(c) === groupKey ? fn(c.conditions) : intoGroup(c.conditions, groupKey, fn)
    if (inner === c.conditions) return c
    changed = true
    return { ...c, conditions: inner }
  })
  return changed ? next : items
}

const withWhen = (r: CampaignRule, when: RuleCondition[]): CampaignRule => (when === r.when ? r : { ...r, when })
const withThen = (r: CampaignRule, then: RuleEffect[]): CampaignRule => (then === r.then ? r : { ...r, then })

// ── Rules ────────────────────────────────────────────────────────────────────────────────────────

export const addRule = (rules: Rules, rule: CampaignRule): Rules => [...rules, rule]

export const renameRule = (rules: Rules, ruleId: string, name: string): Rules =>
  mapRule(rules, ruleId, (r) => (r.name === name ? r : { ...r, name }))

export const moveRule = (rules: Rules, ruleId: string, delta: number): Rules => moveAt(rules, rules.findIndex((r) => r.id === ruleId), delta)

export const deleteRule = (rules: Rules, ruleId: string): Rules => {
  const next = rules.filter((r) => r.id !== ruleId)
  return next.length === rules.length ? rules : next
}

export const setPartial = (rules: Rules, ruleId: string, partial: RulePartial): Rules =>
  mapRule(rules, ruleId, (r) => ((r.partial ?? 'refuse') === partial ? r : { ...r, partial }))

/** The rule's bundle (`rule.bundle`), or none. */
export const setBundle = (rules: Rules, ruleId: string, bundle: RuleBundle | null): Rules =>
  mapRule(rules, ruleId, (r) => {
    if (JSON.stringify(r.bundle ?? null) === JSON.stringify(bundle)) return r
    if (bundle) return { ...r, bundle }
    const { bundle: _gone, ...rest } = r
    return rest
  })

// ── Blocks ───────────────────────────────────────────────────────────────────────────────────────

/** A condition at the end of the rule's When, or of the group keyed `groupKey`. */
export const addCondition = (rules: Rules, ruleId: string, groupKey: string | null, condition: RuleCondition): Rules =>
  mapRule(rules, ruleId, (r) => withWhen(r, groupKey === null ? [...r.when, condition] : intoGroup(r.when, groupKey, (list) => [...list, condition])))

export const addEffect = (rules: Rules, ruleId: string, effect: RuleEffect): Rules => mapRule(rules, ruleId, (r) => withThen(r, [...r.then, effect]))

/** `list` with the block keyed `key` (inside a group too) given `field = value`; the same list when nothing changed. */
function setIn<T extends object>(list: T[], key: string, field: string, value: unknown): T[] {
  let changed = false
  const next = list.map((b) => {
    const raw = b as Record<string, unknown>
    if (keyOf(b) === key) {
      if (raw[field] === value) return b
      changed = true
      return { ...b, [field]: value }
    }
    if (isConditionGroup(b as unknown as RuleCondition)) {
      const inner = setIn(raw.conditions as RuleCondition[], key, field, value)
      if (inner === raw.conditions) return b
      changed = true
      return { ...b, conditions: inner }
    }
    return b
  })
  return changed ? next : list
}

/** One field of a condition (at any depth) or an effect. `undefined` leaves the field out. */
export const setBlockField = (rules: Rules, ruleId: string, key: string, field: string, value: unknown): Rules =>
  mapRule(rules, ruleId, (r) => withThen(withWhen(r, setIn(r.when, key, field, value)), setIn(r.then, key, field, value)))

/** Moves a condition within its own list (the When or its group), or an effect within the Then. */
export const moveBlock = (rules: Rules, ruleId: string, key: string, delta: number): Rules =>
  mapRule(rules, ruleId, (r) =>
    withThen(
      withWhen(r, inConditionList(r.when, key, (list) => moveAt(list, list.findIndex((c) => keyOf(c) === key), delta))),
      moveAt(r.then, r.then.findIndex((e) => keyOf(e) === key), delta),
    ),
  )

/** Deletes a condition (a group with everything in it) or an effect. */
export const deleteBlock = (rules: Rules, ruleId: string, key: string): Rules =>
  mapRule(rules, ruleId, (r) => {
    const then = r.then.filter((e) => keyOf(e) !== key)
    return withThen(withWhen(r, inConditionList(r.when, key, (list) => list.filter((c) => keyOf(c) !== key))), then.length === r.then.length ? r.then : then)
  })
