/**
 * Wire shapes of the bulk change's shared presets (BackOffice spec 4190 stories 35–39, server ticket
 * 4195; oms 960).
 *
 * Reconciled to BackOffice pricing2 9317c4cd6 (`BbyBulkChangeModels.cs`: `BbyBulkPresetDocument`,
 * `BbyBulkPresetRequest`, `BbyBulkPresetDeleteRequest`, `BbyBulkPresetResult`). The contract record is
 * `.issues/4190-bulk-change-contract-guess.md`.
 */
import type { BbyBulkOperations } from './bonus-buy-bulk'
import type { BbyRefusal } from './bonus-buy-maintenance'

/** One row of GET `BbyMaintainWeb/Bulk/Preset/List` (by name). A preset holds operations, never bonus-buy numbers. */
export interface BbyBulkPreset {
  /** ULID. */
  id: string
  /** Human-typed, unique (the server compares it without case), at most `BbyBulkPreset.Widths.Name` (100). */
  name: string
  /**
   * The operations (4193's shape), deserialised by the server: an object whose Leave fields are `null`.
   * A JSON string is still read (`readPresetOperations`), as a cheap guard.
   */
  operations: BbyBulkOperations | string | null
  /** 1 on create, +1 on every edit; an edit or delete sends it back. */
  version: number
  createdBy?: string | null
  /** Local time (no-utc-time). */
  createdAt?: string | null
  changedBy?: string | null
  changedAt?: string | null
}

/** POST `BbyMaintainWeb/Bulk/Preset/Save`: no `id` creates; an `id` edits at `version` (no version is stale). */
export interface BbyBulkPresetSaveRequest {
  id: string | null
  name: string
  operations: BbyBulkOperations
  version: number | null
}

/** POST `BbyMaintainWeb/Bulk/Preset/Delete`: the version is required (none, or another, is refused stale). */
export interface BbyBulkPresetDeleteRequest {
  id: string
  version: number
}

/**
 * The in-band 200 of Save and Delete (`BbyBulkPresetResult`): `saved` (with the preset at its new
 * version), `deleted`, `refused` (bilingual `refusals`: name required, empty, duplicate, stale) or
 * `notFound` (someone deleted it).
 */
export interface BbyBulkPresetOutcome {
  status: 'saved' | 'deleted' | 'refused' | 'notFound' | string
  preset?: BbyBulkPreset | null
  refusals: BbyRefusal[]
}
