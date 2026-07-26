/**
 * A single row of the Screen 1 results grid.
 * Returned in the `data` array of `GET SdDocumentWeb/DeliveryDocumentList`.
 * Fields marked "coded" carry raw codes resolved for display by the CodeResolver.
 */
export interface DeliveryDocumentModel {
  deliveryNo: string
  documentNo: string
  deliveryDocumentType: string // coded
  orderNo: string
  storeCode: string
  documentDate: string
  deliveryType: string // coded
  documentType: string // coded
  documentSource: string // coded
  entryTime: string
  isActiveInStore: boolean
  timeSlotDescription: string
  timeSlotDay: string
  deliveryScheduleFromTime: string
  deliveryScheduleToTime: string
  customerPhone: string
  customerName: string
  rescheduled: boolean
  rescheduledUser: string
  rescheduledTime: string
  rescheduledReason: string
  rescheduledReasonCategory: string // coded
  netTotal: number
  paidAmount: number
  deliveryFees: number
  amountDue: number
  courierCode: string // coded
  courierDriverId: string
  courierDriverName: string
  courierDriverPhone: string
  customerOtp: string
  lastAction: string // coded
  readyStatus: string // coded
  clearStatus: string // coded
  deliveryStatus: string // coded
  closeStatus: string // coded
  reasonDescription: string
  outForDeliveryTime: string
  actualDeliveryTime: string
  validTo: string
  cityName: string
  districtName: string
  street1: string
  note: string
  isExpressDelivery: boolean
  expressCourierId: string
  documentReason: string // coded
  /** Count of this delivery's outbox jobs with `OutboxStatus = 'F'` — the triage signal. */
  failedJobsCount: number
}
