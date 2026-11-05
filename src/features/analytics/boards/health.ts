import type {
  AnalyticsCubeState,
  AnalyticsFirstLoadPhase,
  AnalyticsFirstLoadState,
  AnalyticsHealth,
  AnalyticsHealthStatus,
  AnalyticsMartsState,
} from '@/core/models/analytics'
import type { Severity } from '@/core/ui/severity'

/**
 * The analytics status card's reading of `GET Analytics/Health` (BackOffice 3386, oms-react 785). Pure:
 * `health.test.ts` proves the reading, the tone and the last-run split.
 */

/** How often the card asks again while it is on screen. The container caches `/health` for 15 s. */
export const HEALTH_REFRESH_MS = 60_000

type Loose = Record<string, unknown> | null | undefined

const STATUSES: readonly AnalyticsHealthStatus[] = ['ok', 'fail', 'unreachable', 'not_configured']
const CUBE: readonly AnalyticsCubeState[] = ['ready', 'not_ready']
const MARTS: readonly AnalyticsMartsState[] = ['fresh', 'stale', 'never_built', 'unreachable']
const FIRST_LOAD: readonly AnalyticsFirstLoadState[] = ['done', 'running', 'failed', 'not_started', 'unreachable']
const PHASES: readonly AnalyticsFirstLoadPhase[] = ['rebuild', 'backfill']

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null)

/** The door's answer, defensively: an unknown overall status reads as unreachable, never as ok. */
export function readHealth(raw: Loose): AnalyticsHealth {
  const marts = (raw?.marts ?? null) as Loose
  const first = (raw?.firstLoad ?? null) as Loose
  return {
    status: oneOf(raw?.status, STATUSES, 'unreachable'),
    version: text(raw?.version),
    cube: oneOf(raw?.cube, CUBE, ''),
    marts: {
      status: oneOf(marts?.status, MARTS, ''),
      lastGoodRunAtRiyadh: text(marts?.lastGoodRunAtRiyadh),
      minutesSince: whole(marts?.minutesSince),
      maxMinutes: whole(marts?.maxMinutes),
      lastRun: text(marts?.lastRun),
    },
    firstLoad: {
      status: oneOf(first?.status, FIRST_LOAD, ''),
      phase: oneOf(first?.phase, PHASES, ''),
      monthsDone: whole(first?.monthsDone),
      monthsTotal: whole(first?.monthsTotal),
      currentMonth: text(first?.currentMonth),
      startedAtRiyadh: text(first?.startedAtRiyadh),
      finishedAtRiyadh: text(first?.finishedAtRiyadh),
    },
    checkedAt: text(raw?.checkedAt),
  }
}

/**
 * The card's one tone. `ok` only when the container says so. Behind (stale marts while Cube is ready)
 * is a warning: the screens still answer, from older data. Cube down, the marts never built or
 * unreadable, or no answer at all is bad. No address configured is neutral: nothing to watch yet.
 */
export function healthTone(h: AnalyticsHealth): Severity {
  if (h.status === 'ok') return 'ok'
  if (h.status === 'not_configured') return 'mute'
  if (h.status === 'unreachable') return 'bad'
  if (h.cube === 'ready' && h.marts.status === 'stale') return 'warn'
  return 'bad'
}

/** The tone's headline key, `boards:status.headline.<key>`. */
export function headlineKey(h: AnalyticsHealth): 'ok' | 'behind' | 'cubeDown' | 'martsDown' | 'unreachable' | 'notConfigured' {
  if (h.status === 'ok') return 'ok'
  if (h.status === 'not_configured') return 'notConfigured'
  if (h.status === 'unreachable') return 'unreachable'
  if (h.cube !== 'ready') return 'cubeDown'
  if (h.marts.status === 'stale') return 'behind'
  return 'martsDown'
}

/**
 * The first load's tone: done is ok, running is in motion (the old marts keep serving), failed is bad
 * (retried at the next container start), not started or unreadable is neutral.
 */
export function firstLoadTone(status: AnalyticsFirstLoadState): Severity {
  if (status === 'done') return 'ok'
  if (status === 'running') return 'go'
  if (status === 'failed') return 'bad'
  return 'mute'
}

/** `2026-07-01` → "July 2026" in the active locale; '' for anything else. */
export function monthLabel(value: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(value)
  if (!m) return ''
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(Number(m[1]), Number(m[2]) - 1, 1))
}

/** The jobs and run outcomes `mart_load_log` writes (3379's `load_log.sql`); anything else is shown as sent. */
export const KNOWN_JOBS = ['intraday', 'nightly', 'catchup', 'rebuild', 'backfill'] as const
export const KNOWN_RUN_STATUSES = ['success', 'error', 'skipped', 'test_fail', 'stale_source'] as const

export interface LastRun {
  /** Empty for a run by hand. */
  job: string
  status: string
  /** `yyyy-MM-dd HH:mm:ss`, Riyadh time as stored. */
  at: string
}

/** `"intraday success at 2026-11-05 14:30:12"` (or `"success at …"` for a run by hand) → its parts. */
export function parseLastRun(value: string): LastRun | null {
  const m = /^(?:(\S+) )?(\S+) at (\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)$/.exec(value.trim())
  return m ? { job: m[1] ?? '', status: m[2], at: m[3] } : null
}

/** A stored `yyyy-MM-dd HH:mm:ss` as the ISO-ish text the chart formatters read (local, never UTC). */
export const storedTime = (value: string): string => value.replace(' ', 'T')

/**
 * The tone of one run outcome, for its badge. `stale_source` is the freshness gate refusing a run because
 * the POS replica was behind: a warning about the source, not a fault in analytics.
 */
export function runTone(status: string): Severity {
  if (status === 'success') return 'ok'
  if (status === 'stale_source') return 'warn'
  if (status === 'error' || status === 'test_fail') return 'bad'
  return 'mute'
}
