import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from './api'
import type { GuardSeverity } from './model'

// A back-test of the guard draft (BackOffice spec 3126, door 3140; oms ticket 612). HQ replays the last 30 / 90 /
// 180 days of real requests through the DRAFT and answers what it would have done. Shapes from the brief's
// "HQ contract: simulate and back-test (3140)". In core, not in the simulator feature, because 611's Submit is
// gated on "a back-test of the current revision" (`backtestIsCurrent`) and a feature may not import another.
//
// ⚠️ Named `GuardBacktest` (612). 611 builds in parallel and may add its own minimal back-test status shape here;
// the merger keeps ONE. Fields marked GUESS are not spelled by the brief; 618 reconciles them.
// Pure.

/** The windows a back-test replays, in local days back from today. */
export const BACKTEST_DAYS = [30, 90, 180] as const
export type BacktestDays = (typeof BACKTEST_DAYS)[number]

/** GUESS (612): the brief names `status`, not its values. An unknown value reads as finished (no endless poll). */
export const BACKTEST_STATUSES = ['queued', 'running', 'done', 'failed'] as const
export type BacktestStatus = (typeof BACKTEST_STATUSES)[number]

/** A request the draft would have stopped. `on` is a local day or moment; the patient key comes masked. */
export interface BacktestStopped {
  on: string
  store: string
  item: string
  maskedKey: string
  sar: number
}

/** `GET InsuranceRules/Guards/Backtests/{id}`. */
export interface GuardBacktest {
  status: BacktestStatus
  /** GUESS (612): a fraction 0–1. */
  progress: number
  /** The draft revision it replayed — ties it to Submit (611). */
  revision: number
  fires: { refuse: number; override: number; warn: number }
  stopped: BacktestStopped[]
  /** SAR of the stopped requests. */
  sar: number
  distinct: { patients: number; stores: number; pharmacists: number }
  /** GUESS (612): how many of its fires a LIVE guard fires on too (a count). */
  overlap: number
}

/** `POST InsuranceRules/Guards/Backtests` → the job's id. */
export interface BacktestStarted {
  id: string
}

export const backtestRunning = (bt: Pick<GuardBacktest, 'status'>): boolean => bt.status === 'queued' || bt.status === 'running'

export function backtestProgressPct(bt: Pick<GuardBacktest, 'progress'>): number {
  const pct = Math.round((Number.isFinite(bt.progress) ? bt.progress : 0) * 100)
  return Math.min(100, Math.max(0, pct))
}

/** The back-test 611's Submit needs: finished, on the revision the draft is at now. */
export const backtestIsCurrent = (bt: Pick<GuardBacktest, 'status' | 'revision'> | null | undefined, revision: number): boolean =>
  !!bt && bt.status === 'done' && bt.revision === revision

/** Its fires by severity, heaviest first (REFUSE > OVERRIDE > WARN), and their total. */
export function backtestFires(bt: Pick<GuardBacktest, 'fires'>): { rows: [GuardSeverity, number][]; total: number } {
  const rows: [GuardSeverity, number][] = [
    ['REFUSE', bt.fires.refuse ?? 0],
    ['OVERRIDE', bt.fires.override ?? 0],
    ['WARN', bt.fires.warn ?? 0],
  ]
  return { rows, total: rows.reduce((n, [, v]) => n + v, 0) }
}

const MASK = '•'

/**
 * A patient key as a back-test may show it: HQ masks it (`10••••••83`); one that arrives whole is masked here,
 * two digits kept at each end, so a slip on the wire never puts a National ID / Iqama on screen.
 */
export function maskedKey(key: string): string {
  if (!key || key.includes(MASK)) return key
  if (key.length <= 4) return MASK.repeat(key.length)
  return key.slice(0, 2) + MASK.repeat(key.length - 4) + key.slice(-2)
}

// ── 611 · the draft's back-test, as the approval panel reads it ─────────────────────────────────
//
// ⚠️ PROVISIONAL (611), 618 reconciles: no door LISTS back-tests, so the approval read
// (`GET InsuranceRules/Guards/Approval`, itself a guess) is read as carrying `backtestId` — the draft's latest
// back-test, which HQ records when `POST …/Backtests` starts one — and the panel reads it through 612's door
// (`GET …/Backtests/{id}`, same query key as the simulator's, so both share one cache entry).

/** Where a draft revision stands with its back-test; `current` is `backtestIsCurrent`. */
export type BacktestStanding = 'none' | 'running' | 'failed' | 'stale' | 'current'

export function backtestStanding(bt: Pick<GuardBacktest, 'status' | 'revision'> | null | undefined, revision: number): BacktestStanding {
  if (!bt) return 'none'
  if (bt.revision !== revision) return 'stale'
  if (bt.status === 'failed') return 'failed'
  if (backtestRunning(bt)) return 'running'
  return backtestIsCurrent(bt, revision) ? 'current' : 'running'
}

/** The simulator's key root (`features/insurance-rules/simulator/api`): a restore or a new job invalidates it. */
export const GUARD_BACKTESTS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'backtests'] as const

/** `GET InsuranceRules/Guards/Backtests/{id}`, polled every 2 s while it runs; nothing to read without an id. */
export function draftBacktestQuery(id: string | null | undefined) {
  return {
    queryKey: [...GUARD_BACKTESTS_KEY, id ?? ''],
    queryFn: () => api.get<GuardBacktest>(`${INSURANCE_RULES_BASE}/Guards/Backtests/${encodeURIComponent(id ?? '')}`),
    enabled: !!id,
    retry: false,
    refetchInterval: (q: { state: { data?: GuardBacktest } }) => (q.state.data && backtestRunning(q.state.data) ? 2000 : false),
  } as const
}
