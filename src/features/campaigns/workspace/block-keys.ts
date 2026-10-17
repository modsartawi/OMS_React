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

function keyed<T extends object>(x: T, mint: () => string): T {
  return (x as Keyed)[BLOCK_KEY] ? x : ({ ...x, [BLOCK_KEY]: mint() } as T)
}

function keyConditions(list: RuleCondition[], mint: () => string): RuleCondition[] {
  return list.map((c) => {
    const k = keyed(c, mint)
    return Array.isArray(k.conditions) ? { ...k, conditions: keyConditions(k.conditions as RuleCondition[], mint) } : k
  })
}

/** The rules with every condition (at any depth), effect and named value keyed. */
export function withKeys(rules: CampaignRule[], mint: () => string): CampaignRule[] {
  return rules.map((r) => ({
    ...r,
    filters: r.filters ?? [],
    values: (r.values ?? []).map((v) => keyed(v, mint)),
    when: keyConditions(r.when ?? [], mint),
    then: (r.then ?? []).map((e) => keyed(e, mint)),
  }))
}

let seq = 0
/** The builder's key mint: unique within the page's life. */
export const mintKey = (): string => `k${++seq}`
