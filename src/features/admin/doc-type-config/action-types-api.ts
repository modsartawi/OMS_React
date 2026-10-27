/**
 * The action-type doors (BackOffice spec 3148, ticket 3155; `SdDocTypeConfigWebEndpoints`). Reads need the existing OMS
 * access only; the save also needs `BackOfficeScreen[SdDocTypeConfig,06]` (a bare 403 without it). Refusals: the shared
 * `SDC-00002/3/4/5` (reason, locked field, stale before-state, missing before/after) and `ACTION_TYPE_ERRORS`.
 *
 * ⚠️ BackOffice 3155 is built on `spec3148`, not deployed: `tools/action-types-drive.mjs` stubs every call in the shapes
 * of `SdDocTypeConfigAdminModels.ActionTypes.cs`.
 */
import { api } from '@/core/api'
import { DOC_TYPE_CONFIG_KEY } from './api'
import { CHANGE_LOG_KEY, type HistoryQuery } from './change-log-api'
import type { ConfigChangeRow } from './change-log-types'
import type { ActionTypeCategory, ActionTypeSettings, ActionTypeUpdateRequest } from './action-type-types'

const BASE = 'SdDocTypeConfigWeb'
const category = (c: string) => `${BASE}/ActionTypeCategories/${encodeURIComponent(c)}`

/** `SdDocTypeConfigErrorCodes`, block 60-69. */
export const ACTION_TYPE_ERRORS = {
  unknownActionType: 'SDC-00060',
  descriptionInvalid: 'SDC-00061',
} as const

export const actionTypesApi = {
  /** `GET SdDocTypeConfigWeb/ActionTypeCategories` — the categories that hold action types. */
  categories(): Promise<string[]> {
    return api.get<string[]>(`${BASE}/ActionTypeCategories`)
  },

  /** `GET SdDocTypeConfigWeb/ActionTypeCategories/{category}` — its action types and every type an edit reaches. */
  category(code: string): Promise<ActionTypeCategory> {
    return api.get<ActionTypeCategory>(category(code))
  },

  /** `GET SdDocTypeConfigWeb/ActionTypeCategories/{category}/History` — its action types' log rows, newest first. */
  history(code: string): Promise<ConfigChangeRow[]> {
    return api.get<ConfigChangeRow[]>(`${category(code)}/History`)
  },

  /** `PUT SdDocTypeConfigWeb/ActionTypes/{actionType}` `{ before, after, reason }` — answers the saved action type. */
  update(actionType: string, body: ActionTypeUpdateRequest): Promise<ActionTypeSettings> {
    return api.put<ActionTypeSettings>(`${BASE}/ActionTypes/${encodeURIComponent(actionType)}`, body)
  },
}

export const ACTION_TYPES_KEY = [...DOC_TYPE_CONFIG_KEY, 'action-types'] as const

export function actionTypeCategoriesQuery() {
  return { queryKey: [...ACTION_TYPES_KEY, 'categories'] as const, queryFn: () => actionTypesApi.categories(), retry: false } as const
}

export function actionTypeCategoryQuery(code: string) {
  return { queryKey: [...ACTION_TYPES_KEY, 'category', code] as const, queryFn: () => actionTypesApi.category(code), retry: false } as const
}

/** A category's History tab (the shared `HistoryTab`). */
export function actionTypeCategoryHistoryQuery(code: string): HistoryQuery {
  return {
    queryKey: [...CHANGE_LOG_KEY, 'ActionType', code] as const,
    queryFn: () => actionTypesApi.history(code),
    retry: false,
  }
}
