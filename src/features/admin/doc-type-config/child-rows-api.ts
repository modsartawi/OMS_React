/**
 * A document type's child-row doors (BackOffice spec 3148, ticket 3151, `SdDocTypeConfigWebEndpoints`): its
 * item-category assignment rows and plant network rows, and the choices they are picked from. Reads need the existing
 * OMS access; every write also needs `BackOfficeScreen[SdDocTypeConfig,06]` (a bare 403 without it). Rows are keyed in
 * the BODY (`before` / `after`), never the route — their keys are often blank. Kept beside `api.ts` (not in it) so the
 * 3148 slices built in parallel each own their own file.
 *
 * ⚠️ Not deployed: `tools/doc-type-child-rows-drive.mjs` stubs every call in the shapes of
 * `SdDocTypeConfigAdminModels.ChildRows.cs`.
 */
import { api } from '@/core/api'
import { DOC_TYPE_CONFIG_KEY } from './api'
import type { ChildRowSpec } from './child-rows'
import type { ChildRowChangeRequest, ItemCategoryOption } from './types'

const BASE = 'SdDocTypeConfigWeb'
type ChildRowsId = ChildRowSpec<{ documentType: string }>['id']
const SEGMENT: Record<ChildRowsId, string> = { itemCategoryAssignments: 'ItemCategoryAssignments', plantNetworks: 'PlantNetworks' }
const rows = (id: ChildRowsId, code: string) => `${BASE}/DocumentTypes/${encodeURIComponent(code)}/${SEGMENT[id]}`

/** The server's child-row refusals (`SdDocTypeConfigErrorCodes`, SDC-00020..28). */
export const CHILD_ROW_ERRORS = {
  unknownItemCategory: 'SDC-00020',
  duplicateItemCategoryAssignment: 'SDC-00021',
  itemCategoryAssignmentNotFound: 'SDC-00022',
  unknownPlantNetwork: 'SDC-00023',
  unknownPlant: 'SDC-00024',
  duplicatePlantNetwork: 'SDC-00025',
  plantNetworkNotFound: 'SDC-00026',
  keyLocked: 'SDC-00027',
  valueTooLong: 'SDC-00028',
} as const

/** A refusal that means the table on screen is out of date: re-read it. */
export const CHILD_ROW_STALE_CODES: readonly string[] = [
  'SDC-00004',
  CHILD_ROW_ERRORS.itemCategoryAssignmentNotFound,
  CHILD_ROW_ERRORS.plantNetworkNotFound,
  CHILD_ROW_ERRORS.duplicateItemCategoryAssignment,
  CHILD_ROW_ERRORS.duplicatePlantNetwork,
]

export const childRowsApi = {
  /** `GET …/DocumentTypes/{code}/ItemCategoryAssignments` or `/PlantNetworks` — the type's rows. */
  list<R>(id: ChildRowsId, code: string): Promise<R[]> {
    return api.get<R[]>(rows(id, code))
  },
  /** `POST …/{rows}` `{ after, reason }` — answers the saved row. */
  add<R>(id: ChildRowsId, code: string, body: ChildRowChangeRequest<R>): Promise<R> {
    return api.post<R>(rows(id, code), body)
  },
  /** `PUT …/{rows}` `{ before, after, reason }` — the key is locked; answers the saved row. */
  update<R>(id: ChildRowsId, code: string, body: ChildRowChangeRequest<R>): Promise<R> {
    return api.put<R>(rows(id, code), body)
  },
  /** `POST …/{rows}/Remove` `{ before, reason }` — the log keeps the removed row. */
  remove<R>(id: ChildRowsId, code: string, body: ChildRowChangeRequest<R>): Promise<boolean> {
    return api.post<boolean>(`${rows(id, code)}/Remove`, body)
  },
  /** `GET SdDocTypeConfigWeb/ItemCategories` — the item categories an assignment may name. */
  itemCategories(): Promise<ItemCategoryOption[]> {
    return api.get<ItemCategoryOption[]>(`${BASE}/ItemCategories`)
  },
  /** `GET SdDocTypeConfigWeb/PlantNetworkIds` — the networks stores belong to (there is no network master). */
  plantNetworkIds(): Promise<string[]> {
    return api.get<string[]>(`${BASE}/PlantNetworkIds`)
  },
}

export const CHILD_ROWS_KEY = [...DOC_TYPE_CONFIG_KEY, 'child-rows'] as const

export function childRowsQuery<R>(id: ChildRowsId, code: string) {
  return { queryKey: [...CHILD_ROWS_KEY, id, code] as const, queryFn: () => childRowsApi.list<R>(id, code), retry: false } as const
}

export function itemCategoriesQuery() {
  return { queryKey: [...CHILD_ROWS_KEY, 'item-categories'] as const, queryFn: () => childRowsApi.itemCategories(), retry: false, staleTime: 300_000 } as const
}

export function plantNetworkIdsQuery() {
  return { queryKey: [...CHILD_ROWS_KEY, 'plant-network-ids'] as const, queryFn: () => childRowsApi.plantNetworkIds(), retry: false, staleTime: 300_000 } as const
}
