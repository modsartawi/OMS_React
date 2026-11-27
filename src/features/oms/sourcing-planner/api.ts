/**
 * The planner-data screens' server calls (ticket 968, BackOffice spec 4354 §19), through `@/core/api` (`api-envelope`):
 * the envelope, the error taxonomy and 401 are its. Reconciled with BackOffice at pricing2 35a4e56be — three families
 * of doors, each read and written in its own shape by `./wire`:
 * - `SourcingAdvisor/BufferOverrides` (+ `/Save`, `/End`) and `SourcingAdvisor/StoreConfidences` (+ `/Set`, `/End`), BO 4375;
 * - `SourcingAdvisor/ProductRules` (+ `/Change`, `/Lists/Add`, `/Lists/Remove`), BO 4362;
 * - `SourcingAdvisor/PlannerTables` (+ `/History`, `/Save`, `/End`), BO 4361.
 * Every list under the simulator's run grant; every change under its family's grant.
 */
import { api } from '@/core/api'
import { endCall, historyCall, historyOf, readCall, rowsOf, saveCall, switchCall, versionsOf } from './wire'
import type { PlannerChange, PlannerRow, PlannerTableKey, PlannerValues } from './wire'

export const sourcingPlannerApi = {
  /** The tab's rows in force (and, asked, the ended ones, where its door lists them). */
  async rows(table: PlannerTableKey, withEnded: boolean): Promise<PlannerRow[]> {
    const call = readCall(table, withEnded)
    return rowsOf(table, await api.get<unknown>(call.path, call.params))
  },
  /** A row's versions (oldest first) and its changes (newest first): the history door, or the list with its ended rows. */
  async history(table: PlannerTableKey, row: PlannerRow): Promise<{ versions: PlannerRow[]; changes: PlannerChange[] }> {
    const door = historyCall(table, row)
    const versions = door
      ? rowsOf(table, await api.get<unknown>(door.path, door.params)).sort((a, b) => a.setAt.localeCompare(b.setAt))
      : versionsOf(table, await sourcingPlannerApi.rows(table, true), row)
    return { versions, changes: historyOf(table, versions) }
  },
  /** A new row (`row` null) or the row's next version. */
  save(table: PlannerTableKey, row: PlannerRow | null, values: PlannerValues, reason: string): Promise<unknown> {
    const call = saveCall(table, row, values, reason)
    return api.post<unknown>(call.path, call.body)
  },
  /** The row ended (a list entry taken off). A rule is never ended: it is switched off. */
  end(table: PlannerTableKey, row: PlannerRow, reason: string): Promise<unknown> {
    const call = endCall(table, row, reason)
    if (!call) return Promise.reject(new Error(`a ${table} row is not ended`))
    return api.post<unknown>(call.path, call.body)
  },
  /** A rule's switch flipped. */
  switchRule(row: PlannerRow): Promise<unknown> {
    const call = switchCall(row)
    return api.post<unknown>(call.path, call.body)
  },
}

export const plannerKeys = {
  all: ['sourcing-planner'] as const,
  table: (table: PlannerTableKey) => ['sourcing-planner', 'table', table] as const,
  rows: (table: PlannerTableKey, withEnded: boolean) => ['sourcing-planner', 'table', table, 'rows', withEnded] as const,
  history: (table: PlannerTableKey, rowId: string) => ['sourcing-planner', 'table', table, 'history', rowId] as const,
}
