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
