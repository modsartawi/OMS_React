/**
 * An IDF groups import, pure (BackOffice spec 3185, door 3197; oms ticket 653). A file of groups (number,
 * description, dosage form) goes to `POST IdfPriority/groups/uploads`, which writes nothing and answers a report
 * listing EVERY row: its line, the group number, what applying would do (`add` a new group or `update` an existing
 * one) and — on a failing row — the rule it broke with the message in both languages (`rule` is empty on a passing
 * row). `POST IdfPriority/groups/uploads/{uploadId}/apply` then writes the whole file, answering how many groups were
 * added and updated; it is refused unless the report was `ok`.
 *
 * A bad groups file must never reach the tills: Apply is offered only on a report that is `ok` AND names no failing
 * row. Unlike a master upload the rows are never empty here, so `isPublishable` (upload.ts) is the wrong test.
 *
 * Shapes are the brief's sketch ("Spec 3185"); 654 reconciles them with the door as built.
 */

/** The rules a groups row can break. */
export const IDF_GROUPS_IMPORT_RULES = ['missingNumber', 'duplicateNumber', 'numberTooLong', 'missingDescription'] as const
export type IdfGroupsImportRule = (typeof IDF_GROUPS_IMPORT_RULES)[number]

export type IdfGroupsImportAction = 'add' | 'update'

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
  rows: IdfGroupsImportRow[]
}

/** `POST IdfPriority/groups/uploads/{uploadId}/apply` → what was written. */
export interface IdfGroupsImportResult {
  added: number
  updated: number
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
