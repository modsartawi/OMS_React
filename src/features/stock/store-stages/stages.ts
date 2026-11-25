/**
 * The stage screen's rules and rows (BackOffice ticket 3899, spec 3849 phase 2). Pure, pinned by `stages.test.ts`.
 *
 * Which moves a person may make is SIS.Stock 064's decision, and it refuses any other with `StageMoveRefused`; the screen
 * offers only those (any stage back to Shadow, Seeded to Blocking, Blocking back to Seeded) so a person is not invited to a
 * refusal. Shadow to Seeding is the count's closing and Seeding to Seeded the seed's: never a person's.
 */
import {
  isStageName,
  type StageName,
  type StoreCountRow,
  type StoreGate,
  type StoreGates,
  type StoreSeedStatus,
  type StoreStage,
  type StoreStageMoveRequest,
} from '@/core/models/store-stage'

/** SIS.Stock's log keeps a reason of at most 500 characters. */
export const WHY_MAX = 500

/** The stages a person may move a store to from `from`. */
export function personMovesFrom(from: string): StageName[] {
  switch (from) {
    case 'Shadow':
      return []
    case 'Seeded':
      return ['Shadow', 'Blocking']
    case 'Blocking':
      return ['Shadow', 'Seeded']
    default:
      return ['Shadow']
  }
}

/** Whether the move form may be sent. A move to Blocking also needs its gates check ready (ticket 4261). */
export function moveCommit({
  from,
  to,
  why,
  pending,
  blocking,
}: {
  from: string
  to: string
  why: string
  pending: boolean
  blocking?: BlockingCheck
}): {
  canCommit: boolean
  tooLong: boolean
} {
  const reason = why.trim()
  const tooLong = reason.length > WHY_MAX
  const allowed = (personMovesFrom(from) as string[]).includes(to)
  const gatesReady = to !== 'Blocking' || blocking?.ready === true
  return { canCommit: !pending && allowed && gatesReady && reason.length > 0 && !tooLong, tooLong }
}

/**
 * BackOffice ticket 4261 (ADR 0145, SIS.Stock 081): the store's gates, its own proof and the fleet's, apart. A gate not
 * marked `Fleet` is the store's, as Stock Visibility reads it, so it can never be waived by mistake.
 */
export function gatesApart(gates: StoreGates | null | undefined): { store: StoreGate[]; fleet: StoreGate[] } {
  const measured = gates?.measured ?? []
  return { store: measured.filter((g) => g.scope !== 'Fleet'), fleet: measured.filter((g) => g.scope === 'Fleet') }
}

/** A gate's figure, one failing day or feed per line (Stock Visibility joins them with `; `). */
export function figureLines(figure: string | null | undefined): string[] {
  return (figure ?? '')
    .split('; ')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/** What a move to Blocking still lacks, measured against the gates answer. */
export interface BlockingCheck {
  ready: boolean
  /** Every confirmation the move must name (the answer's `notConfirmed`, read with none given), in its order. */
  toConfirm: string[]
  missing: string[]
  /** The store's own gates that fail: never waived, so the move is refused. */
  storeFailing: string[]
  /** The failing fleet gates not waived (a waiver counts only for a holder of `StoreBlockEarly:02`). */
  unwaived: string[]
}

export function blockingCheck({
  gates,
  confirmed,
  waived,
  canWaive,
}: {
  gates: StoreGates | null | undefined
  confirmed: readonly string[]
  waived: readonly string[]
  canWaive: boolean
}): BlockingCheck {
  const { store, fleet } = gatesApart(gates)
  const toConfirm = gates?.notConfirmed ?? []
  const missing = toConfirm.filter((n) => !confirmed.includes(n))
  const storeFailing = store.filter((g) => !g.holds).map((g) => g.gate)
  const unwaived = fleet.filter((g) => !g.holds && !(canWaive && waived.includes(g.gate))).map((g) => g.gate)
  return {
    ready: !!gates && missing.length === 0 && storeFailing.length === 0 && unwaived.length === 0,
    toConfirm,
    missing,
    storeFailing,
    unwaived,
  }
}

/**
 * The move's body. A move to Blocking names the confirmations ticked (in the answer's order, only names it asks for) and
 * the failing fleet gates ticked for a waiver (only for a holder of the grant); every other move sends neither.
 */
export function moveRequest({
  to,
  why,
  gates,
  confirmed,
  waived,
  canWaive,
}: {
  to: string
  why: string
  gates: StoreGates | null | undefined
  confirmed: readonly string[]
  waived: readonly string[]
  canWaive: boolean
}): StoreStageMoveRequest {
  if (to !== 'Blocking') return { stage: to, why: why.trim() }
  const failingFleet = gatesApart(gates).fleet.filter((g) => !g.holds).map((g) => g.gate)
  return {
    stage: to,
    why: why.trim(),
    confirmed: (gates?.notConfirmed ?? []).filter((n) => confirmed.includes(n)),
    waived: canWaive ? failingFleet.filter((g) => waived.includes(g)) : [],
  }
}

/** The screen's URL: a store prefix, a stage, and the store whose log is open. */
export interface StagesFilters {
  store: string
  stage: '' | StageName
  open: string
}

export const STAGES_DEFAULTS: StagesFilters = { store: '', stage: '', open: '' }

const code = (s: string | null) => (s ?? '').trim().toUpperCase()

export function stagesFiltersFromParams(params: URLSearchParams): StagesFilters {
  const stage = (params.get('stage') ?? '').trim()
  return { store: code(params.get('store')), stage: isStageName(stage) ? stage : '', open: code(params.get('open')) }
}

export function stagesFiltersToParams(filters: StagesFilters): URLSearchParams {
  const qs = new URLSearchParams()
  if (filters.store) qs.set('store', filters.store)
  if (filters.stage) qs.set('stage', filters.stage)
  if (filters.open) qs.set('open', filters.open)
  return qs
}

/** The stores shown: those starting with the store filter, in the stage filter. */
export function stagesShown(stages: StoreStage[], filters: StagesFilters): StoreStage[] {
  return stages.filter(
    (s) => (!filters.store || s.store.toUpperCase().startsWith(filters.store)) && (!filters.stage || s.stage === filters.stage),
  )
}

/** One store as one grid row: its stage and its last move. */
export interface StageRow {
  store: string
  stage: string
  lastFrom: string
  lastMover: string
  lastWho: string
  lastWhy: string
  lastMovedAt: string
}

export function stageRow(s: StoreStage): StageRow {
  const m = s.lastMove
  return {
    store: s.store,
    stage: s.stage,
    lastFrom: m?.from ?? '',
    lastMover: m?.mover ?? '',
    lastWho: m?.who ?? '',
    lastWhy: m?.why ?? '',
    lastMovedAt: m?.movedAt ?? '',
  }
}

/**
 * Ticket 3898, the count's closing. A store under count has a `StoreLastInventory` row; "count closed" marks it (both
 * export rails and DRS then hold the store whatever the date) and asks the seed. The row is gone once the seed writes
 * Seeded; after a refused seed a named person releases it by hand with a reason.
 */
export type CountState = 'none' | 'open' | 'closed'

/** The store's count row, if it is under count. */
export function countOf(counts: StoreCountRow[], store: string): StoreCountRow | null {
  const wanted = store.trim().toUpperCase()
  return counts.find((c) => c.storeCode.trim().toUpperCase() === wanted) ?? null
}

export function countState(row: StoreCountRow | null): CountState {
  if (!row) return 'none'
  return row.isCountClosed ? 'closed' : 'open'
}

/** "Count closed" is offered on an open count, and again on a closed one (the seed is asked again). */
export function canAskCountClosed(row: StoreCountRow | null, granted: boolean, pending: boolean): boolean {
  return granted && !pending && countState(row) !== 'none'
}

/**
 * What the Count section shows of the store's seed. Only a run that answers the store's present closed count is shown: a
 * run an earlier closing asked says nothing about this one. A refusal that opened the count again is not shown as a
 * refusal that holds the store (the section says the count is open again instead).
 */
export function seedView(status: StoreSeedStatus | null | undefined): {
  running: boolean
  refusal: string | null
  failure: string | null
} {
  if (!status || !status.ofThisClosing) return { running: false, refusal: null, failure: null }
  return {
    running: status.state === 'Running',
    refusal: status.state === 'Refused' && !status.reopened ? status.reason || null : null,
    failure: status.state === 'Failed' ? status.reason || null : null,
  }
}

/** A local calendar day as `yyyy-MM-dd` — the estate's wall clock, never UTC (`toISOString` would shift it). */
export function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * "Start count" (BackOffice 2026-11-23, the desktop Block): offered on a store with no count, for a day of today or
 * earlier (a count recorded late); a later day is refused, here and on the server.
 */
export function startCommit({ row, day, today, pending }: { row: StoreCountRow | null; day: string; today: string; pending: boolean }): {
  canCommit: boolean
  inFuture: boolean
} {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day)
  const inFuture = valid && day > today
  return { canCommit: !pending && countState(row) === 'none' && valid && !inFuture, inFuture }
}

/** "Cancel count" (the desktop Unblock): an OPEN count only, with a reason of at most 500 characters. A closed count ends
 * by its seed or by the hand release. */
export function cancelCommit({ row, why, pending }: { row: StoreCountRow | null; why: string; pending: boolean }): {
  canCommit: boolean
  tooLong: boolean
} {
  const reason = why.trim()
  const tooLong = reason.length > WHY_MAX
  return { canCommit: !pending && countState(row) === 'open' && reason.length > 0 && !tooLong, tooLong }
}

/** The hand release may be sent on a closed count, with a reason of at most 500 characters (the log's width). */
export function releaseCommit({ row, why, pending }: { row: StoreCountRow | null; why: string; pending: boolean }): {
  canCommit: boolean
  tooLong: boolean
} {
  const reason = why.trim()
  const tooLong = reason.length > WHY_MAX
  return { canCommit: !pending && countState(row) === 'closed' && reason.length > 0 && !tooLong, tooLong }
}
