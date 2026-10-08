// Wire shape for GET SdDocumentWeb/DocumentPayments (spec 430 D4, ticket 433) — BackOffice ask
// BO-3, NOT built yet. The rows are `DocumentPaymentModel` as the WPF Document Payment Inquiry reads
// it (`Sartawi.Retail.Data/Modules/Sd/Services/Models/DocumentPaymentList`), in the camelCase
// ASP.NET Core emits. Nothing here is invented beyond that class.
//
// 🚩 A row carries the customer's phone and name. The door is behind `DocumentPaymentInquiry,03`
// and the screen behind `canOpenDocumentPayments`, so neither is drawn without the grant.

/** One payment line of one document. */
export interface DocumentPaymentModel {
  documentNo: string
  orderNo: string
  documentDate: string
  /** The payment condition's code; `conditionTypeDescription` is its name (WPF's "Payment Type" column). */
  conditionType: string
  /** The amount, in `conditionRateUnit`. */
  conditionRate: number
  /** The amount's currency. */
  conditionRateUnit: string
  conditionTypeDescription: string
  documentType: string
  documentTypeDescription: string
  referenceNumber: string
  paymentMethod: string
  cardType: string
  paymentType: string
  storeCode: string
  customerPhone: string
  customerName: string
  deliveryType: string
  deliveryTypeDescription: string
  orderCloseStatus: string
  orderIsActiveInStore: boolean
  /** The delivery the order became; blank when it has none. */
  deliveryNo: string | null
  refDocumentNo: string
  deliveryStoreCode: string
  deliveryIsActiveInStore: boolean
  deliveryReadyStatus: string
  deliveryCloseStatus: string
  deliveryDeliveryStatus: string
  salesInvoice: string
  returnInvoice: string
  deliveryNote: string
}

/** `{ rows, limited }` — `limited` means the request's `Limit` cut the list. */
export interface DocumentPaymentListResponse {
  rows: DocumentPaymentModel[]
  limited: boolean
}
