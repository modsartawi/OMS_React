/**
 * The IDF downloads' fallback file names, pure (BackOffice spec 3185; the shared download seam of oms 644 / 650 / 651 /
 * 652). Every 3185 export and template is the server's `.xlsx` through `api.blob`; the server's
 * `Content-Disposition` name always wins and these names are used only when it sends none. ASCII ids, never a
 * display name, so the name survives every file system.
 *
 * ⚠️ Parallel slices: add your ticket's names under YOUR slot comment only.
 */

// 644 · master export + template (masterExportFileName, masterTemplateFileName)

// 650 · change log export (changesExportFileName)

// 651 · general export + template (generalExportFileName, generalTemplateFileName)

// 652 · IDF groups export + template
export function groupsExportFileName(): string {
  return 'idf-groups.xlsx'
}
export function groupsTemplateFileName(): string {
  return 'idf-groups-template.xlsx'
}
