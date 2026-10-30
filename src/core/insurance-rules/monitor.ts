// The monitor rule kind (BackOffice spec 3271, stories 38, 41, 42; A1, A2, A7, A9; oms 699). A monitor is a rule on the guard
// builder, kept in the guard draft, that reads a payer's kept answer. Its only effect is a review item: it never touches a
// sale. Pure: no React, no http. What the builder offers per kind is decided here, and the wire is cleaned here too, so a
// monitor cannot leave with a till effect whatever the screen or an earlier save put on it.
//
// ⚠️ PROVISIONAL (711 reconciles): door 3290 and SIS.Rules 2.1.0 (3273) have not landed, so every spelling is a guess, listed on ticket 699.
import { saysIn } from '@/core/rules/sentence'
import type { FxEntry, FxRecipeRow } from '@/core/rules/fx-helper/FxHelper'
import type { RuleFormulaType } from '@/core/rules/formula-guide'
import { factKey, type FhirCatalogRow, type FhirFactType } from './fhir-catalog'
import { PALETTE, newCondition, type PaletteBlock } from './guard-edit'
import { GUARD_SEVERITIES, MONITOR_SEVERITIES, MONITOR_USES, type GuardCondition, type GuardEffect, type GuardRule, type MonitorSeverity, type MonitorUse, type RuleKind, type RuleSeverity } from './model'

export const isMonitor = (r: Pick<GuardRule, 'kind'>): boolean => r.kind === 'monitor'

/** The severities an effect of this kind offers. */
export const effectSeveritiesFor = (kind: RuleKind): readonly RuleSeverity[] => (kind === 'monitor' ? MONITOR_SEVERITIES : GUARD_SEVERITIES)

/** A blank monitor: both answers, one review item with no text yet. No audience, window or unknown rule of a sale. */
export function newMonitorRule(id: string, folder = ''): GuardRule {
  return {
    id,
    kind: 'monitor',
    scope: 'claimResponse',
    uses: [...MONITOR_USES],
    name: { en: '', ar: '' },
    folder,
    state: 'draft',
    filters: [],
    when: [],
    onUnknown: 'none',
    then: [{ effect: 'reviewItem', severity: 'action', says: { en: '', ar: '' } }],
  }
}

/** `M-` and one more than the highest monitor number, three digits. */
export function nextMonitorId(rules: readonly Pick<GuardRule, 'id'>[]): string {
  let high = 0
  for (const r of rules) {
    const m = /^M-(\d+)$/.exec(r.id)
    if (m) high = Math.max(high, Number(m[1]))
  }
  return `M-${String(high + 1).padStart(3, '0')}`
}

const MONITOR_BLOCKS: readonly PaletteBlock[] = ['history', 'fact', 'formula', 'group']

/** The palette a rule of this kind offers: a monitor reads the answer and the patient's history, never the till's line. */
export function paletteFor(kind: RuleKind): typeof PALETTE {
  if (kind === 'guard') return PALETTE
  return PALETTE.map((g) => ({ ...g, checks: g.checks.filter((c) => MONITOR_BLOCKS.includes(c)) })).filter((g) => g.checks.length > 0)
}

/** A new block on a monitor; a fact starts on the answer, not on the till's default. */
export function newMonitorCondition(check: PaletteBlock): GuardCondition {
  return check === 'fact' ? { check, path: '$claimResponse.outcome', op: 'anyOf', value: [] } : newCondition(check)
}

/** A use turned on or off, in the fixed order; the last one stays, since a monitor with none would never run. */
export function toggleUse(rule: GuardRule, use: MonitorUse): GuardRule {
  const on = rule.uses ?? []
  const next = on.includes(use) ? on.filter((u) => u !== use) : MONITOR_USES.filter((u) => u === use || on.includes(u))
  return next.length === 0 ? rule : { ...rule, uses: next }
}

// ── What a rule may read ─────────────────────────────────────────────────────────────────────────

const isReissue = (r: Pick<FhirCatalogRow, 'moment' | 'key'>): boolean => r.moment === 'claimResponse' && r.key.startsWith('reissue.')

/**
 * The catalog a rule of this kind picks from. A guard keeps it, less what exists only on a kept answer. A monitor gets its
 * scope's fields, then each again as `$previous` (a reissue's reason has no previous; a coded key is the door's to spell).
 */
export function catalogFor(rows: readonly FhirCatalogRow[], kind: RuleKind): FhirCatalogRow[] {
  if (kind === 'guard') return rows.filter((r) => !isReissue(r) && !r.previous)
  const scope = rows.filter((r) => r.moment === 'claimResponse' && !r.previous)
  return [...scope, ...scope.filter((r) => !isReissue(r) && !r.parameter).map((r) => ({ ...r, previous: true }))]
}

const FX_TYPE: Partial<Record<FhirFactType, RuleFormulaType>> = { text: 'text', code: 'text', number: 'number', quantity: 'number', money: 'money', flag: 'bool' }

/** The ƒx helper's Fields on a monitor: a formula takes one value, so no list, no date and no coded key. */
export function monitorFxFields(rows: readonly FhirCatalogRow[], lang: string): FxEntry[] {
  return catalogFor(rows, 'monitor')
    .filter((r) => !r.retired && !r.parameter && r.cardinality === 'single' && FX_TYPE[r.type])
    .map((r) => {
      const path = factKey(r).slice(1)
      return { key: path, group: r.previous ? 'previous' : 'claimResponse', type: FX_TYPE[r.type]!, insert: { text: path }, code: path, label: saysIn(r.label, lang) }
    })
}

export const MONITOR_FX_RECIPES: readonly FxRecipeRow[] = [
  { key: 'cutQuantity', formula: 'line.claimResponse.approvedQuantity < previous.line.claimResponse.approvedQuantity', blocked: null },
  { key: 'reissueReason', formula: "claimResponse.reissue.reason == 'correction'", blocked: null },
]

// ── On the wire ──────────────────────────────────────────────────────────────────────────────────

const monitorEffect = (e: GuardEffect): GuardEffect => ({
  effect: 'reviewItem',
  severity: (MONITOR_SEVERITIES as readonly RuleSeverity[]).includes(e.severity) ? (e.severity as MonitorSeverity) : 'info',
  says: e.says,
})

/** A monitor as read: only a review item, and no till field left to draw. An effect it should not have reads as `info`. */
export function monitorRuleIn(rule: GuardRule): GuardRule {
  const { audience: _a, window: _w, ...rest } = rule
  void _a
  void _w
  return { ...rest, scope: rule.scope ?? 'claimResponse', uses: rule.uses?.length ? rule.uses : [...MONITOR_USES], onUnknown: 'none', then: rule.then.map(monitorEffect) }
}

/** A monitor as sent: the same cleaning, and no `onUnknown`, which on a guard can warn a pharmacist. */
export function monitorRuleOut(out: Record<string, unknown>): Record<string, unknown> {
  const { audience: _a, window: _w, onUnknown: _u, ...rest } = out
  void _a
  void _w
  void _u
  return { ...rest, then: (rest.then as GuardEffect[]).map(monitorEffect) }
}
