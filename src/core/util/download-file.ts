/**
 * Handing a finished file to the browser as a download.
 *
 * 🚩 Graduated to `core/` at ticket 262, and **pre-authorized by the code it came
 * from**: the `URL.createObjectURL` + parked-anchor + deferred-revoke helper was
 * byte-for-byte duplicated in `features/admin/ua-admin/export.ts` and
 * `features/collection/inquiry/export.ts`, and collection's copy carried the
 * instruction in its own docblock — *"it graduates to `@/core` … when a third
 * consumer lands, not before."* The retail invoice PDF download (spec 261) is
 * that third consumer, so both call sites are repointed here in the same commit
 * that creates the file. Following `money.ts` at 250 and `pager.ts` at 232: a
 * pure move, not one line of behaviour changed.
 *
 * `core/` deliberately learns **nothing** about what is being saved — no
 * `downloadPdf`, no invoice-shaped helper. `saveBlob` takes a name and a blob;
 * `downloadCsv` is the one flavoured wrapper, and it is here only because it was
 * already shared by two features.
 */

/**
 * Save a blob under `fileName`. The anchor is parked in the document and the
 * object URL released a tick after the click — a synchronous `revokeObjectURL`
 * is fine in Chrome but **can abort the download elsewhere**, which is precisely
 * the kind of knowledge a move like this one loses if the comment does not come
 * with it.
 */
export function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Hand a finished CSV string to the browser as a download. Kept out of the CSV
 * writers so they stay testable without a DOM.
 */
export function downloadCsv(fileName: string, contents: string): void {
  saveBlob(fileName, new Blob([contents], { type: 'text/csv;charset=utf-8' }))
}
