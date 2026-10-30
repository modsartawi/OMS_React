// The monitor rule kind (BackOffice spec 3271, stories 38, 41, 42; A1, A2, A7, A9; oms 699). A monitor is a rule on the guard
// builder, kept in the guard draft, that reads a payer's kept answer. Its only effect is a review item: it never touches a
// sale. Pure: no React, no http. What the builder offers per kind is decided here, and the wire is cleaned here too, so a
// monitor cannot leave with a till effect whatever the screen or an earlier save put on it.
//
// ⚠️ PROVISIONAL (711 reconciles): door 3290 and SIS.Rules 2.1.0 (3273) have not landed, so every spelling is a guess, listed on ticket 699.
// Oms 701 adds the communication and payment scopes (doors 3299, 3300), its guesses listed on ticket 701.
import { saysIn } from '@/core/rules/sentence'
import type { FxEntry, FxRecipeRow } from '@/core/rules/fx-helper/FxHelper'
import type { RuleFormulaType } from '@/core/rules/formula-guide'
import { factKey, type FhirCatalogRow, type FhirFactType } from './fhir-catalog'
import { PALETTE, newCondition, type PaletteBlock } from './guard-edit'
import { GUARD_SEVERITIES, MONITOR_SEVERITIES, MONITOR_USES, type FactCondition, type GuardCondition, type GuardEffect, type GuardRule, type MonitorScope, type MonitorSeverity, type MonitorUse, type RuleKind, type RuleSeverity } from './model'

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

/**
 * The palette a rule of this kind offers: a monitor reads the answer and the patient's history, never the till's line.
 * History's fields are about one line of one patient, which only a claim response has (oms 701).
 */
export function paletteFor(kind: RuleKind, scope: MonitorScope = 'claimResponse'): typeof PALETTE {
  if (kind === 'guard') return PALETTE
  const blocks = scope === 'claimResponse' ? MONITOR_BLOCKS : MONITOR_BLOCKS.filter((c) => c !== 'history')
  return PALETTE.map((g) => ({ ...g, checks: g.checks.filter((c) => blocks.includes(c)) })).filter((g) => g.checks.length > 0)
}

/** A new fact starts on its scope, not on the till's default, with a test the field can answer. */
const FIRST_FACT: Record<MonitorScope, Pick<FactCondition, 'path' | 'op' | 'value'>> = {
  claimResponse: { path: '$claimResponse.outcome', op: 'anyOf', value: [] },
  communicationRequest: { path: '$communicationRequest.reason', op: 'anyOf', value: [] },
  paymentReconciliation: { path: '$paymentReconciliation.detail.payment', op: 'below', value: { amount: '0', currency: 'SAR' } },
}

/** A new block on a monitor. */
export function newMonitorCondition(check: PaletteBlock, scope: MonitorScope = 'claimResponse'): GuardCondition {
  return check === 'fact' ? { check, ...FIRST_FACT[scope] } : newCondition(check)
}

const SCOPE_WORD = /\b(claimResponse|communicationRequest|paymentReconciliation|previous)\b/g

/** Whether a block can run on this scope: the messages it names are this one, and only a claim response has an answer before or a history. */
function readableOn(c: GuardCondition, scope: MonitorScope): boolean {
  if (c.check === 'history') return scope === 'claimResponse'
  const text = c.check === 'fact' ? c.path : c.check === 'formula' ? c.formula : ''
  return [...text.matchAll(SCOPE_WORD)].every((m) => m[1] === scope || (m[1] === 'previous' && scope === 'claimResponse'))
}

function keepReadable(when: readonly GuardCondition[], scope: MonitorScope): GuardCondition[] {
  return when.flatMap((c): GuardCondition[] => {
    if (c.check !== 'group') return readableOn(c, scope) ? [c] : []
    const conditions = keepReadable(c.conditions, scope)
    return c.conditions.length > 0 && conditions.length === 0 ? [] : [{ ...c, conditions }]
  })
}

/** The monitor on another message: what the new one cannot read goes, and only a claim response has a `use`. */
export function setMonitorScope(rule: GuardRule, scope: MonitorScope): GuardRule {
  if ((rule.scope ?? 'claimResponse') === scope) return rule
  const { uses: _u, ...rest } = rule
  void _u
  return { ...rest, scope, when: keepReadable(rule.when, scope), ...(scope === 'claimResponse' ? { uses: [...MONITOR_USES] } : {}) }
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
 * The catalog a rule of this kind picks from. A guard keeps it, less what exists only on a kept answer or a monitor's own
 * message. A monitor gets its scope's fields; on a claim response each again as `$previous` (a reissue's reason has no
 * previous; a coded key is the door's to spell). Oms 701: no door has a `$previous` on the other two scopes.
 */
export function catalogFor(rows: readonly FhirCatalogRow[], kind: RuleKind, scope: MonitorScope = 'claimResponse'): FhirCatalogRow[] {
  if (kind === 'guard') return rows.filter((r) => !isReissue(r) && !r.previous && r.moment !== 'communicationRequest' && r.moment !== 'paymentReconciliation')
  const own = rows.filter((r) => r.moment === scope && !r.previous)
  if (scope !== 'claimResponse') return own
  return [...own, ...own.filter((r) => !isReissue(r) && !r.parameter).map((r) => ({ ...r, previous: true }))]
}

const FX_TYPE: Partial<Record<FhirFactType, RuleFormulaType>> = { text: 'text', code: 'text', number: 'number', quantity: 'number', money: 'money', flag: 'bool' }

/** The ƒx helper's Fields on a monitor: a formula takes one value, so no list, no date and no coded key. */
export function monitorFxFields(rows: readonly FhirCatalogRow[], lang: string, scope: MonitorScope = 'claimResponse'): FxEntry[] {
  return catalogFor(rows, 'monitor', scope)
    .filter((r) => !r.retired && !r.parameter && r.cardinality === 'single' && FX_TYPE[r.type])
    .map((r) => {
      const path = factKey(r).slice(1)
      return { key: path, group: r.previous ? 'previous' : scope, type: FX_TYPE[r.type]!, insert: { text: path }, code: path, label: saysIn(r.label, lang) }
    })
}

export const MONITOR_FX_RECIPES: Record<MonitorScope, readonly FxRecipeRow[]> = {
  claimResponse: [
    { key: 'cutQuantity', formula: 'line.claimResponse.approvedQuantity < previous.line.claimResponse.approvedQuantity', blocked: null },
    { key: 'reissueReason', formula: "claimResponse.reissue.reason == 'correction'", blocked: null },
  ],
  communicationRequest: [{ key: 'hasPayloadText', formula: 'communicationRequest.payloadTextPresent == true', blocked: null }],
  paymentReconciliation: [{ key: 'underpaid', formula: 'paymentReconciliation.detail.payment < paymentReconciliation.detail.amount', blocked: null }],
}

// ── On the wire ──────────────────────────────────────────────────────────────────────────────────

const monitorEffect = (e: GuardEffect): GuardEffect => ({
  effect: 'reviewItem',
  severity: (MONITOR_SEVERITIES as readonly RuleSeverity[]).includes(e.severity) ? (e.severity as MonitorSeverity) : 'info',
  says: e.says,
})

/** A monitor as read: only a review item, and no till field left to draw. An effect it should not have reads as `info`. */
export function monitorRuleIn(rule: GuardRule): GuardRule {
  const { audience: _a, window: _w, uses, ...rest } = rule
  void _a
  void _w
  const scope = rule.scope ?? 'claimResponse'
  return { ...rest, scope, ...(scope === 'claimResponse' ? { uses: uses?.length ? uses : [...MONITOR_USES] } : {}), onUnknown: 'none', then: rule.then.map(monitorEffect) }
}

/** A monitor as sent: the same cleaning, and no `onUnknown`, which on a guard can warn a pharmacist. */
export function monitorRuleOut(out: Record<string, unknown>): Record<string, unknown> {
  const { audience: _a, window: _w, onUnknown: _u, ...rest } = out
  void _a
  void _w
  void _u
  if (rest.scope && rest.scope !== 'claimResponse') delete rest.uses
  return { ...rest, then: (rest.then as GuardEffect[]).map(monitorEffect) }
}
