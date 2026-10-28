/**
 * An IDF groups import, pure (BackOffice spec 3185, door 3197; oms ticket 653). A file of groups (number,
 * description, dosage form) goes to `POST IdfPriority/groups/uploads`, which writes nothing and answers a report
 * listing EVERY row: its line, the group number, what applying would do (`add` a new group or `update` an existing
 * one) and — on a failing row — the rule it broke with the message in both languages (`rule` is empty on a passing
 * row). `POST IdfPriority/groups/uploads/{uploadId}/apply` (no body) then writes the whole file once, all or nothing,
 * answering how many groups were added, updated and left unchanged; it is refused unless the report was clean
 * (`IDF-00049`: failed lines, or already applied; `IDF-00048`: no such upload).
 *
 * A bad groups file must never reach the tills: Apply is offered only on a report that is `ok` AND names no failing
 * row. Unlike a master upload the rows are never empty here, so `isPublishable` (upload.ts) is the wrong test.
 *
 * 654 reconciled the shapes with the door as built (BackOffice 3197, `IdfGroupUploadModels`): the report carries
 * `lineCount`; a row whose number is missing or too long has no action (`''`).
 */

/** The rules a groups row can break, in the order the door checks them (`IdfGroupUploadRules`). */
export const IDF_GROUPS_IMPORT_RULES = ['missingNumber', 'numberTooLong', 'duplicateNumber', 'missingDescription', 'descriptionTooLong', 'dosageFormTooLong'] as const
export type IdfGroupsImportRule = (typeof IDF_GROUPS_IMPORT_RULES)[number]

/** `''` on a row failed before its number was known (missing or too long). */
export type IdfGroupsImportAction = 'add' | 'update' | ''

/** One row of the report. `line` and `idfNumber` are machine values; the messages are free text. */
export interface IdfGroupsImportRow {
  line: number
  idfNumber: string
  action: IdfGroupsImportAction
  /** Empty on a passing row. */
  rule: string
  messageEn: string
  messageAr: string
}

/** `POST IdfPriority/groups/uploads` → the row report. */
export interface IdfGroupsImportReport {
  uploadId: string
  ok: boolean
  /** How many lines the file held. */
  lineCount?: number | null
  rows: IdfGroupsImportRow[]
}

/** `POST IdfPriority/groups/uploads/{uploadId}/apply` → what was written; `unchanged` = lines that matched the group as it stood. */
export interface IdfGroupsImportResult {
  added: number
  updated: number
  unchanged: number
}

const failed = (r: Pick<IdfGroupsImportRow, 'rule'>) => !!r.rule

/** Apply only an `ok` report with at least one row and no failing row — a disagreement never applies. */
export function isGroupsImportApplicable(report: IdfGroupsImportReport | null | undefined): boolean {
  const rows = report?.rows ?? []
  return !!report && !!report.uploadId && report.ok === true && rows.length > 0 && !rows.some(failed)
}

/** How many passing rows would add and update, and how many failed. */
export function groupsImportCounts(rows: IdfGroupsImportRow[] | null | undefined): { add: number; update: number; failed: number } {
  const out = { add: 0, update: 0, failed: 0 }
  for (const r of rows ?? []) {
    if (failed(r)) out.failed++
    else if (r.action === 'update') out.update++
    else out.add++
  }
  return out
}

/** The `insurance-idf` key of a rule's word, or null for a rule this build does not know (the screen shows its code). */
export function groupsImportRuleWordKey(rule: string): string | null {
  return (IDF_GROUPS_IMPORT_RULES as readonly string[]).includes(rule) ? `groupsImport.rule.${rule}` : null
}
