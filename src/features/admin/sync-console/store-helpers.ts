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
  type DeadLetterReason,
  type DeadLetterStage,
  type HourCell,
  type PassLineStatus,
  type PassOutcome,
  type StoreRow,
  type StoreScript,
} from '@/core/models/sync-console'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'
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

export type StoreTab = 'counters' | 'passes' | 'commands' | 'scripts' | 'audit' | 'location' | 'mirror'

/**
 * Every tab, in the prototype's order. The mirror rail's tab (spec 2563, ticket 457) is
 * appended at the end, as ruled for the wave.
 */
export const STORE_TABS: readonly StoreTab[] = ['counters', 'passes', 'commands', 'scripts', 'audit', 'location', 'mirror']

/**
 * The tabs a WPF store keeps: WPF writes counters and passes, and nothing else of the
 * master and counter rails the console reads. Its mirror lane is its own, though: the
 * rails are independent (ADR 0073), so Mirror is appended here too.
 */
const WPF_TABS: readonly StoreTab[] = ['counters', 'passes', 'mirror']

const HOST_SEVERITY: Record<StoreRow['host'], Severity> = { Worker: 'go', Wpf: 'mute' }

/** A host's badge; a host this bundle does not know is neutral with its raw code. */
export function hostBadge(host: string): CodeBadge {
  return codeBadge(HOST_SEVERITY, 'hosts', host)
}

/** A store still synced by WPF — the door's `host`, never a guess from blank health fields. */
export const isWpfStore = (row: Pick<StoreRow, 'host'>): boolean => row.host === 'Wpf'

/** The tabs a store's page offers: all seven, or Counters, Passes and Mirror on a WPF store. */
export function storeTabs(row: Pick<StoreRow, 'host'>): readonly StoreTab[] {
  return isWpfStore(row) ? WPF_TABS : STORE_TABS
}

/**
 * A store the mirror rail sweeps — the lane's `onMirror`, `=== true` and nothing looser,
 * as on the fleet's lane chip. The mirror block, the strip's Mirror line and the Mirror
 * tab all read it: the tab is offered to every store, but reads `Store/Mirror` only
 * for one on mirror.
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
