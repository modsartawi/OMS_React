/**
 * The general master's upload, pure (BackOffice spec 3185, door 3193; oms ticket 649). A file (item, IDF group,
 * priority — the master upload's formats, `IDF_UPLOAD_ACCEPT`) goes to `POST IdfPriority/general/uploads`, which writes
 * nothing and answers 622's row report (`uploadId, ok, lineCount, rows`) plus a change **preview**: how many items
 * the file would add, re-rank (same group, new priority), move (another group) or leave unchanged, and each change
 * before → after. `POST IdfPriority/general/uploads/{uploadId}/apply { reason }` then writes it in batches, answering
 * how many items were applied and the batches that failed (their lines and message); it is refused unless `ok`.
 *
 * A bad general file reaches every till: Apply is offered only on a clean report — the master upload's rule
 * (`isPublishable`: ok AND no failing row).
 *
 * Shapes are the brief's sketch ("Spec 3185"); 654 reconciles them with the door as built.
 */
import { formatPair, formatRange } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { isPublishable, type IdfUploadReport } from './upload'

/** What applying the file would do to one item, in the brief's order. */
export const IDF_GENERAL_CHANGE_KINDS = ['added', 'reRanked', 'moved', 'unchanged'] as const
export type IdfGeneralChangeKind = (typeof IDF_GENERAL_CHANGE_KINDS)[number]

/** An item's place: its IDF group and its priority in the group. */
export interface IdfGeneralSide {
  idfNumber: string
  priority: number
}

export interface IdfGeneralChange {
  itemNumber: string
  change: IdfGeneralChangeKind
  /** Null when the item is not ranked today (an `added` one). */
  before: IdfGeneralSide | null
  after: IdfGeneralSide
}

export interface IdfGeneralPreview {
  added: number
  reRanked: number
  moved: number
  unchanged: number
  changes: IdfGeneralChange[]
}

/** `POST IdfPriority/general/uploads` → 622's row report plus the preview (null on a failing file). */
export interface IdfGeneralUploadReport extends IdfUploadReport {
  preview: IdfGeneralPreview | null
}

/** A batch the apply could not write: its lines and the message in both languages. */
export interface IdfGeneralFailedBatch {
  fromLine: number
  toLine: number
  messageEn: string
  messageAr: string
}

/** `POST …/general/uploads/{uploadId}/apply { reason }` → how many items were written, and the batches that failed. */
export interface IdfGeneralApplyResult {
  applied: number
  failedBatches: IdfGeneralFailedBatch[]
}

/**
 * How an apply went (3185 review): `applied` — items written and no batch failed; `partial` — some written, some batch
 * failed; `failed` — nothing written. Only `applied` is a success; the others keep the file's report on screen.
 */
export type IdfGeneralApplyOutcome = 'applied' | 'partial' | 'failed'
export function applyOutcome(r: IdfGeneralApplyResult): IdfGeneralApplyOutcome {
  if (r.applied <= 0) return 'failed'
  return r.failedBatches.length > 0 ? 'partial' : 'applied'
}

/** Apply only a clean report: the server's `ok` and no failing row — 622's rule. */
export function isGeneralUploadApplicable(report: IdfGeneralUploadReport | null | undefined): boolean {
  return isPublishable(report)
}

/** The preview's changes of one kind (`''` = every kind), in the server's order. */
export function previewRows(preview: IdfGeneralPreview | null | undefined, kind: IdfGeneralChangeKind | ''): IdfGeneralChange[] {
  const changes = preview?.changes ?? []
  return kind ? changes.filter((c) => c.change === kind) : changes
}

/** One side of a change as ONE string (`IDF-AMOX · 1`, isolated once), or null when there is none. */
export function previewSide(side: IdfGeneralSide | null | undefined): string | null {
  return side ? formatPair(side.idfNumber, formatFigure(side.priority)) : null
}

/** A failed batch's lines as one range (`201–400`); a one-line batch is its line. */
export function failedBatchLines(batch: IdfGeneralFailedBatch): string {
  const from = formatFigure(batch.fromLine)
  return batch.toLine === batch.fromLine ? from : formatRange(from, formatFigure(batch.toLine))
}
