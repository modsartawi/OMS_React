/**
 * The store page's pure logic (spec 444, ticket 446). No React, no network — pinned
 * by `store-helpers.test.ts`, beside the Fleet page's `helpers.ts`.
 *
 * 🚩 As on the Fleet page, nothing here decides a store's health. The strip's colour
 * is the door's `cell`, a pass's badge is the door's `status`, and a WPF store is the
 * door's `host`.
 */
import type { Severity } from '@/core/ui/severity'
import {
  HOUR_CELLS,
  type Agreement,
  type AgreementDay,
  type AgreementGapKind,
  type DeadLetterReason,
  type DeadLetterStage,
  type HourCell,
  type PassLineStatus,
  type PassOutcome,
  type StoreRow,
  type StoreScript,
} from '@/core/models/sync-console'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'
import { failureLabelKey } from './control-helpers'
import { codeBadge, type CodeBadge } from './helpers'

// ── The 24 h strip's legend ─────────────────────────────────────────────────────

/**
 * Each hour cell's swatch, on the app's own tokens (the palette gate refuses a
 * literal). The prototype's five colours map onto them: work moved is success, an
 * idle check is success faded, pass errors need a human (attention), connect
 * failures alone are danger, and no data is the neutral ground.
 */
const HOUR_SWATCH: Record<HourCell, string> = {
  work: 'bg-success',
  idle: 'bg-success/35',
  passErrors: 'bg-attention',
  connectFailOnly: 'bg-danger',
  noData: 'bg-muted',
}

const isHourCell = (c: string): c is HourCell => Object.hasOwn(HOUR_SWATCH, c)

export interface HourLegendEntry {
  /** The cell as drawn — an unknown one is drawn as `noData`. */
  cell: HourCell
  /** Its `sync-console` label key. */
  labelKey: string
  /** Its swatch, a token background class. */
  swatch: string
}

/**
 * An hour cell's legend entry. A cell this bundle does not know (a door newer than
 * it) reads as **no data**: the strip must never paint an hour as healthy or failed
 * on a value it cannot read.
 */
export function hourCellLegend(cell: string): HourLegendEntry {
  const known: HourCell = isHourCell(cell) ? cell : 'noData'
  return { cell: known, labelKey: `strip.cells.${known}`, swatch: HOUR_SWATCH[known] }
}

/** The legend under the strip — every cell, in the contract's order. */
export const HOUR_LEGEND: readonly HourLegendEntry[] = HOUR_CELLS.map(hourCellLegend)

// ── The Passes tab's `from` date ────────────────────────────────────────────────

/** The door keeps passes this long; an older `from` is a 400 `BAD_DATE`. */
export const PASSES_RETENTION_DAYS = 30

/** The door's own default `from` — 7 days ago — which the tab opens on. */
export const PASSES_DEFAULT_DAYS = 7

/** The tab pages at 50, as every console table does (spec 444). */
export const PASSES_PAGE_SIZE = 50

const daysBefore = (today: Date, days: number): string =>
  toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days))

/**
 * The `from` picker's bounds, from **today's local date** (no UTC round-trip): no
 * earlier than 30 days ago, no later than today, opening on 7 days ago.
 */
export function passesFromBound(today: Date): { min: string; max: string; initial: string } {
  return {
    min: daysBefore(today, PASSES_RETENTION_DAYS),
    max: toIsoDate(today),
    initial: daysBefore(today, PASSES_DEFAULT_DAYS),
  }
}

/**
 * What the picker holds after a change. A browser's `min`/`max` only marks a typed
 * date invalid — it still hands it over — so the bound is applied here: a date past
 * either end is pulled back to it, and a cleared or unreadable box goes back to the
 * opening date. The door is therefore never asked for a `from` it would refuse.
 */
export function clampPassesFrom(value: string, today: Date): string {
  const bound = passesFromBound(today)
  const day = fromIsoDate(value)
  if (!day) return bound.initial
  const iso = toIsoDate(day)
  if (iso < bound.min) return bound.min
  if (iso > bound.max) return bound.max
  return iso
}

// ── The tabs ────────────────────────────────────────────────────────────────────

export type StoreTab =
  | 'counters'
  | 'passes'
  | 'commands'
  | 'scripts'
  | 'audit'
  | 'location'
  | 'mirror'
  | 'agreement'
  | 'transactions'

/**
 * Every tab, in the prototype's order. The mirror rail's tab (spec 2563, ticket 457), then
 * rail agreement's (459), are appended at the end, as ruled for the wave; then the day's
 * NewPos receipts (spec 2586, ticket 467), after Agreement.
 */
export const STORE_TABS: readonly StoreTab[] = [
  'counters',
  'passes',
  'commands',
  'scripts',
  'audit',
  'location',
  'mirror',
  'agreement',
  'transactions',
]

/**
 * The tabs a WPF store keeps: WPF writes counters and passes, and nothing else of the
 * master and counter rails the console reads. Its mirror lane is its own, though: the
 * rails are independent (ADR 0073), so Mirror and Agreement are appended here too, and
 * Transactions (467, spec 2586 decision 5), which reads "No NewPos receipts" there.
 */
const WPF_TABS: readonly StoreTab[] = ['counters', 'passes', 'mirror', 'agreement', 'transactions']

const HOST_SEVERITY: Record<StoreRow['host'], Severity> = { Worker: 'go', Wpf: 'mute' }

/** A host's badge; a host this bundle does not know is neutral with its raw code. */
export function hostBadge(host: string): CodeBadge {
  return codeBadge(HOST_SEVERITY, 'hosts', host)
}

/** A store still synced by WPF — the door's `host`, never a guess from blank health fields. */
export const isWpfStore = (row: Pick<StoreRow, 'host'>): boolean => row.host === 'Wpf'

/** The tabs a store's page offers: all nine, or Counters, Passes, Mirror, Agreement and Transactions on a WPF store. */
export function storeTabs(row: Pick<StoreRow, 'host'>): readonly StoreTab[] {
  return isWpfStore(row) ? WPF_TABS : STORE_TABS
}

/**
 * A store the mirror rail sweeps — the lane's `onMirror`, `=== true` and nothing looser,
 * as on the fleet's lane chip. The mirror block, the strip's Mirror line, the Mirror tab
 * and the Agreement tab (459) all read it: the tabs are offered to every store, but read
 * `Store/Mirror` and `Store/Agreement` only for one on mirror.
 */
export const isOnMirror = (row: Pick<StoreRow, 'mirror'>): boolean => row.mirror?.onMirror === true


/** The open tab from `?tab=`: one the store offers, else its first. */
export function resolveStoreTab(param: string | null, tabs: readonly StoreTab[]): StoreTab {
  return tabs.find((t) => t === param) ?? tabs[0]
}

// ── Pass badges ─────────────────────────────────────────────────────────────────

const OUTCOME_SEVERITY: Record<PassOutcome, Severity> = {
  Ok: 'ok',
  Partial: 'warn',
  Failed: 'bad',
  Skipped: 'mute',
  None: 'mute',
}

/** A pass outcome's badge. An unknown outcome is neutral with no key, so its raw code shows. */
export function passOutcomeBadge(status: string): CodeBadge {
  return codeBadge(OUTCOME_SEVERITY, 'outcomes', status)
}

const LINE_SEVERITY: Record<PassLineStatus, Severity> = { Ok: 'ok', Error: 'bad' }

/** A pass detail line's badge; unknown → neutral, raw code. */
export function passLineBadge(status: string): CodeBadge {
  return codeBadge(LINE_SEVERITY, 'passDetail.lineStatus', status)
}

/**
 * A script's state badge: executed, failed (not executed and the store reported an
 * error), or simply not run yet. The words are the door's two fields read together;
 * no time is compared.
 */
export function scriptBadge(script: Pick<StoreScript, 'isExecuted' | 'errorMessage'>): CodeBadge {
  if (script.isExecuted) return { labelKey: 'scripts.executed', sev: 'ok' }
  if (script.errorMessage) return { labelKey: 'scripts.failed', sev: 'bad' }
  return { labelKey: 'scripts.notExecuted', sev: 'mute' }
}

// ── The Mirror tab (spec 2563, ticket 457) ──────────────────────────────────────

/**
 * A dead letter's stage and reason are words, not alarms: every row of the list is a
 * dead letter already. Both read through `codeBadge`, so a value this bundle does not
 * know shows its raw code.
 */
const STAGE_SEVERITY: Record<DeadLetterStage, Severity> = { pull: 'mute', apply: 'mute' }

const REASON_SEVERITY: Record<DeadLetterReason, Severity> = {
  errorCap: 'mute',
  orphaned: 'mute',
  unmapped: 'mute',
  poison: 'mute',
}

/** A dead letter's stage label; an unknown stage has no key, so its raw code shows. */
export function deadLetterStageLabel(stage: string): CodeBadge {
  return codeBadge(STAGE_SEVERITY, 'mirrorTab.stages', stage)
}

/** A dead letter's reason label; an unknown reason has no key, so its raw code shows. */
export function deadLetterReasonLabel(reason: string): CodeBadge {
  return codeBadge(REASON_SEVERITY, 'mirrorTab.reasons', reason)
}

/** The dead-letter list pages at 50, as every console table does. */
export const MIRROR_PAGE_SIZE = 50

/** The Mirror tab's filters — the door's `stage`, `reason` and `includeAcknowledged`. */
export interface MirrorFilter {
  /** `null` = both stages. */
  stage: DeadLetterStage | null
  /** `null` = every reason. */
  reason: DeadLetterReason | null
  includeAcknowledged: boolean
}

export const DEFAULT_MIRROR_FILTER: MirrorFilter = { stage: null, reason: null, includeAcknowledged: false }

/**
 * The `GET ActionSync/Store/Mirror` parameters. An empty stage or reason is dropped by
 * `@/core/api`'s query builder; `includeAcknowledged` is always sent, so the door is
 * never left to guess. The page never goes below 1.
 */
export function mirrorQuery(code: string, filter: MirrorFilter, page: number): Record<string, unknown> {
  return {
    code,
    stage: filter.stage,
    reason: filter.reason,
    includeAcknowledged: filter.includeAcknowledged,
    page: Math.max(1, Math.floor(page)),
    pageSize: MIRROR_PAGE_SIZE,
  }
}

// ── The Agreement tab (spec 2563, ticket 459) ───────────────────────────────────

/**
 * Each gap kind's word and token. A missing receipt is a whole sale absent from one
 * copy of HQ (from `RetailTrx`, and so from SAP, when it is missing at the counter);
 * a total mismatch is a sale both rails carried with different money — still a gap,
 * but the receipt is there.
 */
const GAP_KIND_SEVERITY: Record<AgreementGapKind, Severity> = {
  missingAtCounter: 'bad',
  missingAtMirror: 'bad',
  totalMismatch: 'warn',
}

/** A gap kind's label; an unknown kind has no key, so its raw code shows. */
export function gapKindLabel(kind: string): CodeBadge {
  return codeBadge(GAP_KIND_SEVERITY, 'agreementTab.gapKinds', kind)
}

/**
 * The recheck door's own refusals (2572) — each a whole-request refusal shown in the
 * reason dialog beside its code. `BAD_DATE` cannot be reached from the tab (only listed
 * days offer a recheck) but is still worded. `REASON_REQUIRED` and `NO_STORE` are the
 * console's shared failures, worded once (`failureLabelKey`); any other code shows raw.
 */
const RECHECK_REFUSALS = new Set(['BAD_DATE', 'BAD_REQUEST'])

/** A recheck refusal's `sync-console` label key, or `null` — the caller then shows the raw code. */
export function recheckRefusalLabel(code: string): string | null {
  return RECHECK_REFUSALS.has(code) ? `agreementTab.recheck.refusals.${code}` : failureLabelKey(code)
}

/** A judged day's verdict, as an `Agreement` value for `agreementBadge`: a judged day is never `notJudged`. */
export const dayVerdict = (day: Pick<AgreementDay, 'agrees'>): Agreement => (day.agrees === true ? 'agree' : 'disagree')

/** The gap list pages at 50, as every console table does. */
export const AGREEMENT_PAGE_SIZE = 50

/**
 * The `GET ActionSync/Store/Agreement` parameters. `day` (`yyyy-MM-dd`) narrows the gaps
 * to one judged day; `null` is every gap, and is dropped by `@/core/api`'s query builder.
 * The page never goes below 1.
 */
export function agreementQuery(code: string, day: string | null, page: number): Record<string, unknown> {
  return { code, day, page: Math.max(1, Math.floor(page)), pageSize: AGREEMENT_PAGE_SIZE }
}

/**
 * The judged days after a recheck of `day`: the row of the day the door answered for is
 * replaced by its answer, in place, or `day` is removed when the answer is `null` (no
 * NewPos receipt that day, so the door removed its verdict). Every other day keeps the
 * door's order — newest first — and is never re-sorted. A recheck only ever names a
 * listed day; should its answer come back for a day the list did not hold, it is placed
 * by date among the others, and no listed day is dropped for it.
 */
export function applyRecheck(days: readonly AgreementDay[], day: string, result: AgreementDay | null): AgreementDay[] {
  if (result === null) return days.filter((d) => d.businessDay !== day)
  const at = days.findIndex((d) => d.businessDay === result.businessDay)
  if (at >= 0) return days.map((d, i) => (i === at ? result : d))
  const before = days.findIndex((d) => d.businessDay < result.businessDay)
  return before < 0 ? [...days, result] : [...days.slice(0, before), result, ...days.slice(before)]
}
