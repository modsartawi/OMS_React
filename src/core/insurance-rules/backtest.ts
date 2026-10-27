// The back-test of the guard draft, as more than one feature reads it (BackOffice door 3140): 612 starts one and
// reads its report; 611's "Ask for approval" needs one of the CURRENT revision (brief: "Submit is disabled until a
// back-test of the current revision exists"). A feature may not import another, so the status shape, the read of
// the latest one and the gate live here. Kept MINIMAL: 612 owns the report (fires, stopped requests, SAR, …).
//
// ⚠️ PROVISIONAL (611), 618 reconciles: the brief has `POST …/Backtests` → `{ id }` and `GET …/Backtests/{id}` →
// `{ status, progress, revision, … }`, but no way to find the LATEST one. Guessed: `GET InsuranceRules/Guards/
// Backtests/Latest` → the same status shape, or null when the draft was never back-tested. `status` spelled
// `queued | running | done | failed` (the brief names `status`, not its values); `progress` 0–1.
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from './api'

export const BACKTEST_STATUSES = ['queued', 'running', 'done', 'failed'] as const
export type BacktestRunStatus = (typeof BACKTEST_STATUSES)[number]

/** The back-test fields every reader shares; 612's report extends it. */
export interface BacktestStatus {
  id: string
  status: BacktestRunStatus
  /** 0–1. */
  progress: number
  /** The draft revision it ran on — ties it to the draft (the Submit gate). */
  revision: number
  /** 30 | 90 | 180. */
  days?: number
  /** Local moment it finished, when it has. */
  finishedAt?: string | null
}

/** Where a draft revision stands with its back-test. */
export type BacktestStanding = 'none' | 'running' | 'failed' | 'stale' | 'current'

export function backtestStanding(bt: BacktestStatus | null | undefined, revision: number): BacktestStanding {
  if (!bt) return 'none'
  if (bt.revision !== revision) return 'stale'
  if (bt.status === 'failed') return 'failed'
  if (bt.status !== 'done') return 'running'
  return 'current'
}

export const BACKTESTS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'backtests'] as const

/** `GET InsuranceRules/Guards/Backtests/Latest` (⚠️ guessed door) — the latest back-test, or null. */
export function latestBacktest(): Promise<BacktestStatus | null> {
  return api.get<BacktestStatus | null>(`${INSURANCE_RULES_BASE}/Guards/Backtests/Latest`)
}

/** Polls every 2 s while the latest back-test is queued or running. */
export function latestBacktestQuery() {
  return {
    queryKey: [...BACKTESTS_KEY, 'latest'],
    queryFn: latestBacktest,
    retry: false,
    refetchInterval: (q: { state: { data?: BacktestStatus | null } }) => {
      const s = q.state.data?.status
      return s === 'queued' || s === 'running' ? 2000 : false
    },
  } as const
}
