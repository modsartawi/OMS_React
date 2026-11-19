/**
 * The Mini POS assignments screen's pure half (oms 915, BackOffice 4043): the add form's checks, the server's refusal read
 * back into words (an overlap names the clashing row), and today's view grouped by pharmacy. The server decides; these
 * only stop an add the server would refuse for a reason the form can already see, and say a refusal plainly.
 */
import { apiErrorCode, apiErrorData } from '@/core/api'
import { MINI_POS_ERRORS, type MiniPosAssignment, type MiniPosAssignmentRequest } from '@/core/models/mini-pos'

/** The add form as typed. Dates are `yyyy-MM-dd` (the date input's own value), hours as typed. */
export interface AssignmentDraft {
  promoterLoginId: string
  promoterStaffId: string
  storeCode: string
  fromDate: string
  toDate: string
  hours: string
}

export const EMPTY_DRAFT = (today: string): AssignmentDraft => ({
  promoterLoginId: '',
  promoterStaffId: '',
  storeCode: '',
  fromDate: today,
  toDate: today,
  hours: '',
})

/** The most hours a day the form takes (a day has 24; the server keeps its own check). */
export const MAX_HOURS = 24

/** Why the draft cannot be sent yet, as an i18n key under `add.problem`, or null when it can. */
export type DraftProblem = 'promoter' | 'store' | 'dates' | 'past' | 'order' | 'hours'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The first thing wrong with the draft, in the form's order, or null. `today` is the local `yyyy-MM-dd` (rows start today
 * or later — the server refuses `MINIPOS_ASSIGNMENT_PAST` too). ISO days compare as strings.
 */
export function draftProblem(draft: AssignmentDraft, today: string): DraftProblem | null {
  if (!draft.promoterLoginId.trim()) return 'promoter'
  if (!draft.storeCode.trim()) return 'store'
  if (!ISO_DAY.test(draft.fromDate) || !ISO_DAY.test(draft.toDate)) return 'dates'
  if (draft.fromDate < today) return 'past'
  if (draft.toDate < draft.fromDate) return 'order'
  const hours = Number(draft.hours)
  if (draft.hours.trim() === '' || !Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS) return 'hours'
  return null
}

/** The body the draft sends (trimmed; the store code upper-cased; an empty staff id left out). */
export function toRequest(draft: AssignmentDraft): MiniPosAssignmentRequest {
  const staff = draft.promoterStaffId.trim()
  return {
    promoterLoginId: draft.promoterLoginId.trim(),
    ...(staff ? { promoterStaffId: staff } : {}),
    storeCode: draft.storeCode.trim().toUpperCase(),
    fromDate: draft.fromDate,
    toDate: draft.toDate,
    plannedHoursPerDay: Number(draft.hours),
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The clashing row an overlap refusal carries in `data`, or null when the error is not an overlap or its `data` is not a
 * row. Only the fields the message names are required; the rest default.
 */
export function overlapOf(err: unknown): MiniPosAssignment | null {
  if (apiErrorCode(err) !== MINI_POS_ERRORS.assignmentOverlap) return null
  const data = apiErrorData(err)
  if (!isRecord(data)) return null
  const text = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '')
  if (!text('storeCode') || !text('fromDate') || !text('toDate')) return null
  return {
    assignmentId: text('assignmentId'),
    promoterLoginId: text('promoterLoginId'),
    promoterStaffId: text('promoterStaffId'),
    promoterName: text('promoterName'),
    storeCode: text('storeCode'),
    fromDate: text('fromDate'),
    toDate: text('toDate'),
    plannedHoursPerDay: typeof data.plannedHoursPerDay === 'number' ? data.plannedHoursPerDay : 0,
    enteredBy: text('enteredBy'),
    enteredAt: text('enteredAt'),
    endedBy: typeof data.endedBy === 'string' ? data.endedBy : null,
    endedAt: typeof data.endedAt === 'string' ? data.endedAt : null,
  }
}

/** The refusal codes the screen words itself (`refusal.<key>`); any other code shows the server's own sentence. */
const REFUSAL_KEYS: Record<string, string> = {
  [MINI_POS_ERRORS.assignmentPast]: 'past',
  [MINI_POS_ERRORS.promoterUnknown]: 'promoterUnknown',
  [MINI_POS_ERRORS.storeNotEnabled]: 'storeNotEnabled',
  [MINI_POS_ERRORS.assignmentNotFound]: 'notFound',
  [MINI_POS_ERRORS.assignmentEnded]: 'ended',
}

/** The `refusal.*` key for a coded refusal the screen words, or null (show the server's message). */
export function refusalKey(err: unknown): string | null {
  const code = apiErrorCode(err)
  return code ? (REFUSAL_KEYS[code] ?? null) : null
}

/** The calendar day of a wire date (`2026-11-19T00:00:00` → `2026-11-19`). */
export const dayOf = (value: string | null | undefined): string => (value ?? '').slice(0, 10)

/** Whether the row has been ended. */
export const isEnded = (row: MiniPosAssignment): boolean => !!row.endedAt

/** Whether "End" is offered on the row: not ended, and its last day is today or later (the server refuses a past row). */
export const canEndRow = (row: MiniPosAssignment, today: string): boolean => !isEnded(row) && dayOf(row.toDate) >= today

/** Today's view: one group per pharmacy, pharmacies and promoters in code order. */
export function todayByStore(rows: readonly MiniPosAssignment[]): { storeCode: string; rows: MiniPosAssignment[] }[] {
  const groups = new Map<string, MiniPosAssignment[]>()
  for (const row of rows) {
    const list = groups.get(row.storeCode) ?? []
    list.push(row)
    groups.set(row.storeCode, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([storeCode, list]) => ({
      storeCode,
      rows: [...list].sort((a, b) => a.promoterLoginId.localeCompare(b.promoterLoginId)),
    }))
}

/** The promoter's name, or their login id when the server knows no name. */
export const promoterLabel = (row: Pick<MiniPosAssignment, 'promoterName' | 'promoterLoginId'>): string =>
  row.promoterName.trim() || row.promoterLoginId
