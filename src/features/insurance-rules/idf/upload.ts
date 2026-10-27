/**
 * An IDF master's upload, pure (BackOffice spec 3157, door 3161; oms ticket 622). A file (item, IDF group,
 * priority) goes to `POST IdfPriority/masters/{id}/uploads`, which publishes nothing and answers a row report:
 * every failing row with its line, item number, the rule it broke and the message in both languages. The server
 * checks, in order: unknown item · item not in the insurer's ItemCustomer rows · unknown IDF group · priority not a
 * whole number ≥ 1 · item listed twice. The screen renders whatever `rule` the report names.
 *
 * Publish is all-or-nothing: only a clean report (`ok` and no failing row) may be published.
 */

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
  rows: IdfUploadRow[]
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
