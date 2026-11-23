/**
 * Wire shapes of the bulk change's shared presets (BackOffice spec 4190 stories 35–39, server ticket
 * 4195; oms 960).
 *
 * 🚩 GUESSED CONTRACT. 4195 was unbuilt when this was written: the names follow the shipped
 * `BbyMaintainWeb` conventions (camelCase, in-band `status` + bilingual `refusals`) and spec 4190's
 * "Presets: a new HQ table" (ULID id, unique name, operations as JSON, version-guarded edit). The
 * reasoning is in the 960 section of the spec 4190 contract note. Reconcile when 4195 ships.
 */
import type { BbyBulkOperations } from './bonus-buy-bulk'
import type { BbyRefusal } from './bonus-buy-maintenance'

/** One row of GET `BbyMaintainWeb/BulkPreset/List`. A preset holds operations, never bonus-buy numbers. */
export interface BbyBulkPreset {
  /** ULID. */
  id: string
  /** Human-typed, unique (the server compares it without case). */
  name: string
  /**
   * The operations (4193's shape). Expected as an object; the column is `NVARCHAR(MAX)` JSON, so a
   * server that hands the text back as is is read too (`readPresetOperations`).
   */
  operations: BbyBulkOperations | string | null
  /** The last-written stamp, opaque; an edit or delete sends it back. */
  version: string | null
  createdBy?: string | null
  createdAt?: string | null
  changedBy?: string | null
  changedAt?: string | null
}

/** POST `BbyMaintainWeb/BulkPreset/Save`: no `id` creates; an `id` edits at `version`. */
export interface BbyBulkPresetSaveRequest {
  id: string | null
  name: string
  operations: BbyBulkOperations
  version: string | null
}

/** POST `BbyMaintainWeb/BulkPreset/Delete`. */
export interface BbyBulkPresetDeleteRequest {
  id: string
  version: string | null
}

/**
 * The in-band 200 of Save and Delete (`BbyMaintainResult`-shaped). A duplicate name or a stale edit is
 * `refused` with bilingual `refusals`; a preset someone else deleted is `notFound`.
 */
export interface BbyBulkPresetOutcome {
  status: 'saved' | 'deleted' | 'refused' | 'notFound' | string
  /** The preset as saved (new version), on `saved`. */
  preset?: BbyBulkPreset | null
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
}
