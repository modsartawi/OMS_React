import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from './api'
import type { GuardSeverity } from './model'

// A back-test of the guard draft (BackOffice spec 3126, door 3140; oms ticket 612). HQ replays the last 30 / 90 /
// 180 days of real requests through the saved DRAFT at its current revision and answers what it would have done.
// Shapes from the brief's "HQ contract: simulate and back-test (3140)" as BUILT. In core, not in the simulator
// feature, because 611's Submit is gated on "a back-test of the current revision" (`backtestIsCurrent`,
// `draftBacktest`) and a feature may not import another. Pure, but for the two query factories at the end.

/** The windows a back-test replays, in local days back from today (HQ's default is 90). */
export const BACKTEST_DAYS = [30, 90, 180] as const
export type BacktestDays = (typeof BACKTEST_DAYS)[number]

/** An unknown value reads as finished (no endless poll). */
export const BACKTEST_STATUSES = ['queued', 'running', 'done', 'failed'] as const
export type BacktestStatus = (typeof BACKTEST_STATUSES)[number]

/** A request line the draft would have refused or held for an override. */
export interface BacktestStopped {
  /** Local day, `yyyy-MM-dd`. */
  on: string
  store: string
  item: string
  /** The patient key as HQ masks it: the first digit and the last two (`1*******01`). */
  maskedKey: string
  /** Quantity × today's master unit price — an estimate (the history holds no amount). */
  sar: number
  /** The draft rules that stopped it. */
  rules: string[]
}

/** One draft rule's share of the back-test. */
export interface BacktestRule {
  ruleId: string
  fires: number
  stopped: number
}

/** `GET InsuranceRules/Guards/Backtests/{id}` (and each row of `GET …/Backtests`; the answer of `POST …/Backtests`). */
export interface GuardBacktest {
  id: string
  status: BacktestStatus
  /** A fraction 0–1 (read defensively: held inside 0–100 %). */
  progress: number
  /** The draft revision it replayed — ties it to Submit (611). */
  revision: number
  days: number
  requestedBy: string | null
  requestedAt: string | null
  finishedAt: string | null
  /** HQ's words when it failed. */
  error: string | null
  /** The first local day replayed. */
  since: string | null
  /** Past requests replayed, and their lines. */
  requests: number
  lines: number
  fires: { refuse: number; override: number; warn: number }
  /** The first 500 stopped lines; `stoppedTotal` counts them all. */
  stopped: BacktestStopped[]
  stoppedTotal: number
  /** SAR of the stopped lines (an estimate). */
  sar: number
  /** Over the requests the draft fired on. */
  distinct: { patients: number; stores: number; pharmacists: number }
  /** Fired lines where a LIVE guard fired too. */
  overlap: number
  rules: BacktestRule[]
}

export const backtestRunning = (bt: Pick<GuardBacktest, 'status'>): boolean => bt.status === 'queued' || bt.status === 'running'

export function backtestProgressPct(bt: Pick<GuardBacktest, 'progress'>): number {
  const pct = Math.round((Number.isFinite(bt.progress) ? bt.progress : 0) * 100)
  return Math.min(100, Math.max(0, pct))
}

/** The back-test 611's Submit needs: finished, on the revision the draft is at now. */
export const backtestIsCurrent = (bt: Pick<GuardBacktest, 'status' | 'revision'> | null | undefined, revision: number): boolean =>
  !!bt && bt.status === 'done' && bt.revision === revision

/**
 * The draft's back-test to show beside revision `revision`, from `GET …/Backtests` (newest first): a finished one of
 * this revision, else the newest of this revision (running / failed), else the newest at all (it is then out of date).
 */
export function draftBacktest<T extends Pick<GuardBacktest, 'status' | 'revision'>>(list: readonly T[] | null | undefined, revision: number): T | null {
  if (!list?.length) return null
  const mine = list.filter((b) => b.revision === revision)
  return mine.find((b) => b.status === 'done') ?? mine.find((b) => b.status !== 'failed') ?? mine[0] ?? list[0]
}

/** How many stopped lines arrived and how many there are: HQ sends the first 500. */
export function stoppedShown(bt: Pick<GuardBacktest, 'stopped' | 'stoppedTotal'>): { shown: number; total: number; truncated: boolean } {
  const shown = bt.stopped.length
  const total = Math.max(shown, bt.stoppedTotal ?? shown)
  return { shown, total, truncated: total > shown }
}

/** Its fires by severity, heaviest first (REFUSE > OVERRIDE > WARN), and their total. */
export function backtestFires(bt: Pick<GuardBacktest, 'fires'>): { rows: [GuardSeverity, number][]; total: number } {
  const rows: [GuardSeverity, number][] = [
    ['REFUSE', bt.fires.refuse ?? 0],
    ['OVERRIDE', bt.fires.override ?? 0],
    ['WARN', bt.fires.warn ?? 0],
  ]
  return { rows, total: rows.reduce((n, [, v]) => n + v, 0) }
}

const MASK = '*'

/**
 * A patient key as a back-test may show it: HQ masks it (`1*******01`, the first digit and the last two); one that
 * arrives whole is masked here the same way, so a slip on the wire never puts a National ID / Iqama on screen.
 */
export function maskedKey(key: string): string {
  if (!key || /[*•]/.test(key)) return key
  if (key.length <= 3) return MASK.repeat(key.length)
  return key.slice(0, 1) + MASK.repeat(key.length - 3) + key.slice(-2)
}

// ── 611 · the draft's back-test, as the approval panel reads it ─────────────────────────────────

/** Where a draft revision stands with its back-test; `current` is `backtestIsCurrent`. */
export type BacktestStanding = 'none' | 'running' | 'failed' | 'stale' | 'current'

export function backtestStanding(bt: Pick<GuardBacktest, 'status' | 'revision'> | null | undefined, revision: number): BacktestStanding {
  if (!bt) return 'none'
  if (bt.revision !== revision) return 'stale'
  if (bt.status === 'failed') return 'failed'
  if (backtestRunning(bt)) return 'running'
  return backtestIsCurrent(bt, revision) ? 'current' : 'running'
}

/** The key root of every back-test read: a restore or a new job invalidates it. */
export const GUARD_BACKTESTS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'backtests'] as const
/** How often a running back-test is read again. */
export const BACKTEST_POLL_MS = 1000

/** `GET InsuranceRules/Guards/Backtests` — the current draft's back-tests, newest first; polled while one runs. */
export function draftBacktestsQuery() {
  return {
    queryKey: [...GUARD_BACKTESTS_KEY, 'list'],
    queryFn: async () => (await api.get<GuardBacktest[] | null>(`${INSURANCE_RULES_BASE}/Guards/Backtests`)) ?? [],
    retry: false,
    refetchInterval: (q: { state: { data?: GuardBacktest[] } }) => (q.state.data?.some(backtestRunning) ? BACKTEST_POLL_MS : false),
  } as const
}

/** `GET InsuranceRules/Guards/Backtests/{id}` — one back-test, polled while it runs. */
export function backtestByIdQuery(id: string) {
  return {
    queryKey: [...GUARD_BACKTESTS_KEY, 'id', id],
    queryFn: () => api.get<GuardBacktest>(`${INSURANCE_RULES_BASE}/Guards/Backtests/${encodeURIComponent(id)}`),
    retry: false,
    refetchInterval: (q: { state: { data?: GuardBacktest } }) => (q.state.data && !backtestRunning(q.state.data) ? false : BACKTEST_POLL_MS),
  } as const
}
