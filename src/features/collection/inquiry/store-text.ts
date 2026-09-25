/**
 * The store as a PAPER prints it — the ACR form's رقم الصيدلية cell and the
 * voucher's **Store.** line (ticket 314, BackOffice 1990).
 *
 * 🔑 The server's `storeText` VERBATIM: `"PH-019 (P019)"`, or the code alone. The
 * profit center is composed by one C# formatter (`ProfitCenterFormat.StoreText`)
 * and never here — no prefixing, no brackets, no lookup.
 *
 * ⚠️ The one tolerance is a MISSING field, which is what a SIS.Api without 1990
 * sends — a deploy-order state, not a contract one (`voucher-box.ts` tolerates a
 * missing description the same way). Then the paper prints `storeCode`, exactly
 * as it did before 1990, rather than a blank store on a printed record. A field
 * that IS sent is never second-guessed.
 */
export function paperStoreText(paper: { storeCode: string; storeText?: string }): string {
  return paper.storeText ?? paper.storeCode
}
