/**
 * Delivery document types (BackOffice spec 3148 stories 33-37, ticket 3154; doors on `SdDocTypeConfigWebEndpoints`):
 * the list, one type, its courier assignments (read-only — a copy carries them), its History, the edit and the copy.
 * Reads need the existing OMS access only; the edit and the copy also need `BackOfficeScreen[SdDocTypeConfig,06]` (a
 * bare 403 without it). Refusals: `SDC-00050..53` here, plus the shared `SDC-00002/03/04/10` and the copy's
 * `SDC-00040..42`. Kept beside `api.ts` (not in it) so the 3148 slices built in parallel each own their own file.
 *
 * ⚠️ Not deployed: `tools/delivery-types-drive.mjs` stubs every call in the shapes of
 * `SdDocTypeConfigAdminModels.DeliveryTypes.cs`.
 */
import { api } from '@/core/api'
import { DOC_TYPE_CONFIG_KEY } from './api'
import { CHANGE_LOG_KEY, type HistoryQuery } from './change-log-api'
import type { ConfigChangeRow } from './change-log-types'
import type {
  CourierAssignmentRow,
  DeliveryTypeCopyRequest,
  DeliveryTypeListRow,
  DeliveryTypeSettings,
  DeliveryTypeUpdateRequest,
} from './delivery-type-types'

const BASE = 'SdDocTypeConfigWeb/DeliveryDocumentTypes'
const one = (code: string) => `${BASE}/${encodeURIComponent(code)}`

/** The delivery type refusals (`SdDocTypeConfigErrorCodes`, SDC-00050..53). */
export const DELIVERY_TYPE_ERRORS = {
  unknownDeliveryType: 'SDC-00050',
  unknownDefaultDocumentType: 'SDC-00051',
  unknownServingList: 'SDC-00052',
  valueInvalid: 'SDC-00053',
} as const

export const deliveryTypesApi = {
  /** `GET …/DeliveryDocumentTypes` — every delivery type: code, description, category, competed. */
  list(): Promise<DeliveryTypeListRow[]> {
    return api.get<DeliveryTypeListRow[]>(BASE)
  },

  /** `GET …/DeliveryDocumentTypes/{code}` — every setting; `SDC-00050` for an unknown code. */
  get(code: string): Promise<DeliveryTypeSettings> {
    return api.get<DeliveryTypeSettings>(one(code))
  },

  /** `GET …/DeliveryDocumentTypes/{code}/CourierAssignments`. */
  courierAssignments(code: string): Promise<CourierAssignmentRow[]> {
    return api.get<CourierAssignmentRow[]>(`${one(code)}/CourierAssignments`)
  },

  /** `GET …/DeliveryDocumentTypes/{code}/History` — its own rows and its courier rows, newest first. */
  history(code: string): Promise<ConfigChangeRow[]> {
    return api.get<ConfigChangeRow[]>(`${one(code)}/History`)
  },

  /** `PUT …/DeliveryDocumentTypes/{code}` `{ before, after, reason }` — answers the saved settings. */
  update(code: string, body: DeliveryTypeUpdateRequest): Promise<DeliveryTypeSettings> {
    return api.put<DeliveryTypeSettings>(one(code), body)
  },

  /** `POST …/DeliveryDocumentTypes/{source}/Copy` `{ after, reason }` — answers the new type's settings. */
  copy(source: string, body: DeliveryTypeCopyRequest): Promise<DeliveryTypeSettings> {
    return api.post<DeliveryTypeSettings>(`${one(source)}/Copy`, body)
  },
}

/** Every delivery type read sits under this prefix; a save invalidates what it changed. */
export const DELIVERY_TYPES_KEY = [...DOC_TYPE_CONFIG_KEY, 'delivery-types'] as const

/** The list — also the document type form's default-delivery-type choices (story 36). */
export function deliveryTypesQuery() {
  return { queryKey: DELIVERY_TYPES_KEY, queryFn: () => deliveryTypesApi.list(), retry: false } as const
}

export function deliveryTypeQuery(code: string) {
  return { queryKey: [...DELIVERY_TYPES_KEY, code] as const, queryFn: () => deliveryTypesApi.get(code), retry: false } as const
}

export function courierAssignmentsQuery(code: string) {
  return {
    queryKey: [...DELIVERY_TYPES_KEY, code, 'couriers'] as const,
    queryFn: () => deliveryTypesApi.courierAssignments(code),
    retry: false,
  } as const
}

/** A delivery type's History (3152's tab, its own door). */
export function deliveryTypeHistoryQuery(code: string): HistoryQuery {
  return {
    queryKey: [...CHANGE_LOG_KEY, 'DeliveryDocumentType', code] as const,
    queryFn: () => deliveryTypesApi.history(code),
    retry: false,
  }
}
