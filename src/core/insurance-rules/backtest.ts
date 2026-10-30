import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from './api'
import type { GuardRule, GuardSeverity, MonitorSeverity, RuleKind } from './model'

// A back-test of the guard draft (BackOffice spec 3126, door 3140; oms ticket 612). HQ replays the last 30 / 90 /
// 180 days of real requests through the saved DRAFT at its current revision and answers what it would have done.
// Shapes from the brief's "HQ contract: simulate and back-test (3140)" as BUILT. In core, not in the simulator
// feature, because 611's Submit is gated on "a back-test of the current revision" (`backtestIsCurrent`,
// `draftBacktest`) and a feature may not import another. Pure, but for the two query factories at the end.

/** The windows a back-test replays, in local days back from today (HQ's default is 90). */
export const BACKTEST_DAYS = [30, 90, 180] as const
export type BacktestDays = (typeof BACKTEST_DAYS)[number]

// ── 710 · the window is capped by retention (door 3298) ─────────────────────────────────────────
// Kept copies are purged (210 days by default), so the door answers the longest window a back-test may replay: the
// shortest retention setting it reads, minus 30 days. The monitor back-test reads the same limit, so it lives in core.

/** The door's limit in whole days. An unreadable reply is 0: nothing is offered, never everything. */
export function backtestWindowLimit(reply: unknown): number {
  const days = (reply as { maxDays?: unknown } | null | undefined)?.maxDays
  return typeof days === 'number' && Number.isFinite(days) && days > 0 ? Math.floor(days) : 0
}

/** The windows a back-test may offer under the limit. */
export const offeredBacktestDays = (limit: number): BacktestDays[] => BACKTEST_DAYS.filter((d) => d <= limit)

/** The window to use: the one asked for if it fits, else the longest that does, else none. */
export function cappedBacktestDays(days: BacktestDays, limit: number): BacktestDays | null {
  if (days <= limit) return days
  return offeredBacktestDays(limit).at(-1) ?? null
}

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
  /** What the draft's monitors would have raised (oms 700); absent when it read no kept answers. 🚩 Guessed, 711 reconciles. */
  monitors?: MonitorBacktest | null
}

// ── 700 · a monitor's reading (door 3290) ───────────────────────────────────────────────────────
// Monitors live in the guard draft and share its revision, so one job of that revision replays the requests through the
// guards and the kept answers through the monitors. A monitor reads as review items on answers, never as refusals on sales.

/** A kept answer a monitor would have raised a review item on. */
export interface MonitorBacktestItem {
  /** Local day, `yyyy-MM-dd`. */
  on: string
  /** The kept answer, as a review item names it (source, id). */
  message: { source: string; id: string }
  /** As `BacktestStopped.maskedKey`: masked again on arrival. */
  maskedKey: string
  /** The monitors that would have raised on it. */
  rules: string[]
}

export interface MonitorBacktest {
  /** Kept answers replayed. */
  answers: number
  /** Of those, how many would have raised a review item. */
  raisedOn: number
  raised: { action: number; info: number }
  /** The first answers raised on; `itemsTotal` counts them all. */
  items: MonitorBacktestItem[]
  itemsTotal: number
  rules: { ruleId: string; raised: number }[]
}

/** Which kinds this back-test reads as. A job with no monitor section is the guard report, always. */
export function backtestKinds(bt: Pick<GuardBacktest, 'monitors' | 'requests'>): RuleKind[] {
  if (!bt.monitors) return ['guard']
  return bt.requests > 0 ? ['guard', 'monitor'] : ['monitor']
}

/** The monitor section as the screen reads it: heaviest first, totals, and no patient key shown whole. */
export function monitorBacktestReading(m: MonitorBacktest) {
  const rows: [MonitorSeverity, number][] = [
    ['action', m.raised?.action ?? 0],
    ['info', m.raised?.info ?? 0],
  ]
  const items = (m.items ?? []).map((i) => ({ ...i, maskedKey: maskedKey(i.maskedKey) }))
  const itemsTotal = Math.max(items.length, m.itemsTotal ?? 0)
  return {
    rows,
    total: rows.reduce((n, [, v]) => n + v, 0),
    answers: m.answers ?? 0,
    raisedOn: m.raisedOn ?? 0,
    items,
    shown: items.length,
    itemsTotal,
    truncated: itemsTotal > items.length,
    rules: m.rules ?? [],
  }
}

/** The draft holds a monitor that still runs. */
export const draftHoldsMonitors = (rules: readonly Pick<GuardRule, 'kind' | 'state'>[]): boolean => rules.some((r) => r.kind === 'monitor' && r.state !== 'disabled')

/**
 * The back-test Submit may lean on. A draft holding a monitor needs one that read the answers: a finished job of this
 * revision with no monitor section counts as none, because the author has not seen what the monitor would raise.
 */
export function backtestForAsking<T extends Pick<GuardBacktest, 'status' | 'revision' | 'monitors'>>(bt: T | null | undefined, rules: readonly Pick<GuardRule, 'kind' | 'state'>[], revision: number): T | null {
  if (!bt) return null
  return bt.status === 'done' && bt.revision === revision && !bt.monitors && draftHoldsMonitors(rules) ? null : bt
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

/** `GET InsuranceRules/Backtests/WindowLimit` → `{ maxDays }` (door 3298; 🚩 path and shape guessed, 711 reconciles). */
export function backtestWindowLimitQuery() {
  return {
    queryKey: [...INSURANCE_RULES_KEY, 'backtests', 'window-limit'],
    queryFn: async () => backtestWindowLimit(await api.get<unknown>(`${INSURANCE_RULES_BASE}/Backtests/WindowLimit`)),
    retry: false,
  } as const
}

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
