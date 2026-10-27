import type { KeySentence } from '@/core/rules/sentence'
import { severityRank, type GuardCondition, type GuardRule, type GuardRuleset, type Says } from '@/core/insurance-rules/model'
import { conditionSentence, type GuardSentenceContext } from '@/core/insurance-rules/sentence'
import type { SimFired, SimLineResult, SimTrace, TraceValue } from './simulate'

// A simulated line's condition trace laid onto each rule's own IF tree (ticket 612). HQ answers the trace flat —
// `{ ruleId, blockPath, value, why }` — and the rule lives in the guard DRAFT; the tree reads each condition as
// the rule page does (607's sentences) with HQ's value beside it. A condition HQ did not read (a group that
// short-circuits) shows no value; an entry whose block is not in the draft (a rule edited since, or not in it)
// is kept aside, never dropped. Pure.

export interface TraceNode {
  /** The block's path, as HQ spells it (`when[0].conditions[2]`). */
  path: string
  check: string
  not: boolean
  sentence: KeySentence
  clauses: KeySentence[]
  value: TraceValue | null
  why: Says | string | null
  children?: TraceNode[]
}

export interface TracedRule {
  ruleId: string
  /** The rule in the draft, or null when the draft has no such rule. */
  rule: GuardRule | null
  /** The rule's fire on this line, or null when it was only read. */
  fired: SimFired | null
  nodes: TraceNode[]
  /** Trace entries whose block is not in the rule. */
  loose: SimTrace[]
}

function treeOf(conditions: readonly GuardCondition[], prefix: string, ctx: GuardSentenceContext, byPath: Map<string, SimTrace>, used: Set<string>): TraceNode[] {
  return conditions.map((c, i) => {
    const path = prefix ? `${prefix}.conditions[${i}]` : `when[${i}]`
    const s = conditionSentence(c, ctx)
    const hit = byPath.get(path)
    if (hit) used.add(path)
    const node: TraceNode = { path, check: s.check, not: s.not, sentence: s.sentence, clauses: s.clauses, value: hit ? hit.value : null, why: hit?.why ?? null }
    if (c.check === 'group') node.children = treeOf(c.conditions, path, ctx, byPath, used)
    return node
  })
}

/** Every rule a line names — fired ones heaviest first, then the ones only read, in trace order — with its tree. */
export function lineRules(line: SimLineResult, draft: Pick<GuardRuleset, 'rules' | 'lists'> | null | undefined): TracedRule[] {
  const fired = [...line.fired].map((f, i) => ({ f, i })).sort((a, b) => severityRank(a.f.severity) - severityRank(b.f.severity) || a.i - b.i)
  const ids: string[] = fired.map(({ f }) => f.ruleId)
  for (const t of line.trace) if (!ids.includes(t.ruleId)) ids.push(t.ruleId)
  return ids.map((ruleId) => {
    const entries = line.trace.filter((t) => t.ruleId === ruleId)
    const rule = draft?.rules.find((r) => r.id === ruleId) ?? null
    const f = line.fired.find((x) => x.ruleId === ruleId) ?? null
    if (!rule) return { ruleId, rule, fired: f, nodes: [], loose: entries }
    const byPath = new Map(entries.map((t) => [t.blockPath, t]))
    const used = new Set<string>()
    const nodes = treeOf(rule.when, '', { rule, lists: draft?.lists ?? [] }, byPath, used)
    return { ruleId, rule, fired: f, nodes, loose: entries.filter((t) => !used.has(t.blockPath)) }
  })
}
