/**
 * The one-shot commands' pure logic (spec 444, ticket 448): which commands a store
 * offers, the command poll, the re-push date bound and its preview sentence, and the
 * Commands feed's query. No React, no network — pinned by `command-helpers.test.ts`.
 *
 * The reason, the 50-store cap and the per-row result summary are 447's
 * (`control-helpers.ts`) and are reused, not copied.
 */
import type { Severity } from '@/core/ui/severity'
import type {
  CommandKind,
  CommandStatus,
  ControlAction,
  RePushResponse,
  StoreRow,
  SyncCommand,
  SyncConsoleAccess,
} from '@/core/models/sync-console'
import { toIsoDate, fromIsoDate } from '@/core/util/date-format'
import { formatPair } from '@/core/util/bidi'
import { allowedControls } from './control-helpers'
import { codeBadge, figure, type CodeBadge } from './helpers'

// ── What a store's page offers ──────────────────────────────────────────────────

/** A button of the store page's control row: a lasting control (447) or a one-shot command (448). */
export type StoreAction = ControlAction | CommandKind

/**
 * The one-shot commands a store's page renders. Without `canOperate`: none (absent,
 * not disabled). A WPF store: only Test connection — Retry now and Re-push need the
 * worker (the door's `NOT_ON_WORKER`). A worker store: all three.
 */
export function allowedCommands(
  row: Pick<StoreRow, 'host'>,
  access: Pick<SyncConsoleAccess, 'canOperate'> | null | undefined,
): CommandKind[] {
  if (access?.canOperate !== true) return []
  if (row.host === 'Wpf') return ['ConnectionTest']
  if (row.host === 'Worker') return ['RetryNow', 'RePush', 'ConnectionTest']
  return []
}

/**
 * The whole control row in the prototype's order: on a worker store Retry now,
 * Pause or Resume, Re-push, Test connection, Hand back; on a WPF store Move to
 * worker, Test connection.
 */
export function storeActions(
  row: Pick<StoreRow, 'host' | 'isPaused'>,
  access: Pick<SyncConsoleAccess, 'canOperate'> | null | undefined,
): StoreAction[] {
  const controls = allowedControls(row, access)
  const commands = allowedCommands(row, access)
  const order: StoreAction[] = ['RetryNow', 'Move', 'Pause', 'Resume', 'RePush', 'ConnectionTest', 'HandBack']
  const offered = new Set<StoreAction>([...controls, ...commands])
  return order.filter((a) => offered.has(a))
}

/** Whether a row action is a one-shot command rather than a lasting control. */
export const isCommandKind = (a: StoreAction): a is CommandKind =>
  a === 'RetryNow' || a === 'RePush' || a === 'ConnectionTest'

// ── The command poll ────────────────────────────────────────────────────────────

/** The statuses a command never leaves. */
export const TERMINAL_STATUSES: ReadonlySet<CommandStatus> = new Set(['Done', 'Failed', 'Cancelled', 'Expired'])

export const isTerminal = (status: string): boolean => TERMINAL_STATUSES.has(status as CommandStatus)

/** The poll asks every 2 s… */
export const POLL_INTERVAL_MS = 2_000
/** …and gives up after 60 s: the command is then "still running", never "failed". */
export const POLL_TIMEOUT_MS = 60_000

export interface PollResult<C> {
  /** `terminal`: every command finished. `timeout`: 60 s passed first. `aborted`: the caller left. */
  outcome: 'terminal' | 'timeout' | 'aborted'
  /** The last answer read (empty when none was). */
  commands: C[]
}

/**
 * Reads a batch every `intervalMs` until EVERY command in it is terminal, or
 * `timeoutMs` has passed. The first read is one interval after the call (the
 * command was just queued). A read that fails is not a verdict on the command: the
 * poll keeps the last answer and asks again, so a blip can only end in a timeout
 * ("still running"), never in "failed". An empty answer is not terminal.
 */
export async function pollUntilTerminal<C extends { status: string }>(
  read: () => Promise<C[]>,
  {
    intervalMs = POLL_INTERVAL_MS,
    timeoutMs = POLL_TIMEOUT_MS,
    onUpdate,
    signal,
  }: { intervalMs?: number; timeoutMs?: number; onUpdate?: (commands: C[]) => void; signal?: AbortSignal } = {},
): Promise<PollResult<C>> {
  const start = Date.now()
  let last: C[] = []
  for (;;) {
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
    if (signal?.aborted) return { outcome: 'aborted', commands: last }
    try {
      last = await read()
    } catch {
      // Keep the last answer; the next tick asks again.
    }
    if (signal?.aborted) return { outcome: 'aborted', commands: last }
    onUpdate?.(last)
    if (last.length > 0 && last.every((c) => isTerminal(c.status))) return { outcome: 'terminal', commands: last }
    if (Date.now() - start >= timeoutMs) return { outcome: 'timeout', commands: last }
  }
}

/** A finished command run, as the store page draws it. */
export type RunVerdict = 'running' | 'ok' | 'failed' | 'stillRunning'

/**
 * One store's command after the poll: `ok` when it is Done, `failed` when it ended
 * any other way (Failed, Cancelled, Expired), `stillRunning` when the poll timed out
 * first, `running` while it is still being polled.
 */
export function runVerdict(command: Pick<SyncCommand, 'status'> | undefined, timedOut: boolean): RunVerdict {
  if (command && command.status === 'Done') return 'ok'
  if (command && isTerminal(command.status)) return 'failed'
  return timedOut ? 'stillRunning' : 'running'
}

// ── Command badges ──────────────────────────────────────────────────────────────

const STATUS_SEVERITY: Record<CommandStatus, Severity> = {
  Pending: 'go',
  Running: 'warn',
  Done: 'ok',
  Failed: 'bad',
  Cancelled: 'mute',
  Expired: 'mute',
}

/** A command status's badge; an unknown status is neutral with its raw code. */
export function commandStatusBadge(status: string): CodeBadge {
  return codeBadge(STATUS_SEVERITY, 'commandStatus', status)
}

const KIND_LABELS: Record<CommandKind, true> = { RetryNow: true, RePush: true, ConnectionTest: true }

/** A command kind's label key, or `null` for one this bundle does not know (show the raw code). */
export function commandKindKey(kind: string): string | null {
  return Object.hasOwn(KIND_LABELS, kind) ? `commandKinds.${kind}` : null
}

/** Only a Pending command can be cancelled (the door's `NOT_PENDING` otherwise). */
export const canCancel = (c: Pick<SyncCommand, 'status'>): boolean => c.status === 'Pending'

// ── The re-push date ────────────────────────────────────────────────────────────

/** The action log keeps 41 days: today and the 40 before it. */
export const ACTION_WINDOW_DAYS = 41

const daysBefore = (today: Date, days: number): string =>
  toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days))

/**
 * The re-push "from" picker's bounds, from **today's local date** (no UTC
 * round-trip): no earlier than the start of the 41-day window, no later than today,
 * and opening on the window's start (the door's own default).
 */
export function rePushDateBounds(today: Date): { min: string; max: string; initial: string } {
  const min = daysBefore(today, ACTION_WINDOW_DAYS - 1)
  return { min, max: toIsoDate(today), initial: min }
}

/**
 * What the picker holds after a change: a date past either end is pulled back to it
 * (a browser's `min`/`max` only marks a typed date invalid), and a cleared or
 * unreadable box goes back to the opening date.
 */
export function clampRePushFrom(value: string, today: Date): string {
  const bound = rePushDateBounds(today)
  const day = fromIsoDate(value)
  if (!day) return bound.initial
  const iso = toIsoDate(day)
  if (iso < bound.min) return bound.min
  if (iso > bound.max) return bound.max
  return iso
}

// ── The re-push inputs and preview ──────────────────────────────────────────────

/** What a preview was asked for. A confirm is only offered while the inputs still match it. */
export interface RePushInputs {
  codes: readonly string[]
  /** `null` = every push object. */
  objectIds: readonly string[] | null
  fromDate: string
}

/** Whether two sets of inputs are the same request (object order does not matter). */
export function sameRePushInputs(a: RePushInputs, b: RePushInputs): boolean {
  const same = (x: readonly string[], y: readonly string[]) => x.length === y.length && x.every((v, i) => v === y[i])
  const sorted = (x: readonly string[] | null) => (x === null ? null : [...x].sort())
  const ao = sorted(a.objectIds)
  const bo = sorted(b.objectIds)
  return (
    a.fromDate === b.fromDate &&
    same(a.codes, b.codes) &&
    (ao === null || bo === null ? ao === bo : same(ao, bo))
  )
}

/**
 * The echoed date as the door wrote it — its day part, never parsed into a `Date`
 * (a bare `yyyy-MM-dd` would be read as UTC and could shift a day). A value of any
 * other shape is shown as it came.
 */
export function echoedDay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value
}

export interface PreviewSentence {
  /** The `sync-console` key of the one sentence. */
  key: 'rePush.preview.one' | 'rePush.preview.many' | 'rePush.preview.none'
  /** Its values, raw: the caller isolates each one (`fsi`) as it interpolates it. */
  values: {
    total: string
    /** How many stores will replay (the refused ones are not counted). */
    stores: string
    /** The total actions — the sentence's plural follows it ("1 action", "2 actions"). */
    count: number
    from: string
    /** One store's code (the `one` sentence). */
    code: string
    /** Every replaying store with its count, `P005 · 1,204, P006 · 980`, one machine list. */
    perStore: string
  }
}

/**
 * A preview's answer as ONE sentence: the replay count per store and in total, and
 * the effective date the door echoed (not the date that was picked). The refused
 * stores are left out of it — they are listed apart, with their codes.
 */
export function rePushPreviewSentence(
  preview: Pick<RePushResponse, 'effectiveFromDate' | 'totalActions' | 'perStore'>,
  separator = ', ',
): PreviewSentence {
  const replaying = preview.perStore.filter((s) => s.ok)
  const key = replaying.length === 0 ? 'rePush.preview.none' : replaying.length === 1 ? 'rePush.preview.one' : 'rePush.preview.many'
  return {
    key,
    values: {
      total: figure(preview.totalActions),
      stores: figure(replaying.length),
      count: preview.totalActions,
      from: echoedDay(preview.effectiveFromDate),
      code: replaying.length === 1 ? replaying[0].code : '',
      perStore: replaying.map((s) => formatPair(s.code, figure(s.actions))).join(separator),
    },
  }
}

// ── The Commands feed ───────────────────────────────────────────────────────────

/** The commands door pages; the console asks for 50 a page. */
export const COMMANDS_PAGE_SIZE = 50

/** The Commands page's filters, as typed; `''` = any. */
export interface CommandsFilter {
  status: CommandStatus | ''
  batch: string
  code: string
  kind: CommandKind | ''
}

export const EMPTY_COMMANDS_FILTER: CommandsFilter = { status: '', batch: '', code: '', kind: '' }

/**
 * The `GET ActionSync/Commands` parameters. Text is trimmed and a blank value is
 * dropped by the core query builder; the code and batch are sent as typed, never
 * re-cased.
 */
export function commandsQuery(filter: CommandsFilter, page: number): Record<string, unknown> {
  return {
    status: filter.status,
    batch: filter.batch.trim(),
    code: filter.code.trim(),
    kind: filter.kind,
    page: Math.max(1, Math.floor(page)),
    pageSize: COMMANDS_PAGE_SIZE,
  }
}
