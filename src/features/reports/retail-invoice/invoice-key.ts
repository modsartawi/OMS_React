import type { RetailInvoiceKey } from '@/core/models/retail-invoice'

/**
 * The two things derived from a row's **key** rather than from its fields
 * (ticket 265).
 *
 * 🚩 **Pure, and in a `.ts` for that reason.** Both of these were written inside
 * `DownloadAction.tsx` and moved here at 265's standards review: they are facts
 * about the *row*, not about the button that draws it, and a `.tsx` is where a
 * pure function goes to lose its tests. This repo has no React Testing Library
 * by ruling (spec 083) precisely because the pure modules are where regression
 * is silent — so a pure function stranded in a renderer is untested twice over.
 *
 * ⚠️ **Three parts, never four.** `RetailTrx`'s primary key is
 * `Client` + `StoreCode` + `MachineCode` + `TrxNumber`, but `Client` is a fixed
 * `'000'` estate-wide and slated for removal (owner ruling, BackOffice 988), so
 * it is not on the wire and is not part of either string below.
 */

/**
 * The identity of a row **as a download**, and the one place it is spelled.
 *
 * Used to tell "this row is rendering" from "some other row is", so the rest of
 * the grid stays usable while one PDF is on its way.
 */
export function invoiceRowKey(row: RetailInvoiceKey): string {
  return `${row.storeCode}/${row.machineCode}/${row.trxNumber}`
}

/**
 * The default filename, used **only** when the response carried no
 * `Content-Disposition` (contract §5's own fallback shape).
 *
 * ⚠️ `Content-Disposition` is the filename authority. This deliberately carries
 * **no date** (contract §6.5) and renaming after the save is out of scope — a
 * filename is not user-visible copy and is not localized, so it takes no `t()`.
 */
export function fallbackFileName(row: RetailInvoiceKey): string {
  return `Invoice-${row.storeCode}-${row.machineCode}-${row.trxNumber}.pdf`
}
