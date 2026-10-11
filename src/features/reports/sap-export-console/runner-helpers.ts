/**
 * The runner card's pure logic (BackOffice spec 2579, ticket 465), pinned by `runner-helpers.test.ts`.
 *
 * 🚩 The door judges liveness (BackOffice 2585: down = no cycle within `downAfterMinutes` while work is
 * due, idle = nothing due); nothing here re-derives it. A row only names and colours what
 * `SapExport/Runners` sent: `down` danger, `up` success, `idle` muted — a quiet night is never red.
 * Any `down` runner raises the red banner over the fleet tiles (spec 2579 story 8: a dead uploader
 * window is seen within minutes, not days).
 */
import { RUNNER_KEYS, type CycleOutcome, type Liveness, type Runner, type RunnerKey } from '@/core/models/sap-export'
import { tokenBadge, type LabelToken, type TokenBadge } from './label-helpers'

const LIVENESS_TOKEN: Record<Liveness, LabelToken> = {
  down: 'danger',
  up: 'success',
  idle: 'muted',
}

/** A last cycle's outcome: a fault is danger, a move success, an idle cycle muted, never-ran neutral. */
const OUTCOME_TOKEN: Record<CycleOutcome, LabelToken> = {
  faulted: 'danger',
  moved: 'success',
  idle: 'muted',
  none: 'neutral',
}

/** A liveness's badge. An unknown value (a door newer than this bundle) is neutral and drawn raw. */
export const livenessBadge = (liveness: string): TokenBadge => tokenBadge(LIVENESS_TOKEN, 'runners.liveness', liveness)

/** A last cycle's outcome badge. */
export const outcomeBadge = (outcome: string): TokenBadge => tokenBadge(OUTCOME_TOKEN, 'runners.outcomes', outcome)

const KNOWN_KEYS: ReadonlySet<string> = new Set(RUNNER_KEYS)

export interface RunnerRow {
  key: string
  /** The runner's name key, or `null` for a key this bundle does not know (the raw key shows). */
  nameKey: string | null
  liveness: TokenBadge
  outcome: TokenBadge
  /** `fromHeartbeat: false`: the door inferred the row from activity — the card says so. */
  inferred: boolean
  /** The fault text, shown only beside a faulted last cycle. */
  faultMessage: string | null
  runner: Runner
}

export interface RunnerSummary {
  rows: RunnerRow[]
  /** The runners that are `down`, in the door's order; empty = no banner. */
  down: RunnerRow[]
}

/** The card's rows, in the door's order (`RunnerKey` order), and the down runners the banner names. */
export function runnerRows(items: readonly Runner[]): RunnerSummary {
  const rows = items.map(
    (r): RunnerRow => ({
      key: r.key,
      nameKey: KNOWN_KEYS.has(r.key) ? `runners.names.${r.key as RunnerKey}` : null,
      liveness: livenessBadge(r.liveness),
      outcome: outcomeBadge(r.lastOutcome),
      inferred: !r.fromHeartbeat,
      faultMessage: r.lastOutcome === 'faulted' && r.lastMessage ? r.lastMessage : null,
      runner: r,
    }),
  )
  return { rows, down: rows.filter((r) => r.runner.liveness === 'down') }
}
