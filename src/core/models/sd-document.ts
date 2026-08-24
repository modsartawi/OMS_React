/**
 * Screen 2 — Document Details models.
 *
 * Returned in the `data` field of the Screen 2 endpoints. C# `DateTime` maps to
 * an ISO 8601 `string`.
 *
 * ⚠ Unlike the Screen 1 LIST endpoint — which resolves its coded columns
 * server-side and returns descriptions (why the Screen 1 code resolver was
 * deleted under 406) — these endpoints return RAW codes with a separate
 * `*Description` companion. Verified against the live API: `Document/1000000393`
 * comes back with `documentCategory: 'O'`, `deliveryType: 'P'`,
 * `documentType: 'CLCN'` + `documentTypeDescription: 'Call Center'`. Every
 * code-keyed rule on this screen (the actionType matrix, the Change Store mode,
 * the BB return gate) depends on that, so do NOT assume list semantics here.
 */

/** A postal address — shipping or billing. */
export interface SdDocumentAddressModel {
  addressNumber: string
  name1: string
  name2: string
  cityCode: string
  cityName: string
  districtCode: string
  districtName: string
  postalCode: string
  poBox: string
  street1: string
  street2: string
  buildingNumber: string
  phone1: string
  gpsLat: number
  gpsLon: number
  customerId: string
  shortAddress: string
}

/**
 * The document's status breakdown.
 *
 * Each coded `*Status` is paired with a `*StatusDescription` — except
 * `consignmentStatus`, `controlStatus` and `notificationStatus`, which have no
 * companion and render as raw codes.
 */
export interface SdDocumentHeaderStatusModel {
  overallStatus: string
  lastAction: string
  lastActionDescription: string
  readyStatus: string
  readyStatusDescription: string
  closeStatus: string
  closeStatusDescription: string
  clearStatus: string
  clearStatusDescription: string
  paymentStatus: string
  paymentStatusDescription: string
  deliveryStatus: string
  deliveryStatusDescription: string
  availabilityStatus: string
  availabilityStatusDescription: string
  acceptanceStatus: string
  acceptanceStatusDescription: string
  approvalStatus: string
  approvalStatusDescription: string
  consignmentStatus: string // no description companion
  controlStatus: string // no description companion
  notificationStatus: string // no description companion
}

/** The loyalty customer behind a document. */
export interface SdDocumentCustomerModel {
  customerId: string
  customerPhone: string
  customerName: string
  firstName: string
  secondName: string
  thirdName: string
  lastName: string
  gender: string
  dateOfBirth: string
  nationalityCode: string
  memberId: string
  nationalIdNumber: string
  email: string
}

/** A single line item of a document — the Items tab. */
export interface SdDocumentLineModel {
  lineNumber: number
  itemNumber: string
  sfdaRegisterNumber: string
  itemDescription: string
  itemText: string
  itemCategory: string
  deliveryItem: boolean
  billingItem: boolean
  quantity: number
  uom: string
  numerator: number
  denominator: number
  baseQuantity: number
  baseUom: string
  customerItemNumber: string
  unitPrice: number
  discount: number
  grossAmount: number
  vatPercent: number
  vatAmount: number
  netAmount: number
  confirmedQuantity: number
  patientShare: number
  referenceDocument: string
  referenceLine: number
  relevantForGs1: boolean
  deleted: boolean
  needTransaction: boolean
  needTransactionQty: number
  approvalStatus: string
  denialCode: string
  denialDescription: string
  durationPerDay: number
  refills: number
  dispensedDate: string
  nextRefillDate: string
  referenceErxLine: string
  selectedMaterialNumber: string
  selectedQty: number
  selectedQtyUom: string
  selectedNetAmount: number
  selectedInstructions: string
  /**
   * How much of this line earlier returns have already taken back.
   *
   * ⚠ **Additive, optional, and not on the wire yet** — BackOffice spec 1283
   * §2b. Absent reads as *nothing returned*, which makes the whole line
   * remaining; the return command itself fails closed on `canReturn`, so an
   * absent field can never enable anything.
   */
  returnedQuantity?: number
  hasPickingFees: boolean
  pickingFees: number
}

/**
 * A pricing/payment/discount/tax/fee condition line.
 *
 * Header-level conditions — the Header Conditions tab — are the rows with
 * `condDocumentLine === 0`.
 */
export interface TransactionConditionModel {
  condDocumentNumber: string
  condDocumentLine: number // 0 = header-level
  stepNumber: number
  stepDescription: string
  condCounter: number
  condType: string // coded
  conditionDescription: string // server-resolved; preferred over the code map
  condDate: string
  calculationType: string
  condBaseValue: number
  condAmount: number
  condValue: number
  originOfCond: string
  fromStep: number
  toStep: number
  isPromotion: boolean
  condRecordNumber: string
  condQty: number
  condUom: string
  numerator: number
  denominator: number
  condCategory: string // coded — no description companion
  condForStatistics: boolean
  condIsActive: boolean
  referenceNumber: string
  referenceNumber2: string
  cardNumber: string
  cardType: string
  paymentMethod: string
  paymentType: string
  copyToRoutine: string
  deleted: boolean
}

/** A full document/delivery for Screen 2. */
export interface SdDocumentHeaderModel {
  documentNo: string
  orderNo: string
  refDocumentNo: string
  entryTime: string
  entryUser: string
  documentDate: string
  documentCategory: string // coded — 'D' Delivery; drives the Update/Reschedule endpoint
  /**
   * Whether a bonded return may be created against this delivery: a delivery,
   * on the Starlinks bonded rail, with something left to return — the server
   * folds all three into one flag (BackOffice spec 1283 §2b).
   *
   * ⚠ **Additive, optional, and not on the wire yet.** Absent must read as
   * **not returnable**: the command fails closed, never open.
   */
  canReturn?: boolean
  documentType: string // coded
  documentTypeDescription: string
  documentSource: string // coded
  documentSourceDescription: string
  deliveryDocumentType: string // coded — the delivery rail; NOT the return gate (see canReturn)
  deliveryDocumentTypeDescription: string
  documentReason: string // coded
  netTotal: number
  paidAmount: number
  deliveryFees: number
  amountDue: number
  amountDueTamara: number
  pickingFees: number
  approvalNumber: string
  patientId: string
  statusHistory: string[]
  patienShare: number // computed (source spelling "Patien")
  deliveryDateTime: string
  deliveryType: string // coded — 'D' Delivery / 'P' PickInStore
  paymentType: string // coded
  validTo: string
  customerId: string
  isActiveInStore: boolean
  isUrgent: boolean
  condDocumentNumber: string
  changedOn: string
  storeCode: string
  zatcaQR: string
  note: string
  prescriptionUrl: string
  shippingAddress: SdDocumentAddressModel | null
  billingAddress: SdDocumentAddressModel | null
  lines: SdDocumentLineModel[]
  conditions: TransactionConditionModel[]
  status: SdDocumentHeaderStatusModel
  customer: SdDocumentCustomerModel
  deliveryScheduleFromTime: string
  deliveryScheduleToTime: string
  timeSlotId: string
  timeSlotDescription: string
  timeSlotDay: string
  estimateDeliveryTime: string
  courierCode: string // coded
  courierDriverId: string
  courierDriverName: string
  courierDriverPhone: string
  courierDriverMasterPinCode: string
  courierDriverApproved: boolean
  courierDeliveryRequestId: string
  trackingId: string
  trackingUrl: string
  originalReferenceErx: string
  referenceErx: string
  dispensedDate: string
  nextRefillDate: string
  approvalId: string
  qrCodeForKiosk: string
  clinicianName: string
  clinicianContact: string
  diagnosis: string
  payerCode: string // coded
  isRefundRequired: boolean
  lastMileControl: string // coded
  isExpressDelivery: boolean
  expressCourierId: string
}

/** An audit-log entry — the Log tab. */
export interface SdDocumentLogModel {
  logNo: string
  documentNo: string
  entryTime: string
  entryUser: string
  actionType: string
  actionTypeDescription: string
  actionData: string
  actionOldData: string
  note: string
  staffId: string
  storeCode: string
}

/**
 * Request body for `UpdateDocument` / `UpdateDelivery`.
 *
 * Every simple action sends `documentNo`, `actionType` and `note`; Change Store
 * additionally sends `actionData` / `actionData2`. The `actionType` is a
 * 4-letter code chosen by the document category.
 */
export interface UpdateSdDocumentHeader {
  documentNo: string
  actionType: string // e.g. "DADN", "OCLS", "DFCL"
  note?: string
  actionData?: string // e.g. new store code (Change Store)
  actionData2?: string // e.g. shipping city (Change Store)
}

/** A background (outbox) job — the Jobs tab. */
export interface SdDocumentOutboxModel {
  outboxId: string
  actionType: string
  actionTypeDescription: string
  documentNo: string
  documentCategory: string
  userId: string
  entryTime: string
  attemptCount: number
  lastAttemptTime: string
  nextAttemptTime: string
  outboxStatus: string // 'P' Pending, 'F' Failed, 'C' Completed
  errorMessage: string
}
