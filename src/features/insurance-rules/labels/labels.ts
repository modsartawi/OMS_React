/**
 * Code labels, pure (BackOffice spec 3271 L3–L5, doors 3295 + 3296; oms ticket 706). A grant holder uploads a
 * Nphies workbook. The door parses it, never the browser, and answers the version, the labels that changed and
 * the workbook's new change-log rows. Every word here is the workbook's own, shown as sent and never translated.
 *
 * 🚩 Every shape is a guess until 711 reconciles it with the doors as built.
 */

/** The workbooks door 3296 reads. A kind this list does not know is shown as sent. */
export const WORKBOOK_KINDS = ['codeableConcept', 'validationRule', 'profiles'] as const

/** A row of `GET InsuranceRules/Labels/Workbooks`, and the `load` of an upload's reply. */
export interface WorkbookLoad {
  id: string
  workbook: string
  version: string
  fileName?: string | null
  fileHash: string
  uploadedBy: string
  uploadedAt?: string | null
}

/** A code's two labels at one side of the diff. */
export interface LabelText {
  en?: string | null
  ar?: string | null
}

export const LABEL_CHANGES = ['added', 'changed', 'removed'] as const
export type LabelChange = (typeof LABEL_CHANGES)[number]

export interface LabelDiffRow {
  system: string
  code: string
  /** `added | changed | removed`, typed loosely because it is the door's word. */
  change: string
  before?: LabelText | null
  after?: LabelText | null
}

/** A row of the workbook's own change log, new since the version loaded before it. */
export interface ChangeLogRow {
  version: string
  date?: string | null
  system?: string | null
  code?: string | null
  /** The workbook's sentence, in the workbook's language. */
  change: string
}

/** `POST InsuranceRules/Labels/Workbooks`. */
export interface WorkbookUploadReply {
  load: WorkbookLoad
  diff: LabelDiffRow[]
  changeLog: ChangeLogRow[]
}

export interface LabelDiffGroups extends Record<LabelChange, LabelDiffRow[]> {
  total: number
}

/**
 * The diff by what happened to each code, each group in the door's order. A change this screen does not know
 * reads as changed, so a row the door sent is never lost from the review.
 */
export function groupLabelDiff(rows: readonly LabelDiffRow[]): LabelDiffGroups {
  const groups: LabelDiffGroups = { added: [], changed: [], removed: [], total: rows.length }
  for (const row of rows) {
    const group = row.change === 'added' || row.change === 'removed' ? row.change : 'changed'
    groups[group].push(row)
  }
  return groups
}

/** The multipart body: the file alone, because the door reads which workbook it is from its layout. */
export function uploadForm(file: File): FormData {
  const form = new FormData()
  form.append('file', file, file.name)
  return form
}
