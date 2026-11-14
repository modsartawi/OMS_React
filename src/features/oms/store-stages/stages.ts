/**
 * The stage screen's rules and rows (BackOffice ticket 3899, spec 3849 phase 2). Pure, pinned by `stages.test.ts`.
 *
 * Which moves a person may make is SIS.Stock 064's decision, and it refuses any other with `StageMoveRefused`; the screen
 * offers only those (any stage back to Shadow, Seeded to Blocking, Blocking back to Seeded) so a person is not invited to a
 * refusal. Shadow to Seeding is the count's closing and Seeding to Seeded the seed's: never a person's.
 */
import type { StoreStage } from '@/core/models/store-stage'

export const STAGES = ['Shadow', 'Seeding', 'Seeded', 'Blocking'] as const
export type StageName = (typeof STAGES)[number]

/** SIS.Stock's log keeps a reason of at most 500 characters. */
export const WHY_MAX = 500

const isStage = (s: string): s is StageName => (STAGES as readonly string[]).includes(s)

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

/** Whether the move form may be sent. */
export function moveCommit({ from, to, why, pending }: { from: string; to: string; why: string; pending: boolean }): {
  canCommit: boolean
  tooLong: boolean
} {
  const reason = why.trim()
  const tooLong = reason.length > WHY_MAX
  const allowed = (personMovesFrom(from) as string[]).includes(to)
  return { canCommit: !pending && allowed && reason.length > 0 && !tooLong, tooLong }
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
  return { store: code(params.get('store')), stage: isStage(stage) ? stage : '', open: code(params.get('open')) }
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
