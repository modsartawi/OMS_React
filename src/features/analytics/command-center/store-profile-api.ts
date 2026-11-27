/**
 * The store profile's server calls (oms 948; BO 4177, unbuilt — the shape is `@/core/models/command-center`'s
 * proposal). Through `@/core/api` (`.claude/rules/api-envelope.md`). The read and the export take the same query, so the
 * workbook holds the figures the page shows; the workbook is the server's `.xlsx` through `api.blob`, never built here.
 */
import { api, type FileResponse } from '@/core/api'
import type { CcStoreProfile } from '@/core/models/command-center'
import { CC_KEYS } from './api'
import { storeProfileParams, type StoreProfileRequest } from './store-profile'

export const storeProfileApi = {
  /** `GET CommandCenter/StoreProfile` — one pharmacy for one period, in the asked language. */
  read: (request: StoreProfileRequest): Promise<CcStoreProfile> => api.get<CcStoreProfile>('CommandCenter/StoreProfile', storeProfileParams(request)),
  /** `GET CommandCenter/StoreProfile/Export` — one sheet per section, the same figures and labels (BO 4177). */
  export: (request: StoreProfileRequest): Promise<FileResponse> => api.blob('CommandCenter/StoreProfile/Export', storeProfileParams(request)),
}

/** The page's query: one answer per pharmacy, period and language. */
export const storeProfileQuery = (request: StoreProfileRequest) => ({
  queryKey: [...CC_KEYS.all, 'store', storeProfileParams(request)] as const,
  queryFn: () => storeProfileApi.read(request),
  retry: false,
})

/** The file name when the server sends none: the pharmacy and the period. */
export const storeExportName = (request: StoreProfileRequest): string =>
  `store-profile_${request.storeCode}_${request.period === 'dates' ? `${request.from}_${request.to}` : request.period}.xlsx`
