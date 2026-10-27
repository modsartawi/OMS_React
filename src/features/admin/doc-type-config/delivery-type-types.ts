// Wire shapes for the delivery document type doors (BackOffice spec 3148, ticket 3154) —
// `SdDocTypeConfigAdminModels.DeliveryTypes.cs` on branch `spec3148`, field for field in the camelCase ASP.NET Core
// emits. Kept apart from `types.ts` so the 3148 slices built in parallel each own their own file.

/** `GET SdDocTypeConfigWeb/DeliveryDocumentTypes` — one row per delivery type, by code. */
export interface DeliveryTypeListRow {
  documentType: string
  description: string
  /** D delivery, T delivery return. */
  documentCategory: string
  isCompeted: boolean
}

/**
 * `GET SdDocTypeConfigWeb/DeliveryDocumentTypes/{code}` — every setting of a delivery type, by column name. Also the
 * `before` and `after` of a save. Code and category are locked once the type exists.
 */
export interface DeliveryTypeSettings {
  // identity
  documentType: string
  description: string
  documentCategory: string
  numberRangeNumber: string
  /** '' none, else an OMS document type. */
  defaultDocumentType: string
  // callouts
  isCompeted: boolean
  calloutRadiusKm: number
  calloutStockCheck: boolean
  calloutLocksDelivery: boolean
  calloutLifetimeMinutes: number
  calloutDutyCheck: boolean
  /** '' every store, else a serving list id. */
  servingListId: string
}

export type DeliveryTypeField = keyof DeliveryTypeSettings

/** `PUT SdDocTypeConfigWeb/DeliveryDocumentTypes/{code}` — answers the saved settings. */
export interface DeliveryTypeUpdateRequest {
  before: DeliveryTypeSettings
  after: DeliveryTypeSettings
  reason: string
}

/** `POST SdDocTypeConfigWeb/DeliveryDocumentTypes/{source}/Copy` — the new code is `after.documentType`. */
export interface DeliveryTypeCopyRequest {
  after: DeliveryTypeSettings
  reason: string
}

/** `GET SdDocTypeConfigWeb/DeliveryDocumentTypes/{code}/CourierAssignments` — read-only; a copy carries them. */
export interface CourierAssignmentRow {
  documentType: string
  /** '' = every delivering plant. */
  deliveringPlant: string
  courierCode: string
}
