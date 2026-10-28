/**
 * An IDF master's upload, pure (BackOffice spec 3157, door 3161; oms ticket 622). A file (item, IDF group,
 * priority) goes to `POST IdfPriority/masters/{id}/uploads`, which publishes nothing and answers a row report:
 * every failing row with its line, item number, the rule it broke and the message in both languages. The server
 * checks, in order (3161 + the 3157 review), and a line reports its FIRST failed rule: unknown item · item not in the
 * insurer's ItemCustomer rows · unknown IDF group · item not a member of the IDF group the line names · priority not a
 * whole number ≥ 1 · item listed twice. The screen renders whatever `rule` the report names (a rule it has no word
 * for shows its code).
 *
 * The file (3161): an `.xlsx` (first sheet), a tab-separated `.txt` / `.tsv`, or a `.csv`; header row optional, else
 * the columns are item, IDF group, priority. Every upload gets an `uploadId`, and the answer is a 200 even when rows
 * fail.
 *
 * Publish is all-or-nothing: only a clean report (`ok` and no failing row) may be published.
 */

/** The rules a row can break, in the order the server checks them. */
export const IDF_UPLOAD_RULES = ['unknownItem', 'notInInsurerItems', 'unknownGroup', 'itemNotInGroup', 'badPriority', 'duplicateItem'] as const
export type IdfUploadRule = (typeof IDF_UPLOAD_RULES)[number]

/** The file types the upload door reads. */
export const IDF_UPLOAD_ACCEPT = '.xlsx,.txt,.tsv,.csv'

/** One failing row of the report. `line` and `itemNumber` are machine values; the messages are free text. */
export interface IdfUploadRow {
  line: number
  itemNumber: string
  rule: string
  messageEn: string
  messageAr: string
}

/** `POST IdfPriority/masters/{id}/uploads` → the row report. */
export interface IdfUploadReport {
  uploadId: string
  ok: boolean
  /** How many lines the file held (3161). */
  lineCount?: number | null
  rows: IdfUploadRow[]
}

/** The `insurance-idf` key of a rule's word, or null for a rule this build does not know. */
export function ruleWordKey(rule: string): string | null {
  return (IDF_UPLOAD_RULES as readonly string[]).includes(rule) ? `upload.rule.${rule}` : null
}

/** Publish only a clean report: the server's `ok` and no failing row, both — a disagreement never publishes. */
export function isPublishable(report: IdfUploadReport | null | undefined): boolean {
  return !!report && !!report.uploadId && report.ok === true && (report.rows ?? []).length === 0
}

/** A failing row's message in the reader's language; English when the Arabic is blank. */
export function rowMessage(row: Pick<IdfUploadRow, 'messageEn' | 'messageAr'>, lang: string): string {
  return lang.startsWith('ar') && row.messageAr ? row.messageAr : row.messageEn || row.messageAr
}

/** The upload's multipart body: the one part `file`. */
export function uploadForm(file: File): FormData {
  const form = new FormData()
  form.append('file', file, file.name)
  return form
}
