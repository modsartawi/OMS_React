// Wire shapes for `Sd/CentralInvoice` (BackOffice spec 2094, ADR 0048, ticket 2099 —
// `CentralInvoiceWebEndpoints.cs`). Field casing is the camelCase ASP.NET Core emits.

/** `GET Sd/CentralInvoice/Access` → `{ canOpen }`. Cookie-only and NOT grant-gated: a
 *  session that holds nothing is answered `false` with a 200, never refused. */
export interface CentralInvoiceAccessResult {
  canOpen: boolean
}

/** The body of `POST Sd/CentralInvoice`. There is no actor field: the server reads the
 *  actor off the session, and a body field would be a way to name someone else. */
export interface CentralInvoiceRaiseRequest {
  deliveryNos: string[]
  reason: string
}

/**
 * One delivery's answer (`CentralInvoiceRaiseResult`). `verdict` is `accepted` / `wait` /
 * `refused` — the server's STABLE spellings — but typed `string` on purpose: a spelling
 * this client does not know must reach `verdictOf` and be shown as itself, not be read
 * as one of the three.
 */
export interface CentralInvoiceRaiseResult {
  deliveryNo: string
  verdict: string
  /** A `CINV-` code; empty when accepted. */
  code: string
  /** The server's sentence, shown verbatim. */
  message: string
}

/** `data` of `POST Sd/CentralInvoice`: one result per DISTINCT delivery, in the order sent. */
export interface CentralInvoiceRaiseResponse {
  results: CentralInvoiceRaiseResult[]
}

// ── The list (`GET Sd/CentralInvoice`, BackOffice ticket 2100; client ticket 333) ──

/** One consumed pack (`CentralInvoiceSerial`): the picking document it was picked on, and its
 *  GS1 identity. `expiryDate` is the unit's own text, passed through as stored. */
export interface CentralInvoiceSerial {
  pickDocumentNo: string
  gtin: string
  serialNumber: string
  batchLot: string
  expiryDate: string
}

/**
 * One raised central invoice (`CentralInvoiceListRow`), as finance and regulatory read it.
 *
 * `status`, `pickOutcome` are the server's upper-case spellings, typed `string` for the same
 * reason `CentralInvoiceRaiseResult.verdict` is: an unknown spelling is shown as sent.
 */
export interface CentralInvoiceListRow {
  /** The audit row's ULID. */
  id: string
  deliveryNo: string
  /** The delivery's store — where the invoice sits. */
  storeCode: string
  requestedBy: string
  /** Local wall clock, no offset. */
  requestedAt: string
  reason: string
  /** QUEUED / BILLED / STRANDED. */
  status: string
  /** The `CINV-` code a STRANDED request stopped on; empty otherwise. */
  refusalCode: string
  /** `I<DeliveryNo>` once BILLED; empty before. */
  trxNumber: string
  /** Null while there is no invoice — never a fake zero. */
  invoiceTotal: number | null
  /** The invoice's `CENTRAL` cash line — cash no Z-report counted. 0 on a JAHA/HNGR credit
   *  sale or when the online tenders covered it; null while there is no invoice. */
  cashRemainder: number | null
  /** The picking document the audit row names; empty if none. */
  pickDocumentNo: string
  /** CONSUMED / VOIDED / NONE once BILLED; empty before. */
  pickOutcome: string
  /** Local wall clock; the .NET `0001-01-01T00:00:00` until BILLED. */
  billedAt: string
  /** The store's plant country (`Plants.CountryKey`); empty when the plant has none. */
  country: string
  /** A serial-tracked article, in a country that is not GS1-exempt (an unknown one counts). */
  serialisedInGs1Market: boolean
  /** The units of every picking document the invoice CONSUMED; empty for any other outcome. */
  serials: CentralInvoiceSerial[]
}

/** `data` of `GET Sd/CentralInvoice`: newest request first. */
export interface CentralInvoiceListResponse {
  rows: CentralInvoiceListRow[]
}
