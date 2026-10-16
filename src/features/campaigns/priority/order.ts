import type { RuleEvaluationOrder, RuleOrderGroup, RuleOrderNode } from '@/core/models/rule-campaign'

// The evaluation order's moves (ticket 513, ADR 0090), pure: every move answers a NEW order and
// leaves its input alone, and a move that changes nothing answers its input itself. A campaign is
// in ONE place — the base or one group — and a move takes it out of everywhere before placing it.

/** Where a campaign sits: the stackable base, or a group by its id. */
export type OrderPlace = 'base' | string

const isCampaign = (n: RuleOrderNode): n is { c: string } => 'c' in n
const isGroup = (n: RuleOrderNode): n is { g: string } => 'g' in n

/** Every campaign id in the order, base and groups, in evaluation order. */
export function campaignIdsOf(order: RuleEvaluationOrder): string[] {
  return order.base.flatMap((n) => (isCampaign(n) ? [n.c] : (order.groups.find((g) => g.id === n.g)?.items ?? [])))
}

/** The place a campaign sits in, or null when the order does not hold it. */
export function placeOf(order: RuleEvaluationOrder, id: string): OrderPlace | null {
  if (order.base.some((n) => isCampaign(n) && n.c === id)) return 'base'
  return order.groups.find((g) => g.items.includes(id))?.id ?? null
}

/** `list` with the entries at `i` and `i + delta` swapped, or null past either end. */
function swapped<T>(list: T[], i: number, delta: -1 | 1): T[] | null {
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return null
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** One place up (-1) or down (+1) within the campaign's own list; a group in the base is one place. */
export function moveCampaign(order: RuleEvaluationOrder, id: string, delta: -1 | 1): RuleEvaluationOrder {
  const place = placeOf(order, id)
  if (place === 'base') {
    const base = swapped(order.base, order.base.findIndex((n) => isCampaign(n) && n.c === id), delta)
    return base ? { ...order, base } : order
  }
  const group = order.groups.find((g) => g.id === place)
  const items = group && swapped(group.items, group.items.indexOf(id), delta)
  return items ? { ...order, groups: order.groups.map((g) => (g === group ? { ...g, items } : g)) } : order
}

/** A group one place up or down in the base, its campaigns with it. */
export function moveGroup(order: RuleEvaluationOrder, groupId: string, delta: -1 | 1): RuleEvaluationOrder {
  const base = swapped(order.base, order.base.findIndex((n) => isGroup(n) && n.g === groupId), delta)
  return base ? { ...order, base } : order
}

/**
 * A campaign moved to the END of another place — the base or a group. It is taken out of every
 * place first, so it is held once even when HQ listed it twice. Its own place, or a group the
 * order does not have, leaves the order as it was.
 */
export function moveCampaignTo(order: RuleEvaluationOrder, id: string, target: OrderPlace): RuleEvaluationOrder {
  const held = campaignIdsOf(order).filter((x) => x === id).length
  if (held === 1 && placeOf(order, id) === target) return order
  if (target !== 'base' && !order.groups.some((g) => g.id === target)) return order
  const base = order.base.filter((n) => !(isCampaign(n) && n.c === id))
  const groups = order.groups.map((g) => {
    const items = g.items.filter((x) => x !== id)
    return g.id === target ? { ...g, items: [...items, id] } : items.length === g.items.length ? g : { ...g, items }
  })
  return { ...order, base: target === 'base' ? [...base, { c: id }] : base, groups }
}

/** An id no group of the order has (HQ may re-key it on save). */
export function newGroupId(order: RuleEvaluationOrder): string {
  const taken = new Set(order.groups.map((g) => g.id))
  let n = 1
  while (taken.has(`new-${n}`)) n++
  return `new-${n}`
}

/** A default name no group has: `make(n)` for the first n from the group count up that is free. */
export function freshGroupName(order: RuleEvaluationOrder, make: (n: number) => string): string {
  const taken = new Set(order.groups.map((g) => g.name.trim()))
  let n = order.groups.length + 1
  while (taken.has(make(n).trim())) n++
  return make(n)
}

/**
 * HQ's order as the page draws it: each campaign in ONE place (its first), each group placed once
 * in the base, and a group the base does not place added at its end — so every campaign and group
 * HQ answers has a row, and every row a place of its own. A tidy order answers itself.
 */
export function tidyOrder(order: RuleEvaluationOrder): RuleEvaluationOrder {
  const seen = new Set<string>()
  const once = (id: string) => !seen.has(id) && !!seen.add(id)
  const known = new Set(order.groups.map((g) => g.id))
  const placed = new Set<string>()
  const nodes = order.base.filter((n) => (isGroup(n) ? known.has(n.g) && !placed.has(n.g) && !!placed.add(n.g) : true))
  const base = [...nodes, ...order.groups.filter((g) => !placed.has(g.id)).map((g) => ({ g: g.id }))]
  // Campaigns in evaluation order, so the first place wins.
  const items = new Map<string, string[]>()
  const kept = base.filter((n) => {
    if (!isGroup(n)) return once(n.c)
    items.set(n.g, order.groups.find((g) => g.id === n.g)!.items.filter(once))
    return true
  })
  const groups = order.groups
    .filter((g, i) => order.groups.findIndex((x) => x.id === g.id) === i)
    .map((g) => (items.get(g.id)!.length === g.items.length ? g : { ...g, items: items.get(g.id)! }))
  const tidy = kept.length === order.base.length && base.length === order.base.length && groups.every((g, i) => g === order.groups[i]) && groups.length === order.groups.length
  return tidy ? order : { ...order, base: kept, groups }
}

/** A new, empty group at the end of the base: "first that yields", session scope — the prototype's. */
export function addGroup(order: RuleEvaluationOrder, id: string, name: string): RuleEvaluationOrder {
  const group: RuleOrderGroup = { id, name, mode: 'first', scope: 'session', items: [] }
  return { ...order, base: [...order.base, { g: id }], groups: [...order.groups, group] }
}

/** What the reader sets on a group. */
export type GroupPatch = Partial<Pick<RuleOrderGroup, 'name' | 'mode' | 'scope'>>

/** A group's name, mode or scope changed. */
export function setGroup(order: RuleEvaluationOrder, groupId: string, patch: GroupPatch): RuleEvaluationOrder {
  return { ...order, groups: order.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) }
}

/** An EMPTY group deleted, from the groups and from the base; a group with campaigns stays. */
export function removeGroup(order: RuleEvaluationOrder, groupId: string): RuleEvaluationOrder {
  const group = order.groups.find((g) => g.id === groupId)
  if (!group || group.items.length > 0) return order
  return { ...order, base: order.base.filter((n) => !(isGroup(n) && n.g === groupId)), groups: order.groups.filter((g) => g !== group) }
}

/** The groups whose name is blank — a save waits until each has one. */
export function blankGroups(order: RuleEvaluationOrder): string[] {
  return order.groups.filter((g) => !g.name.trim()).map((g) => g.id)
}

/** Whether two orders place, name and set every group and campaign alike. */
export function sameOrder(a: RuleEvaluationOrder, b: RuleEvaluationOrder): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
