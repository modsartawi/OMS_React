import type {
  RuleDraft,
  RuleDraftSave,
  RuleDraftSummary,
  RuleEvaluationTree,
  RuleTreeGroup,
  RuleTreeNode,
  Says,
} from '@/core/models/rule-campaign'

// The evaluation order's moves (tickets 513, 524; ADR 0090), pure, over the tree HQ answers
// (`Rules/Authoring/Order`'s `tree`: `{ groups, order }`) — the same tree a draft's Drafts/Save
// sends back. Every move answers a NEW tree and leaves its input alone, and a move that changes
// nothing answers its input itself. A campaign is in ONE place — the base or one group — and a move
// takes it out of everywhere before placing it.

/** Where a campaign sits: the stackable base, or a group by its id. */
export type OrderPlace = 'base' | string

const isCampaign = (n: RuleTreeNode): n is { campaign: string } => 'campaign' in n
const isGroup = (n: RuleTreeNode): n is { group: string } => 'group' in n

/** Every campaign id in the tree, base and groups, in evaluation order. */
export function campaignIdsOf(tree: RuleEvaluationTree): string[] {
  return tree.order.flatMap((n) => (isCampaign(n) ? [n.campaign] : (tree.groups.find((g) => g.id === n.group)?.campaigns ?? [])))
}

/** The place a campaign sits in, or null when the tree does not hold it. */
export function placeOf(tree: RuleEvaluationTree, id: string): OrderPlace | null {
  if (tree.order.some((n) => isCampaign(n) && n.campaign === id)) return 'base'
  return tree.groups.find((g) => g.campaigns.includes(id))?.id ?? null
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
export function moveCampaign(tree: RuleEvaluationTree, id: string, delta: -1 | 1): RuleEvaluationTree {
  const place = placeOf(tree, id)
  if (place === 'base') {
    const order = swapped(tree.order, tree.order.findIndex((n) => isCampaign(n) && n.campaign === id), delta)
    return order ? { ...tree, order } : tree
  }
  const group = tree.groups.find((g) => g.id === place)
  const campaigns = group && swapped(group.campaigns, group.campaigns.indexOf(id), delta)
  return campaigns ? { ...tree, groups: tree.groups.map((g) => (g === group ? { ...g, campaigns } : g)) } : tree
}

/** A group one place up or down in the base, its campaigns with it. */
export function moveGroup(tree: RuleEvaluationTree, groupId: string, delta: -1 | 1): RuleEvaluationTree {
  const order = swapped(tree.order, tree.order.findIndex((n) => isGroup(n) && n.group === groupId), delta)
  return order ? { ...tree, order } : tree
}

/**
 * A campaign moved to the END of another place — the base or a group. It is taken out of every
 * place first, so it is held once even when HQ listed it twice. Its own place, or a group the
 * tree does not have, leaves the tree as it was.
 */
export function moveCampaignTo(tree: RuleEvaluationTree, id: string, target: OrderPlace): RuleEvaluationTree {
  const held = campaignIdsOf(tree).filter((x) => x === id).length
  if (held === 1 && placeOf(tree, id) === target) return tree
  if (target !== 'base' && !tree.groups.some((g) => g.id === target)) return tree
  const order = tree.order.filter((n) => !(isCampaign(n) && n.campaign === id))
  const groups = tree.groups.map((g) => {
    const campaigns = g.campaigns.filter((x) => x !== id)
    return g.id === target ? { ...g, campaigns: [...campaigns, id] } : campaigns.length === g.campaigns.length ? g : { ...g, campaigns }
  })
  return { ...tree, order: target === 'base' ? [...order, { campaign: id }] : order, groups }
}

/** An id no group of the tree has. */
export function newGroupId(tree: RuleEvaluationTree): string {
  const taken = new Set(tree.groups.map((g) => g.id))
  let n = 1
  while (taken.has(`new-${n}`)) n++
  return `new-${n}`
}

/** A default English name no group has: `make(n)` for the first n from the group count up that is free. */
export function freshGroupName(tree: RuleEvaluationTree, make: (n: number) => string): string {
  const taken = new Set(tree.groups.map((g) => g.name.en.trim()))
  let n = tree.groups.length + 1
  while (taken.has(make(n).trim())) n++
  return make(n)
}

/**
 * HQ's tree as the page draws it: each campaign in ONE place (its first), each group placed once
 * in the base, and a group the base does not place added at its end — so every campaign and group
 * HQ answers has a row, and every row a place of its own. A tidy tree answers itself.
 */
export function tidyOrder(tree: RuleEvaluationTree): RuleEvaluationTree {
  const seen = new Set<string>()
  const once = (id: string) => !seen.has(id) && !!seen.add(id)
  const known = new Set(tree.groups.map((g) => g.id))
  const placed = new Set<string>()
  const nodes = tree.order.filter((n) => (isGroup(n) ? known.has(n.group) && !placed.has(n.group) && !!placed.add(n.group) : true))
  const order = [...nodes, ...tree.groups.filter((g) => !placed.has(g.id)).map((g) => ({ group: g.id }))]
  // Campaigns in evaluation order, so the first place wins.
  const members = new Map<string, string[]>()
  const kept = order.filter((n) => {
    if (!isGroup(n)) return once(n.campaign)
    members.set(n.group, tree.groups.find((g) => g.id === n.group)!.campaigns.filter(once))
    return true
  })
  const groups = tree.groups
    .filter((g, i) => tree.groups.findIndex((x) => x.id === g.id) === i)
    .map((g) => (members.get(g.id)!.length === g.campaigns.length ? g : { ...g, campaigns: members.get(g.id)! }))
  const tidy =
    kept.length === tree.order.length && order.length === tree.order.length && groups.every((g, i) => g === tree.groups[i]) && groups.length === tree.groups.length
  return tidy ? tree : { ...tree, order: kept, groups }
}

/** A new, empty group at the end of the base: "first that yields", session scope — the prototype's. */
export function addGroup(tree: RuleEvaluationTree, id: string, name: Says): RuleEvaluationTree {
  const group: RuleTreeGroup = { id, name, mode: 'first', scope: 'session', campaigns: [] }
  return { ...tree, order: [...tree.order, { group: id }], groups: [...tree.groups, group] }
}

/** What the reader sets on a group. */
export type GroupPatch = Partial<Pick<RuleTreeGroup, 'name' | 'mode' | 'scope'>>

/** A group's name, mode or scope changed. */
export function setGroup(tree: RuleEvaluationTree, groupId: string, patch: GroupPatch): RuleEvaluationTree {
  return { ...tree, groups: tree.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) }
}

/** An EMPTY group deleted, from the groups and from the base; a group with campaigns stays. */
export function removeGroup(tree: RuleEvaluationTree, groupId: string): RuleEvaluationTree {
  const group = tree.groups.find((g) => g.id === groupId)
  if (!group || group.campaigns.length > 0) return tree
  return { ...tree, order: tree.order.filter((n) => !(isGroup(n) && n.group === groupId)), groups: tree.groups.filter((g) => g !== group) }
}

/** The groups whose English name is blank — a save waits until each has one. */
export function blankGroups(tree: RuleEvaluationTree): string[] {
  return tree.groups.filter((g) => !g.name.en.trim()).map((g) => g.id)
}

/** Whether two trees place, name and set every group and campaign alike. */
export function sameOrder(a: RuleEvaluationTree, b: RuleEvaluationTree): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * The drafts the order may ride with (BackOffice 2759 has no order save: "an order-only change rides
 * a campaign draft"): every draft being edited, last saved first. A pending draft is frozen
 * (`RULES_DRAFT_PENDING`); a sent-back one waits on its author (the settled default: editing only).
 */
export const carrierDrafts = (drafts: readonly RuleDraftSummary[]): RuleDraftSummary[] => drafts.filter((d) => d.state === 'editing')

/**
 * The carrier draft's Drafts/Save: its whole state as loaded, at its revision, with the edited tree —
 * which publishes with that draft's version. The names of a group are trimmed on the way out.
 */
export function orderSave(draft: Pick<RuleDraft, 'campaign' | 'features' | 'revision'>, tree: RuleEvaluationTree): RuleDraftSave {
  return {
    campaign: draft.campaign,
    features: draft.features,
    revision: draft.revision,
    tree: { ...tree, groups: tree.groups.map((g) => ({ ...g, name: { en: g.name.en.trim(), ar: g.name.ar.trim() } })) },
  }
}
