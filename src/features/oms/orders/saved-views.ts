/**
 * Saved views of the Order / ERX list (ticket 786): the operator's own named views, per user in
 * `localStorage`. The schema-free half — names, columns, filters, drift, the lifecycle, the
 * storage edge — is `@/core/list/saved-view-store`, shared with the Deliveries list. This file
 * binds the order half: its storage key, how its criteria are read back, its lenses. There is no
 * legacy layout to import.
 *
 * 🚩 The Date is stored as the relative entry itself ("Last 3 days"), resolved only when the
 * view's search runs — so a view saved today still means the last three days tomorrow.
 */
import {
  isRecord,
  savedViewStore,
  type InMemorySearch as CoreInMemorySearch,
  type SavedView as CoreSavedView,
  type ViewSnapshot as CoreViewSnapshot,
  type ViewStore as CoreViewStore,
} from '@/core/list/saved-view-store'
import { dateEntryOf } from '@/core/list/relative-date'
import { LENS_IDS, type LensId } from './lenses'
import { BLANK_QUERY, MONEY_SOURCES, pendingDiff, type QueryCriteria } from './query-model'

export {
  defaultView,
  deleteView,
  nameTaken,
  newViewId,
  renameView,
  restoreView,
  toggleDefault,
  VIEW_NAME_MAX,
  type NameRefusal,
  type ViewLayout,
} from '@/core/list/saved-view-store'

export type SavedView = CoreSavedView<QueryCriteria, LensId>
export type ViewStore = CoreViewStore<QueryCriteria, LensId>
export type ViewSnapshot = CoreViewSnapshot<QueryCriteria, LensId>
export type InMemorySearch = CoreInMemorySearch<QueryCriteria>

/** One user's store. Versioned, so a future shape can start clean. */
export const viewStorageKey = (userId: string) => `oms.orders.views.v1:${userId}`

const TEXT_FIELDS = [
  'orderNo',
  'documentNo',
  'approval',
  'patientId',
  'mobile',
  'memberId',
  'documentSource',
  'storeCode',
  'documentType',
  'status',
] as const satisfies readonly (keyof QueryCriteria)[]

/** The criteria rebuilt field by field: a field of the wrong type is no filter. */
function queryOf(value: unknown): QueryCriteria | null {
  if (!isRecord(value)) return null
  const query: QueryCriteria = { ...BLANK_QUERY, date: dateEntryOf(value.date) }
  for (const field of TEXT_FIELDS) {
    const text = value[field]
    query[field] = typeof text === 'string' && text.trim() ? text : null
  }
  const limit = value.limit
  query.limit = typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? limit : BLANK_QUERY.limit
  query.hasDelivery = typeof value.hasDelivery === 'boolean' ? value.hasDelivery : null
  query.moneySource = MONEY_SOURCES.includes(value.moneySource as never) ? (value.moneySource as QueryCriteria['moneySource']) : null
  return query
}

const store = savedViewStore<QueryCriteria, LensId>({
  storageKey: viewStorageKey,
  queryOf,
  lensIds: LENS_IDS,
  defaultLens: 'all',
  pendingCount: (draft, base) => pendingDiff(draft, base).count,
})

export const EMPTY_VIEW_STORE: ViewStore = store.emptyStore
export const {
  parseViewStore,
  serializeViewStore,
  writeViewStore,
  readViewStore,
  saveView,
  updateView,
  isDrifted,
  opensOnDefault,
} = store
