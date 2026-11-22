/**
 * The Mirror drain page's view model (oms 931, BackOffice 4091) — pure, so what the page says is pinned by
 * `mirror-drain-helpers.test.ts`, not only by a drive.
 *
 * 🚩 Every judgement is the door's: the verdict, its reasons, which slots are bad and `troubleSince`. The page
 * only words them. Nothing here works out "since when" from the slots: the door extends the run behind the
 * six hours, and a browser re-derivation would disagree with the alert that reads the same rule.
 *
 * Each line comes back as an i18n key and its values, already formatted and isolated (`fsi`): the component
 * calls `t()` and nothing else.
 */
import type {
  MirrorDrain,
  MirrorDrainPie,
  MirrorDrainSlot,
  MirrorReason,
  MirrorSlotWhy,
  MirrorVerdict,
} from '@/core/models/sync-console'
import type { Severity } from '@/core/ui/severity'
import { fsi } from '@/core/util/bidi'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'
import { figure } from './helpers'

/** One line of copy: its key under `sync-console:drain` and its values. */
export interface DrainLine {
  key: string
  values: Record<string, string>
}

/** The verdict's badge and sentence colour. */
export const VERDICT_SEVERITY: Record<MirrorVerdict, Severity> = {
  down: 'bad',
  behind: 'bad',
  warning: 'warn',
  healthy: 'ok',
  noData: 'mute',
}

/** The page's ink for a severity: the sentence and the "not draining" figures. */
export const SEVERITY_INK: Record<Severity, string> = {
  ok: 'text-success-800',
  go: 'text-primary-800',
  warn: 'text-attention-800',
  bad: 'text-danger',
  mute: 'text-muted-foreground',
}

/**
 * A time as the page says it: the clock time alone when it is the same day as `asOf`, else the day too —
 * "08:00", or "2026-11-19 08:00" for yesterday's.
 */
export function when(value: string | null | undefined, asOf: string): string {
  if (!value) return ''
  return value.slice(0, 10) === asOf.slice(0, 10) ? formatTimeOfDay(value) : formatDateTime(value)
}

const at = (value: string | null | undefined, asOf: string) => fsi(when(value, asOf))

/**
 * The sentence on top, in the verdict's colour:
 * - `healthy`: "Draining, empty by 14:20" — or "Keeping up: nothing waiting" when nothing waits;
 * - `down`: worded by the reason that made it — "Not applying since" the last row applied, or "The apply worker is
 *   silent since" its last tick. Never `troubleSince`: that is when the queue began losing ground, and on
 *   2026-11-20 it read "Not applying since 18:00" while 470 rows a minute were being applied;
 * - `behind` / `warning`: "since" the door's `troubleSince`, else the pull's pause, else bare;
 * - `noData`: the sink has no inbox to read.
 */
export function verdictLine(d: MirrorDrain): DrainLine {
  switch (d.verdict) {
    case 'healthy':
      return d.pending > 0 && d.etaEmptyAt
        ? { key: 'verdict.healthyEmptyBy', values: { at: at(d.etaEmptyAt, d.asOf) } }
        : { key: 'verdict.healthy', values: {} }
    case 'noData':
      return { key: 'verdict.noData', values: {} }
    case 'down': {
      const top = d.reasons[0]
      const base = top?.code === 'applyWorkerStale' ? 'verdict.downWorker' : 'verdict.down'
      return top?.since && (top.code === 'applyWorkerStale' || top.code === 'applyStopped')
        ? { key: `${base}Since`, values: { since: at(top.since, d.asOf) } }
        : { key: base, values: {} }
    }
    default: {
      const since = d.troubleSince ?? (d.pullPaused ? d.pullPausedSince : null)
      return since
        ? { key: `verdict.${d.verdict}Since`, values: { since: at(since, d.asOf) } }
        : { key: `verdict.${d.verdict}`, values: {} }
    }
  }
}

/**
 * One of the door's reasons in the page's words; `trouble` by its run's kind. With `businessFirst` the door judges
 * `lagging` on the business rows, so it says "the oldest sale or shift row".
 */
export function reasonLine(r: MirrorReason, asOf: string, businessFirst = false): DrainLine {
  const values: Record<string, string> = {
    since: at(r.since, asOf),
    value: r.value == null ? '' : fsi(figure(r.value)),
    limit: r.limit == null ? '' : fsi(figure(r.limit)),
  }
  switch (r.code) {
    case 'applyStopped':
      return r.value == null
        ? { key: 'reasons.applyStoppedNever', values }
        : { key: `reasons.applyStopped${unit(r.value)}`, values: { ...values, ...duration(r.value) } }
    case 'lagging':
      return {
        key: `reasons.${businessFirst ? 'businessLagging' : 'lagging'}${unit(r.value ?? 0)}`,
        values: { ...values, ...duration(r.value ?? 0) },
      }
    case 'eventsLagging':
      return { key: `reasons.eventsLagging${unit(r.value ?? 0)}`, values: { ...values, ...duration(r.value ?? 0) } }
    case 'trouble':
      return { key: `reasons.trouble.${r.kind ?? 'other'}`, values }
    case 'applyWorkerStale':
      return { key: r.since ? 'reasons.applyWorkerStale' : 'reasons.applyWorkerNever', values }
    case 'pullPaused':
      return { key: r.since ? 'reasons.pullPausedSince' : 'reasons.pullPaused', values }
    default:
      return { key: `reasons.${r.code}`, values }
  }
}

/** Minutes as hours and minutes ("17 h 3 min"); the unit words are the locale's. */
export function duration(minutes: number): { hours: string; minutes: string } {
  return { hours: fsi(figure(Math.floor(minutes / 60))), minutes: fsi(figure(minutes % 60)) }
}

// Under an hour the line says minutes alone: its own key, "Minutes".
const unit = (minutes: number) => (minutes >= 60 ? '' : 'Minutes')

/**
 * The "oldest waiting" tile: with business rows first, the oldest sale's wait, the events' under it — so a day-old
 * event backlog does not read as sales a day late. Otherwise the whole inbox's, as before.
 */
export function lagTile(d: MirrorDrain): { label: string; value: DrainLine | null; note: DrainLine | null } {
  const say = (prefix: string, minutes: number | null): DrainLine | null =>
    minutes == null ? null : { key: `${prefix}${minutes >= 60 ? 'Hm' : 'M'}`, values: duration(minutes) }
  return d.businessFirst
    ? { label: 'tiles.businessLag', value: say('tiles.lag', d.businessLagMinutes), note: say('tiles.eventsLag', d.lagMinutes) }
    : { label: 'tiles.lag', value: say('tiles.lag', d.lagMinutes), note: null }
}

/** The pie's slices, in the ring's order, each with its status ink. */
export const PIE_PARTS = [
  { part: 'applied', ink: 'var(--success)' },
  { part: 'stillPending', ink: 'var(--attention)' },
  { part: 'parked', ink: 'var(--danger)' },
] as const satisfies readonly { part: keyof MirrorDrainPie; ink: string }[]

export interface PieView {
  slices: { part: (typeof PIE_PARTS)[number]['part']; value: number; ink: string }[]
  total: number
  /** The centre: the share applied, 0–100 rounded down (99.6 % is not "100 %" while rows wait); null with nothing pulled. */
  appliedPct: number | null
}

export function pieView(pie: MirrorDrainPie): PieView {
  return {
    slices: PIE_PARTS.map((p) => ({ part: p.part, value: pie[p.part], ink: p.ink })),
    total: pie.pulled,
    appliedPct: pie.pulled > 0 ? Math.floor((pie.applied * 100) / pie.pulled) : null,
  }
}

/**
 * Where the "since" marker stands: on the slot holding the door's `troubleSince`; on the first slot, marked
 * `before`, when the trouble is older than the window. `null` when there is no trouble or no slot.
 */
export function sinceMarker(slots: readonly MirrorDrainSlot[], troubleSince: string | null): { slot: string; before: boolean } | null {
  if (!troubleSince || slots.length === 0) return null
  let holder: MirrorDrainSlot | null = null
  for (const s of slots) if (s.slot <= troubleSince) holder = s
  return holder ? { slot: holder.slot, before: false } : { slot: slots[0].slot, before: true }
}

/** An ETA tile's value: a time, or "not draining" in the danger ink when the door gives none. */
export type EtaView = { kind: 'at'; at: string } | { kind: 'notDraining' } | { kind: 'notPaused' }

export function etaView(value: string | null, asOf: string, applies = true): EtaView {
  if (!applies) return { kind: 'notPaused' }
  return value ? { kind: 'at', at: when(value, asOf) } : { kind: 'notDraining' }
}

/** A bar's label: the clock time for ten-minute and 24 h slots, the day too for the week. */
export function slotLabel(slot: string, slotMinutes: number, window: string): string {
  if (window === '7d') return formatDateTime(slot).slice(5)
  return slotMinutes > 0 ? formatTimeOfDay(slot) : slot
}

/** The chart's rows: one per slot, the bad ones carrying why. */
export interface DrainChartRow {
  slot: string
  label: string
  pulled: number
  applied: number
  parked: number
  pending: number
  bad: boolean
  why: MirrorSlotWhy | null
  partial: boolean
}

export function chartRows(d: MirrorDrain): DrainChartRow[] {
  return d.slots.map((s) => ({
    slot: s.slot,
    label: slotLabel(s.slot, d.slotMinutes, d.window),
    pulled: s.pulled,
    applied: s.applied,
    parked: s.parked,
    pending: s.pendingAtEnd,
    bad: s.bad,
    why: s.why,
    partial: s.partial,
  }))
}

/** The keys every line above can produce, for the locale test: a key with no copy renders raw. */
export const DRAIN_KEYS = [
  'verdict.healthy',
  'verdict.healthyEmptyBy',
  'verdict.noData',
  ...(['down', 'downWorker', 'behind', 'warning'] as const).flatMap((v) => [`verdict.${v}`, `verdict.${v}Since`]),
  'reasons.applyStopped',
  'reasons.applyStoppedMinutes',
  'reasons.applyStoppedNever',
  'reasons.applyWorkerStale',
  'reasons.applyWorkerNever',
  'reasons.pullPaused',
  'reasons.pullPausedSince',
  'reasons.lagging',
  'reasons.laggingMinutes',
  'reasons.businessLagging',
  'reasons.businessLaggingMinutes',
  'reasons.eventsLagging',
  'reasons.eventsLaggingMinutes',
  'tiles.businessLag',
  'tiles.eventsLagHm',
  'tiles.eventsLagM',
  'reasons.recentParks',
  'reasons.nearThreshold',
  ...(['noApply', 'pullPaused', 'losingGround', 'slowApply', 'other'] as const).map((k) => `reasons.trouble.${k}`),
  ...(['noApply', 'pullPaused', 'losingGround', 'slowApply'] as const).map((k) => `why.${k}`),
] as const
