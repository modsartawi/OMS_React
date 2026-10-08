/**
 * What every spec 430 import door answers (D8; BackOffice ask BO-7, NOT built yet):
 * `POST SdDocumentWeb/Cities/Import`, `Districts/Import` and `DocumentSourceUsers/Import`.
 *
 * Semantics stay WPF's — per line an upsert or a delete, one commit, lines absent from the file
 * untouched — but a line the server skips is now reported rather than dropped silently.
 */
export interface ImportResultModel {
  applied: number
  unchanged: number
  skipped: ImportSkippedLine[]
}

export interface ImportSkippedLine {
  /** The 1-based line of the file as sent. */
  line: number
  /** The line's key as the server read it (a city, district or user code). */
  key: string
  /** `UNKNOWN_CITY` | `UNKNOWN_STAFF` | `UNKNOWN_SOURCE`, or any other code (shown as the code). */
  reason: string
}
