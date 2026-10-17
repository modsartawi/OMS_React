import type { CampaignRule, RuleCondition } from '@/core/models/rule-campaign'

// The builder's own keys for the blocks of a rule (ticket 522). Schema 1 gives a condition, an
// effect and a named value no id (rules and filters have theirs), yet the builder must keep one
// panel open on one block, find a block HQ pointed at after it moved, and key React's lists. Each
// gets a key under a Symbol: `JSON.stringify` drops symbol keys, so the wire never carries them and
// the history's JSON comparisons ignore them, while object spread (every edit's copy) keeps them.

export const BLOCK_KEY: unique symbol = Symbol('blockKey')

type Keyed = { [BLOCK_KEY]?: string }

/** A block's or a value's key; `''` for one never keyed. */
export const keyOf = (x: object): string => (x as Keyed)[BLOCK_KEY] ?? ''

function keyed<T extends object>(x: T, mint: () => string, like?: object): T {
  if ((x as Keyed)[BLOCK_KEY]) return x
  const k = (like && keyOf(like)) || mint()
  return { ...x, [BLOCK_KEY]: k } as T
}

function keyConditions(list: RuleCondition[], mint: () => string, like: RuleCondition[] = []): RuleCondition[] {
  return list.map((c, i) => {
    const k = keyed(c, mint, like[i])
    const inner = Array.isArray(like[i]?.conditions) ? (like[i].conditions as RuleCondition[]) : []
    return Array.isArray(k.conditions) ? { ...k, conditions: keyConditions(k.conditions as RuleCondition[], mint, inner) } : k
  })
}

/**
 * The rules with every condition (at any depth), effect and named value keyed. `like` is what the
 * screen holds (the rules sent, or the saved ones): a block in the same place of the same rule keeps
 * its key, so a save or a re-read does not lose the open panel or the issues' way to their blocks.
 */
export function withKeys(rules: CampaignRule[], mint: () => string, like: CampaignRule[] = []): CampaignRule[] {
  return rules.map((r) => {
    const was = like.find((x) => x.id === r.id)
    return {
      ...r,
      filters: r.filters ?? [],
      values: (r.values ?? []).map((v, i) => keyed(v, mint, was?.values?.[i])),
      when: keyConditions(r.when ?? [], mint, was?.when),
      then: (r.then ?? []).map((e, i) => keyed(e, mint, was?.then?.[i])),
    }
  })
}

let seq = 0
/** The builder's key mint: unique within the page's life. */
export const mintKey = (): string => `k${++seq}`
