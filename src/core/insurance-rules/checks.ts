import { conditionAt, type ConditionPath } from './guard-edit'
import type { GuardRule } from './model'

// HQ's checks of a guard draft (`POST InsuranceRules/Guards/Validate`, door 3139; oms 608 reads them, 611's
// approval reuses the verdict). Each issue names its rule, the block it points at and the field, in EN + AR.
// Pure: an issue is placed on the rule, on a block (a condition at any depth, or an effect) or counted as
// another rule's. Only errors block; a warning never does. A severity this client does not know reads as an
// error, so it blocks.
//
// ⚠️ PROVISIONAL `blockPath` grammar (608): the brief names the field, not its spelling. Read as the rule's
// JSON path — `when[0].conditions[2]` (a condition, any depth), `then[0]` (an effect) — and an empty or null
// path as the rule itself. 3139 owns it; 618 reconciles.

export interface GuardIssue {
  ruleId: string | null
  blockPath: string | null
  field: string | null
  severity: 'error' | 'warning'
  en: string
  ar: string
}

export type BlockSection = 'when' | 'then'

export interface BlockPlace {
  section: BlockSection
  /** `when`: indexes down through groups; `then`: `[effect index]`. */
  path: number[]
}

/** `when[0].conditions[2]` → `{ section: 'when', path: [0, 2] }`; null for anything else. */
export function parseBlockPath(blockPath: string | null | undefined): BlockPlace | null {
  if (!blockPath) return null
  const parts = blockPath.split('.')
  const head = /^(when|then)\[(\d+)\]$/.exec(parts[0])
  if (!head) return null
  const section = head[1] as BlockSection
  const path = [Number(head[2])]
  for (const part of parts.slice(1)) {
    const m = section === 'when' ? /^conditions\[(\d+)\]$/.exec(part) : null
    if (!m) return null
    path.push(Number(m[1]))
  }
  return { section, path }
}

/** A block's key on screen: `when:0.2`, `then:0`. */
export const blockKey = (section: BlockSection, path: ConditionPath): string => `${section}:${path.join('.')}`

export const isError = (i: GuardIssue): boolean => i.severity !== 'warning'

export interface ChecksIndex {
  /** The rule's own issues, and its issues whose block is not on screen. */
  rule: GuardIssue[]
  /** By `blockKey`. */
  blocks: ReadonlyMap<string, GuardIssue[]>
  /** Issues of the draft's other rules (or of no rule). */
  elsewhere: GuardIssue[]
}

/** The issues placed for one rule on screen; errors first, HQ's order kept within each. */
export function indexChecks(issues: readonly GuardIssue[], rule: Pick<GuardRule, 'id' | 'when' | 'then'>): ChecksIndex {
  const sorted = [...issues.filter(isError), ...issues.filter((i) => !isError(i))]
  const out = { rule: [] as GuardIssue[], blocks: new Map<string, GuardIssue[]>(), elsewhere: [] as GuardIssue[] }
  for (const i of sorted) {
    if (i.ruleId !== rule.id) {
      out.elsewhere.push(i)
      continue
    }
    const place = parseBlockPath(i.blockPath)
    const exists = place && (place.section === 'when' ? conditionAt(rule.when, place.path) !== undefined : rule.then[place.path[0]] !== undefined)
    if (!place || !exists) {
      out.rule.push(i)
      continue
    }
    const key = blockKey(place.section, place.path)
    out.blocks.set(key, [...(out.blocks.get(key) ?? []), i])
  }
  return out
}

/** The issues on one field of a block (`says.ar` matches `says.ar`, and `says` matches both languages). */
export const fieldIssues = (issues: readonly GuardIssue[] | undefined, field: string): GuardIssue[] =>
  (issues ?? []).filter((i) => i.field === field || (i.field ?? '').startsWith(`${field}.`))

/** The verdict 611's "Ask for approval" reads: errors block, warnings never do. */
export function checksVerdict(issues: readonly GuardIssue[] | null | undefined): { errors: number; warnings: number; blocked: boolean } {
  const errors = (issues ?? []).filter(isError).length
  const warnings = (issues ?? []).length - errors
  return { errors, warnings, blocked: errors > 0 }
}
