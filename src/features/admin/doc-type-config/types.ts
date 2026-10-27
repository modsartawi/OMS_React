// Wire shapes for the document-type configuration doors (BackOffice spec 3148; door ticket 3149).
//
// 🚩 The ONE source is BackOffice `Sartawi.Retail.Data\Modules\Sd\DocTypeConfig\SdDocTypeConfigAdminModels.cs`
// (branch `spec3148`), field for field in the camelCase ASP.NET Core emits. Later 3148 slices (3150-3156) add their
// shapes here.

/** `GET SdDocTypeConfigWeb/Access` — cookie-only, not grant-gated; a check that throws reads false. */
export interface DocTypeConfigAccess {
  /** The existing OMS access (`BackOfficeScreen[DocumentList,03]`): the menu leaf, the `ScreenGate`, every read. */
  canViewDocTypeConfig: boolean
  /** The one configuration grant `BackOfficeScreen[SdDocTypeConfig,06]` (and OMS access): every write affordance. */
  canEditDocTypeConfig: boolean
}

/** `GET SdDocTypeConfigWeb/DocumentTypes` — one row per type, by code. */
export interface DocumentTypeListRow {
  documentType: string
  description: string
  documentCategory: string
  engineType: string
}

/**
 * `GET SdDocTypeConfigWeb/DocumentTypes/{code}` — every mapped setting of a type, by column name. Also the
 * `before` and `after` of a save. Code, category and engine are locked once the type exists.
 */
export interface DocumentTypeSettings {
  // identity
  documentType: string
  description: string
  documentCategory: string
  referenceDocumentCategory: string
  numberRangeNumber: string
  // customer
  customerDeterminationType: string
  defaultCustomer: string
  // credit customer
  isReceivableCustomer: boolean
  receivableCustomer: string
  insurancePayerCode: string
  // pricing
  engineType: string
  documentPricingProcedure: string
  promotionDetermination: boolean
  isAlternativePriceCapped: boolean
  // delivery
  defaultDeliveryType: string
  createDeliveryImmediately: string
  plantDeterminationType: string
  isCalculateDeliveryFees: boolean
  deliveryFees: number
  // billing
  orderRelatedBillingType: string
  deliveryRelatedBillingType: string
  createBillingImmediately: string
  // picking
  isPickedOnOrder: boolean
  isDeterminePickingFees: boolean
  // notifications
  notifyOnCreation: string
  // controls
  controlType: string
  validateItem: boolean
  preOrderMaterialOnly: boolean
  checkOrderNo: boolean
  canChangeItems: boolean
  autoClose: boolean
  diagnosisRequired: boolean
  approvalProcess: boolean
  acceptanceRequired: boolean
}

export type DocumentTypeField = keyof DocumentTypeSettings

/** `PUT SdDocTypeConfigWeb/DocumentTypes/{code}` — answers the saved `DocumentTypeSettings`. */
export interface DocumentTypeUpdateRequest {
  before: DocumentTypeSettings
  after: DocumentTypeSettings
  reason: string
}

// ── 3151: a type's item-category assignment and plant network rows ─────────────────────────────────────────────

/** `GET SdDocTypeConfigWeb/DocumentTypes/{code}/ItemCategoryAssignments` — key: type + group + usage. */
export interface ItemCategoryAssignmentRow {
  documentType: string
  itemCategoryGroup: string
  itemUsage: string
  defaultItemCategory: string
  manualItemCategory1: string
  manualItemCategory2: string
  manualItemCategory3: string
  manualItemCategory4: string
}

/** `GET SdDocTypeConfigWeb/DocumentTypes/{code}/PlantNetworks` — key: type + network. */
export interface PlantNetworkRow {
  documentType: string
  plantNetworkId: string
  plantCode: string
}

/** An add (`after`), change (`before` + `after`) or remove (`before`) of a child row; every one carries a reason. */
export interface ChildRowChangeRequest<R> {
  before?: R
  after?: R
  reason: string
}

/** `GET SdDocTypeConfigWeb/ItemCategories` — the item categories an assignment may name. */
export interface ItemCategoryOption {
  itemCategory: string
  description: string
}
