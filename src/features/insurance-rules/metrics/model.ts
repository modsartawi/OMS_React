// The insurance team's metrics, flags and rejection report (BackOffice spec 3126, door ticket 3141; oms ticket
// 615). Shapes follow the brief's "HQ contract: exceptions, review, metrics (3135, 3141)", which names the data
// but not every field: each ⚠️ GUESSED spelling below is recorded under 615's ## Comments for 618 to reconcile.
//
// Every date on the wire is LOCAL wall-clock (`yyyy-MM-dd`, `yyyy-MM-ddTHH:mm:ss`), never with a `Z`. No patient
// key reaches these views (the brief masks them on metrics). Pure: no React, no `t`.

import type { GuardFlagKind, Says } from '@/core/insurance-rules/model'

// ── Metrics (`GET InsuranceRules/Metrics?by&from&to`) ───────────────────────────────────────────

/** What a metrics row is keyed by. `day` is story 31's ("per … day"); the brief spells rule|store|pharmacist. */
export const METRICS_BY = ['rule', 'store', 'pharmacist', 'day'] as const
export type MetricsBy = (typeof METRICS_BY)[number]

/** Fires per severity, heaviest first. */
export interface FiresBySeverity {
  refuse: number
  override: number
  warn: number
}

/** What happened to a fired line — the "outcome mix". ⚠️ GUESSED spelling. */
export const METRICS_OUTCOMES = ['removed', 'changed', 'overridden', 'acknowledged', 'exception'] as const
export type MetricsOutcome = (typeof METRICS_OUTCOMES)[number]
export type OutcomeMix = Record<MetricsOutcome, number>

/** One rule, store, pharmacist or local day. ⚠️ `key`, `name`, `fires{}`, `outcomes{}`, `timeAddedMedianMs` GUESSED. */
export interface MetricsRow {
  /** The rule id, store code, pharmacist id, or the local day (`yyyy-MM-dd`). */
  key: string
  /** The rule's EN + AR name (by=rule); null otherwise. */
  name: Says | null
  fires: FiresBySeverity
  shadowFires: number
  outcomes: OutcomeMix
  /** Share (0–1) of the OVERRIDE fires the pharmacist overrode; null when nothing could be overridden. */
  overrideRate: number | null
  /** SAR on lines removed or changed after a guard — an ESTIMATE, labelled so on screen. */
  sarProtectedEstimate: number
  /** Payer rejections after a pass or an override. */
  rejectionsAfterPass: number
  /** Median time a guard added at the till (check → answer), ms; null when nothing was answered. */
  timeAddedMedianMs: number | null
}

export interface MetricsTotals {
  fires: number
  bySeverity: FiresBySeverity
  shadowFires: number
  /** The override rate over every row, weighed by each row's OVERRIDE fires. */
  overrideRate: number | null
  sarProtectedEstimate: number
  rejectionsAfterPass: number
}

export const totalFires = (f: FiresBySeverity): number => f.refuse + f.override + f.warn

const round2 = (n: number) => Math.round(n * 100) / 100

/** The tiles above the table. Medians do not add up, so time added has no total. */
export function metricsTotals(rows: readonly MetricsRow[]): MetricsTotals {
  const bySeverity = { refuse: 0, override: 0, warn: 0 }
  let shadowFires = 0
  let sar = 0
  let rejections = 0
  let weighed = 0
  let overrideFires = 0
  for (const r of rows) {
    bySeverity.refuse += r.fires.refuse
    bySeverity.override += r.fires.override
    bySeverity.warn += r.fires.warn
    shadowFires += r.shadowFires
    sar += r.sarProtectedEstimate
    rejections += r.rejectionsAfterPass
    if (r.overrideRate !== null && r.fires.override > 0) {
      weighed += r.overrideRate * r.fires.override
      overrideFires += r.fires.override
    }
  }
  return {
    fires: totalFires(bySeverity),
    bySeverity,
    shadowFires,
    overrideRate: overrideFires > 0 ? round2(weighed / overrideFires) : null,
    sarProtectedEstimate: round2(sar),
    rejectionsAfterPass: rejections,
  }
}

export interface OutcomeShare {
  outcome: MetricsOutcome
  count: number
  share: number
}

/** The outcome mix as shares of its sum, in a fixed order; empty when nothing happened. */
export function outcomeShares(mix: OutcomeMix): OutcomeShare[] {
  const sum = METRICS_OUTCOMES.reduce((s, o) => s + (mix[o] ?? 0), 0)
  if (sum === 0) return []
  return METRICS_OUTCOMES.map((outcome) => ({ outcome, count: mix[outcome] ?? 0, share: (mix[outcome] ?? 0) / sum }))
}

// ── Flags (`GET InsuranceRules/Flags`, `GET InsuranceRules/Settings/Flags`) ─────────────────────

/** A current flag with the numbers that raised it. ⚠️ every field but `kind` and `since` GUESSED. */
export interface FlagRow {
  ruleId: string
  name: Says
  kind: GuardFlagKind
  /** Local day the flag was raised. */
  since: string
  /** Fires in the flag window (30 days). */
  fires: number
  /** Of those, overridden. */
  overridden: number
  /** The previous 30 days' fires (the jump's yardstick); null when not measured. */
  previousAverage: number | null
  /** Local moment of the rule's last fire, or null when it never fired. */
  lastFired: string | null
}

/** The thresholds the flag job uses ("Thresholds are settings"). ⚠️ GUESSED spelling. */
export interface FlagSettings {
  noisyOverrideRate: number
  noisyMinFires: number
  windowDays: number
  silentDays: number
  jumpFactor: number
}

/** A flag's reason: a key in the `insurance-metrics` namespace and its values. */
export interface FlagReason {
  key: string
  values: Record<string, string | number>
}

export function flagReason(f: FlagRow): FlagReason {
  switch (f.kind) {
    case 'noisy':
      return { key: 'reason.noisy', values: { overridden: f.overridden, fires: f.fires, pct: f.fires > 0 ? Math.round((f.overridden / f.fires) * 100) : 0 } }
    case 'silent':
      return f.lastFired ? { key: 'reason.silent', values: { lastFired: f.lastFired.slice(0, 10) } } : { key: 'reason.silentNever', values: {} }
    case 'jump':
      return f.previousAverage
        ? { key: 'reason.jump', values: { fires: f.fires, previous: f.previousAverage, factor: Math.round(f.fires / f.previousAverage) } }
        : { key: 'reason.jumpFromNone', values: { fires: f.fires } }
  }
}

// ── Rejections (`GET InsuranceRules/Rejections?payer&from&to`) ─────────────────────────────────

/** The brief's `[{ code|words, payer, sameKind, count, sar, liveGuard }]`: a code, or the payer's words. */
export interface RejectionRow {
  /** The payer's rejection code (NPHIES / NCPDP), or null when it sent only words. */
  code: string | null
  /** The payer's words when it sent no code — free text, either script. */
  words: string | null
  payer: string
  /** The kind of medicine (E-code). */
  sameKind: string
  count: number
  sar: number
  /** A live guard exists on that kind. */
  liveGuard: boolean
}

export interface RankedRejection {
  rank: number
  row: RejectionRow
  /** SAR as a share of the top row's (draws the bar). */
  share: number
}

export interface RejectionTotals {
  count: number
  sar: number
  /** The SAR, and the rows, no live guard covers — where a new guard would earn most. */
  unguardedSar: number
  unguardedRows: number
}

const label = (r: RejectionRow) => r.code ?? r.words ?? ''

/** Ranked by SAR (then count, then code), heaviest first, with the totals. */
export function rankRejections(rows: readonly RejectionRow[]): RankedRejection[] & { totals: RejectionTotals } {
  const sorted = [...rows].sort((a, b) => b.sar - a.sar || b.count - a.count || label(a).localeCompare(label(b)))
  const top = sorted[0]?.sar ?? 0
  const ranked = sorted.map((row, i) => ({ rank: i + 1, row, share: top > 0 ? row.sar / top : 0 }))
  const totals: RejectionTotals = { count: 0, sar: 0, unguardedSar: 0, unguardedRows: 0 }
  for (const r of rows) {
    totals.count += r.count
    totals.sar += r.sar
    if (!r.liveGuard) {
      totals.unguardedSar += r.sar
      totals.unguardedRows += 1
    }
  }
  totals.sar = round2(totals.sar)
  totals.unguardedSar = round2(totals.unguardedSar)
  return Object.assign(ranked, { totals })
}

/** Days in calendar order; rules, stores and pharmacists with the most fires first, then by key. */
export function sortMetricsRows(rows: readonly MetricsRow[], by: MetricsBy): MetricsRow[] {
  const byKey = (a: MetricsRow, b: MetricsRow) => a.key.localeCompare(b.key)
  return [...rows].sort(by === 'day' ? byKey : (a, b) => totalFires(b.fires) - totalFires(a.fires) || byKey(a, b))
}
