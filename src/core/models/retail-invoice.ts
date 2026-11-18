/**
 * Retail invoice rail models (spec 261).
 *
 * The wire vocabulary of `RetailInvoice/*`, and it is **not this repo's to
 * invent**: the shapes are settled by the BackOffice contract
 * `.issues/assets/988-search-download-contract.md` (map 984), whose §2 exists to
 * be pasted here verbatim so the row shape cannot drift between the two repos.
 * A field renamed or a type softened for local convenience produces a screen
 * that fails silently the day it meets the real endpoint — on exactly the fields
 * that were changed.
 *
 * `api-envelope` puts wire types in `core/models/` rather than in the feature.
 *
 * Ticket 263 landed **only the screen's gate**; ticket 264 pastes
 * contract §2 — `InvoiceCandidate`, `InvoiceSearchResult` and
 * `RetailInvoiceKey` — as the slice that first has a caller for the search
 * shapes. §2 is pasted as **one block** rather than field by field: it is the
 * unit the contract says to copy verbatim, and splitting it is how a paste
 * starts to drift.
 */

/* -------------------------------------------------------------------------- *
 * Contract §2 — pasted VERBATIM (ticket 264).
 *
 * ⚠️ Not one field renamed, added, or softened. The doc comments below are the
 * contract's own: they carry which parts are the download key, which may be
 * empty, and which are C# enum names rather than labels — all facts a screen
 * gets wrong silently if the type stops saying them.
 * -------------------------------------------------------------------------- */

/** One candidate invoice from RetailInvoice/Search. */
export interface InvoiceCandidate {
  /** Key part 2. Exact value from RetailTrx — pass back to Download unmodified. */
  storeCode: string
  /** Store.Description. May be empty when the store row is missing. */
  storeName: string
  /** Key part 3. Never a search input — display + key only. */
  machineCode: string
  /** Key part 4. */
  trxNumber: string
  receiptNumber: string

  /** Date only, `yyyy-MM-dd`. Unformatted — the client formats. */
  trxDate: string
  /** Time of day, `HH:mm:ss`. */
  trxTime: string

  /** C# enum name, e.g. "Sales" | "Return" | "CashClearance". */
  trxType: string
  /** Stored int: 100 Sales, 110 Return, 700 CashClearance. */
  trxTypeCode: number

  /** C# enum name, e.g. "Cash" | "Credit" | "Insurance" | "ECommerce" | … */
  documentType: string
  documentTypeCode: number

  /** C# enum name: "None" | "Closed" | "Training" | "Suspended" | "Posted"
   *  | "ToBePrinted" | "LongSuspend" | "Order". */
  trxStatus: string
  trxStatusCode: number

  amount: number
  itemLinesCount: number

  /** May be empty — a walk-in sale has no customer. */
  customerId: string
  customerName: string
}

export interface InvoiceSearchResult {
  rows: InvoiceCandidate[]
  /** true when the 50-row cap truncated the result. Should never be true for an
   *  exact-match search; if it is, something is wrong with the data. */
  capReached: boolean
}

/** The key Download takes. Build it from a row, never from user input. */
export interface RetailInvoiceKey {
  storeCode: string
  machineCode: string
  trxNumber: string
}
