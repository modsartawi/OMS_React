/**
 * Saved views of the Deliveries list (ticket 400, spec 380 L3, L4, L5; ruling 366). The
 * schema-free half — names, columns, filters, drift, the lifecycle, the storage edge — is
 * `@/core/list/saved-view-store` (graduated at ticket 786, when the Order / ERX list became its
 * second reader). This file binds the Deliveries half: its storage key, how its 14 criteria are
 * read back, its lenses, and the Angular app's old layout-only views.
 *
 * - **The old layout-only views** (`oms-web.delivery-grid-views`, shared with the Angular app)
 *   are imported **once** into the signed-in user's store as **layout-only** views: no criteria,
 *   lens All. 🚩 **The old key is only ever read** — never written, never removed.
 */
import { isPlainObject as isRecord } from '@/core/util/plain-object'
import {
  savedViewStore,
  type InMemorySearch as CoreInMemorySearch,
  type RemovedView as CoreRemovedView,
  type SavedView as CoreSavedView,
  type ViewResult as CoreViewResult,
  type ViewSnapshot as CoreViewSnapshot,
  type ViewStore as CoreViewStore,
} from '@/core/list/saved-view-store'
import { dateEntryOf } from '@/core/list/relative-date'
import { LENS_IDS, type LensId } from './lenses'
import { BLANK_QUERY, pendingDiff, type QueryCriteria } from './query-model'

export {
  defaultView,
  deleteView,
  nameTaken,
  newViewId,
  parseLegacyViews,
  renameView,
  restoreView,
  toggleDefault,
  VIEW_NAME_MAX,
  type LegacyLayout,
  type NameRefusal,
  type ViewDrift,
  type ViewLayout,
  type ViewStorage,
} from '@/core/list/saved-view-store'

export type SavedView = CoreSavedView<QueryCriteria, LensId>
export type ViewStore = CoreViewStore<QueryCriteria, LensId>
export type ViewSnapshot = CoreViewSnapshot<QueryCriteria, LensId>
export type ViewResult = CoreViewResult<QueryCriteria, LensId>
export type RemovedView = CoreRemovedView<QueryCriteria, LensId>
export type InMemorySearch = CoreInMemorySearch<QueryCriteria>

/** The Angular app's shared, layout-only views. Read once per user; never written or removed. */
export const LEGACY_VIEWS_KEY = 'oms-web.delivery-grid-views'

/** One user's store. Versioned, so a future shape can start clean. */
export const viewStorageKey = (userId: string) => `oms.deliveries.views.v1:${userId}`

const TEXT_FIELDS = [
  'deliveryNo',
  'documentNo',
  'orderNo',
  'customerPhone',
  'storeCode',
  'documentType',
  'documentSource',
  'deliveryDocumentType',
  'deliveryType',
  'documentReason',
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
  query.isExpress = typeof value.isExpress === 'boolean' ? value.isExpress : null
  return query
}

const store = savedViewStore<QueryCriteria, LensId>({
  storageKey: viewStorageKey,
  queryOf,
  lensIds: LENS_IDS,
  defaultLens: 'all',
  pendingCount: (draft, base) => pendingDiff(draft, base).count,
  legacyKey: LEGACY_VIEWS_KEY,
})

export const EMPTY_VIEW_STORE: ViewStore = store.emptyStore
export const {
  parseViewStore,
  serializeViewStore,
  importLegacy,
  writeViewStore,
  readViewStore,
  saveView,
  updateView,
  viewDrift,
  isDrifted,
  opensOnDefault,
} = store
