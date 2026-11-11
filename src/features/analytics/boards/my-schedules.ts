import { apiErrorCode } from '@/core/api'
import { MY_SCHEDULES_PATH, reportHref } from '@/core/analytics-routes'
import type { AnalyticsItem, AnalyticsPersonalSchedule, AnalyticsScheduleCadence } from '@/core/models/analytics'
import { formatDateTime } from '@/core/util/date-format'
import { analyticsApi } from './api'
import { cadenceSummary } from './schedule'

/**
 * The "My schedules" page (ticket 886; BackOffice spec 3631 S24/S30, contract 3662), pure but for its one act: a row's
 * words, the five acts on their doors redrawn from the answer, the switch, and a personal report's read-only line.
 */

type T = (key: string, opts?: Record<string, unknown>) => string

/** Running, paused by the reader, or suspended by the worker (3661) — the last two send nothing. */
export type MyScheduleState = 'active' | 'paused' | 'suspended'

export interface MyScheduleRow {
  /** The days and time, as a schedule's cadence sentence (Riyadh time). */
  when: string
  /** `yyyy-MM-dd HH:mm`, or null: none while paused or suspended. */
  nextSend: string | null
  state: MyScheduleState
  /** Its report, which opens read only. */
  reportHref: string
}

export function myScheduleRow(s: AnalyticsPersonalSchedule, t: T): MyScheduleRow {
  const state: MyScheduleState = s.suspended ? 'suspended' : s.paused ? 'paused' : 'active'
  return {
    when: cadenceSummary(s, t),
    // The server sends none while paused or suspended; the state decides too, so a stale stamp is never drawn.
    nextSend: state === 'active' ? formatDateTime(s.nextSend) || null : null,
    state,
    reportHref: reportHref(s.reportId),
  }
}

/** An act on one schedule: each is its own door. */
export type MyScheduleAct =
  | { act: 'pause'; id: string }
  | { act: 'resume'; id: string }
  | { act: 'delete'; id: string }
  | { act: 'retime'; id: string; cadence: AnalyticsScheduleCadence; time: string }
  | { act: 'rename'; id: string; title: string }

/**
 * Takes the act on its door and answers the list redrawn: the row replaced by the server's answer, or gone after a
 * delete. A refusal is thrown as it came, and the list given is never changed.
 */
export async function actOnMySchedule(rows: readonly AnalyticsPersonalSchedule[], a: MyScheduleAct): Promise<AnalyticsPersonalSchedule[]> {
  if (a.act === 'delete') {
    await analyticsApi.deleteMySchedule(a.id)
    return rows.filter((r) => r.id !== a.id)
  }
  const answer = await answerOf(a)
  return rows.map((r) => (r.id === a.id ? answer : r))
}

function answerOf(a: Exclude<MyScheduleAct, { act: 'delete' }>): Promise<AnalyticsPersonalSchedule> {
  if (a.act === 'retime') return analyticsApi.retimeMySchedule(a.id, a.cadence, a.time)
  if (a.act === 'rename') return analyticsApi.renameMySchedule(a.id, a.title)
  return a.act === 'pause' ? analyticsApi.pauseMySchedule(a.id) : analyticsApi.resumeMySchedule(a.id)
}

/** `ANALYTICS-424`: the personal-schedules switch is off, and the page is not offered. */
export const mySchedulesOff = (err: unknown): boolean => apiErrorCode(err) === 'ANALYTICS-424'

/**
 * A report made for one of the caller's personal schedules (`personalScheduleId`, 3662): it opens read only — no edit,
 * share or schedule control — with a line saying it is sent to them on a schedule, linking My schedules. `null` for
 * any other item.
 */
export function personalReportOf(item: Pick<AnalyticsItem, 'personalScheduleId'>): { readOnly: true; scheduleId: string; href: string } | null {
  return item.personalScheduleId ? { readOnly: true, scheduleId: item.personalScheduleId, href: MY_SCHEDULES_PATH } : null
}
