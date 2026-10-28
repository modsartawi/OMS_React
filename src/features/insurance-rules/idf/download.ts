/**
 * The IDF downloads' fallback file names, pure (BackOffice spec 3185; the shared download seam of oms 644 / 650 / 651 /
 * 652). Every 3185 export and template is the server's `.xlsx` through `api.blob`; the server's
 * `Content-Disposition` name always wins and these names are used only when it sends none. ASCII ids, never a
 * display name, so the name survives every file system.
 *
 * ⚠️ Parallel slices: add your ticket's names under YOUR slot comment only.
 */

// 644 · master export + template (masterExportFileName, masterTemplateFileName)
/** A file-name part: anything but ASCII letters, digits, `.`, `_`, `-` becomes one dash. */
function fileNamePart(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}
/** A master's version as `.xlsx`: the master's id and the version's number (`v3`), or its id when the number is unknown. */
export function masterExportFileName(masterId: string, version: { versionId: string; number?: number | null }): string {
  const v = version.number != null ? `v${version.number}` : fileNamePart(version.versionId)
  return `idf-master-${fileNamePart(masterId)}-${v}.xlsx`
}
export function masterTemplateFileName(): string {
  return 'idf-master-template.xlsx'
}

// 650 · change log export (changesExportFileName)

// 651 · general export + template (generalExportFileName, generalTemplateFileName)

// 652 · IDF groups export + template
export function groupsExportFileName(): string {
  return 'idf-groups.xlsx'
}
export function groupsTemplateFileName(): string {
  return 'idf-groups-template.xlsx'
}
