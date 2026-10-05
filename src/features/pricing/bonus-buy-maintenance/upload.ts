/**
 * The upload dialog's pure half (ticket 418): the multipart form the door reads, the size
 * check before the bytes go up, and the one reading of the door's answer. No React, no i18n.
 *
 * The file is never parsed here. SAP's 22-column file goes up as bytes and every row the
 * dialog shows is the server's own reading of it (BackOffice 2381).
 */
import type {
  BbyUploadBonusBuy,
  BbyUploadRefusal,
  BbyUploadResult,
  BbyUploadStatus,
} from '@/core/models/bonus-buy-upload'

/** SIS.Api's per-route cap on the door (`BbyUploadRequest.MaxFileBytes`). */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

/** What the picker offers: SAP's uploader writes `.txt`; a tab-separated `.tsv` is the same file. */
export const UPLOAD_ACCEPT = '.txt,.tsv'

export interface UploadOptions {
  /** Check only: every refusal and warning, nothing written. */
  validateOnly: boolean
  /** Activate the NEW bonus buys in the same run instead of leaving them Planned. */
  activate: boolean
}

/** The door's three parts, named as `BbyMaintainWebEndpoints.Upload` binds them. */
export function uploadForm(file: File, options: UploadOptions): FormData {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('validateOnly', String(options.validateOnly))
  form.append('activate', String(options.activate))
  return form
}

export type UploadFileProblem = 'empty' | 'tooLarge'

/** Said before the round trip: an empty file, or one the door's cap would refuse with a 413. */
export function uploadFileProblem(file: Pick<File, 'size'>): UploadFileProblem | null {
  if (file.size <= 0) return 'empty'
  if (file.size > UPLOAD_MAX_BYTES) return 'tooLarge'
  return null
}

/**
 * `loaded` — written; `checked` — a check-only run that passed; `refused` — every bad row,
 * nothing written; `unknown` — a status this client cannot read.
 */
export type UploadOutcome = 'loaded' | 'checked' | 'refused' | 'unknown'

/** The door's status → the dialog's outcome (`saved` wrote, `valid` was a passing check). */
const OUTCOME_OF: Record<BbyUploadStatus, UploadOutcome> = {
  saved: 'loaded',
  valid: 'checked',
  refused: 'refused',
}

export interface UploadView {
  outcome: UploadOutcome
  promoNumber: string
  promotionCreated: boolean
  created: BbyUploadBonusBuy[]
  updated: BbyUploadBonusBuy[]
  /** Every refused row, in the server's order. Row 0 is the whole file. */
  refused: BbyUploadRefusal[]
  warnings: BbyUploadRefusal[]
  /** The door is all or nothing: a refusal and a check-only pass wrote nothing, and the
   *  dialog says so. Never claimed for an answer it cannot read. */
  nothingWritten: boolean
  /** Only a load that wrote refreshes the overview — a check-only run NEVER does. */
  refreshOverview: boolean
}

/**
 * Read the door's answer for the dialog. A refused file shows no created or updated rows
 * even if the server sent some, since it wrote none of them. A run sent as check-only never
 * refreshes the overview, whatever came back.
 */
export function readUpload(result: BbyUploadResult, options: UploadOptions): UploadView {
  const outcome: UploadOutcome = Object.hasOwn(OUTCOME_OF, result.status) ? OUTCOME_OF[result.status] : 'unknown'
  const refused = outcome === 'refused'
  return {
    outcome,
    promoNumber: result.promoNumber ?? '',
    promotionCreated: result.promotionCreated === true,
    created: refused ? [] : (result.created ?? []),
    updated: refused ? [] : (result.updated ?? []),
    refused: result.refusals ?? [],
    warnings: result.warnings ?? [],
    nothingWritten: outcome === 'refused' || outcome === 'checked',
    // An unreadable answer to a load may have written: re-reading is harmless.
    refreshOverview: !options.validateOnly && (outcome === 'loaded' || outcome === 'unknown'),
  }
}
