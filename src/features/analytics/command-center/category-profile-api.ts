/**
 * The category profile's server calls (oms 949; BO 4178, unbuilt — the shape is `@/core/models/command-center`'s
 * proposal). Through `@/core/api` (`.claude/rules/api-envelope.md`). The read and the export take the same query, so the
 * workbook holds the figures the page shows; the workbook is the server's `.xlsx` through `api.blob`, never built here.
 */
import { api, type FileResponse } from '@/core/api'
import type { CcCategoryProfile } from '@/core/models/command-center'
import { CC_KEYS } from './api'
import { categoryProfileParams, type CategoryProfileRequest } from './category-profile'

export const categoryProfileApi = {
  /** `GET CommandCenter/CategoryProfile` — one category at one depth, narrowed, in the asked language. */
  read: (request: CategoryProfileRequest): Promise<CcCategoryProfile> =>
    api.get<CcCategoryProfile>('CommandCenter/CategoryProfile', categoryProfileParams(request)),
  /** `GET CommandCenter/CategoryProfile/Export` — one sheet per section, the same figures and labels (BO 4178). */
  export: (request: CategoryProfileRequest): Promise<FileResponse> =>
    api.blob('CommandCenter/CategoryProfile/Export', categoryProfileParams(request)),
}

/** The page's query: one answer per category, depth, narrowing, period and language. */
export const categoryProfileQuery = (request: CategoryProfileRequest) => ({
  queryKey: [...CC_KEYS.all, 'category', categoryProfileParams(request)] as const,
  queryFn: () => categoryProfileApi.read(request),
  retry: false,
})

/** The file name when the server sends none. */
export const categoryExportName = (request: CategoryProfileRequest): string => `category-profile_${request.level}_${request.code}.xlsx`
