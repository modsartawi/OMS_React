/**
 * The History tab's filters and its "Show more" (oms ticket 571, BackOffice spec 3042 — door
 * `GET ServingListWeb/Lists/{id}/Changes?take=`). Pure, pinned by `history-filter.test.ts`.
 *
 * The filters are client-side, over the rows the door sent (newest first, kept in that order):
 * - `action` — one wire action, or '' for any;
 * - `store` — one store code, matched exactly after trimming, ignoring case ("who took store X off, and when").
 *
 * The door has no cursor: "Show more" asks again with a larger `take`, 200 at a time up to the door's 1000.
 */
import { SERVING_LIST_CHANGE_ACTIONS, type ServingListChangeRow } from '@/core/models/serving-list'

/** The door's default `take`, and the step "Show more" raises it by. */
export const CHANGES_TAKE = 200
/** The door clamps `take` to 1..1000. */
export const CHANGES_MAX_TAKE = 1000

export interface ChangesFilter {
  action: string
  store: string
}

export const EMPTY_CHANGES_FILTER: ChangesFilter = { action: '', store: '' }

export function filterChanges(rows: readonly ServingListChangeRow[], f: ChangesFilter): ServingListChangeRow[] {
  const store = f.store.trim().toUpperCase()
  return rows.filter((r) => (!f.action || r.action === f.action) && (!store || (r.storeCode ?? '').trim().toUpperCase() === store))
}

export function isFilteredChanges(f: ChangesFilter): boolean {
  return f.action !== '' || f.store.trim() !== ''
}

/** The known actions in the log's own order, then any action the rows carry that this screen does not know. */
export function actionOptions(rows: readonly ServingListChangeRow[]): string[] {
  const out: string[] = [...SERVING_LIST_CHANGE_ACTIONS]
  for (const r of rows) if (r.action && !out.includes(r.action)) out.push(r.action)
  return out
}

export function nextTake(take: number): number {
  return Math.min(take + CHANGES_TAKE, CHANGES_MAX_TAKE)
}

/** The door filled the page (so there may be older rows) and the maximum is not reached. */
export function canShowMore(rowCount: number, take: number): boolean {
  return rowCount >= take && take < CHANGES_MAX_TAKE
}
