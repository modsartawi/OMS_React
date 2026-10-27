/**
 * The change-log reads (BackOffice spec 3148 stories 49-53, ticket 3152; doors on `SdDocTypeConfigWebEndpoints`). All
 * need the existing OMS access only — no configuration grant — so every reader of the configuration can see why it is
 * as it is. Refusals: `SDC-00030` (From after To), `SDC-00031` (an export past the server's row cap).
 *
 * 🔑 A History tab takes its rows from a query factory, so a delivery type, a category or a source (3154–3156) mounts
 * the same `HistoryTab` by passing its own door's factory — the tab knows nothing of the kind of thing.
 */
import { api, type FileResponse } from '@/core/api'
import { DOC_TYPE_CONFIG_KEY } from './api'
import type { ConfigChangeFilter, ConfigChangePage, ConfigChangeRow } from './change-log-types'
import { configChangeParams } from './config-changes-filter'

const BASE = 'SdDocTypeConfigWeb'

export const CONFIG_CHANGE_ERRORS = {
  invalidDateRange: 'SDC-00030',
  exportTooLarge: 'SDC-00031',
} as const

export const changeLogApi = {
  /** `GET SdDocTypeConfigWeb/DocumentTypes/{code}/History` — the type's own and child rows, newest first. */
  documentTypeHistory(code: string): Promise<ConfigChangeRow[]> {
    return api.get<ConfigChangeRow[]>(`${BASE}/DocumentTypes/${encodeURIComponent(code)}/History`)
  },

  /** `GET SdDocTypeConfigWeb/ConfigChanges` — one page of the filtered log, with the total. */
  configChanges(filter: ConfigChangeFilter, page: number, pageSize: number): Promise<ConfigChangePage> {
    return api.get<ConfigChangePage>(`${BASE}/ConfigChanges`, { ...configChangeParams(filter), page, pageSize })
  },

  /** `GET SdDocTypeConfigWeb/ConfigChanges/Export` — every row the filter matches (no paging), as .xlsx. */
  exportConfigChanges(filter: ConfigChangeFilter): Promise<FileResponse> {
    return api.blob(`${BASE}/ConfigChanges/Export`, configChangeParams(filter))
  },
}

/** Every change-log read sits under this prefix. */
export const CHANGE_LOG_KEY = [...DOC_TYPE_CONFIG_KEY, 'change-log'] as const

/** What a History tab reads: any factory of this shape (one per kind of thing). */
export interface HistoryQuery {
  queryKey: readonly unknown[]
  queryFn: () => Promise<ConfigChangeRow[]>
  retry: false
}

/** A document type's History (its own rows and its item-category / plant-network rows). */
export function documentTypeHistoryQuery(code: string): HistoryQuery {
  return {
    queryKey: [...CHANGE_LOG_KEY, 'DocumentType', code] as const,
    queryFn: () => changeLogApi.documentTypeHistory(code),
    retry: false,
  }
}

export const CONFIG_CHANGES_PAGE_SIZE = 50

export function configChangesQuery(filter: ConfigChangeFilter, page: number) {
  return {
    queryKey: [...CHANGE_LOG_KEY, 'all', filter, page] as const,
    queryFn: () => changeLogApi.configChanges(filter, page, CONFIG_CHANGES_PAGE_SIZE),
    retry: false,
  } as const
}
