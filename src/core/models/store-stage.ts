/**
 * HQ's stage screen (BackOffice ticket 3899, spec 3849 phase 2) — wire shapes mirrored field for field, camelCase, from
 * BackOffice `Sartawi.Retail.Data\Modules\Stock_v2\Stages\IStoreStageClient.cs`, which mirrors SIS.Stock 064's
 * `StoreStageModels.cs`. A shape change goes there first, then here.
 *
 * - `GET StoreStage[?store=]` → each store's stage at Stock Visibility and its last move (`BackOfficeScreen[StoreStage, 03]`).
 * - `GET StoreStage/{store}/Moves` → the store's stage log, newest first (same grant).
 * - `POST StoreStage/{store}/Move` `{ stage, why }` → the store's stage after the move (`BackOfficeScreen[StoreStage, 02]`).
 *   Who is the signed-in user; SIS.Stock refuses a move a person may not make with a 400 `StageMoveRefused`.
 *
 * ⚠️ Timestamps are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings.
 */

/**
 * The four stages a store moves through at Stock Visibility, in order (SIS.Stock 064). Shared by the stage screen and the
 * stock console; a stage on the wire is still read as a string, defensively (`isStageName`).
 */
export const STAGES = ['Shadow', 'Seeding', 'Seeded', 'Blocking'] as const
export type StageName = (typeof STAGES)[number]

export const isStageName = (s: string | null | undefined): s is StageName =>
  typeof s === 'string' && (STAGES as readonly string[]).includes(s)

/** One row of a store's stage log. `mover` is `Person`, `CountClosing` or `Seed`. */
export interface StoreStageMove {
  store: string
  from: string
  to: string
  mover: string
  who: string
  why: string
  movedAt: string
}

/** A store's stage and its last move (null for a store never moved: it is Shadow). */
export interface StoreStage {
  store: string
  stage: string
  updatedAt: string | null
  lastMove: StoreStageMove | null
}

/** The move's body. */
export interface StoreStageMoveRequest {
  stage: string
  why: string
}

/**
 * BackOffice ticket 3898, the count's closing — mirrored from `StoreCountRows.cs` / `StoreCountClosingService.cs`.
 *
 * - `GET StoreStage/Counts` → every store under count (its `StoreLastInventory` row) with the closing mark
 *   (`BackOfficeScreen[StoreStage, 03]`).
 * - `GET StoreStage/{store}/Releases` → the store's releases of closed counts, newest first (same grant).
 * - `POST StoreStage/{store}/CountClosed` → "count closed": the row marked, the stage moved to Seeding and the seed asked
 *   (`BackOfficeScreen[StoreCountClose, 02]`). The row is deleted when the seed answers Seeded; a refused seed comes back in
 *   `seedRefusal` and the row stays, closed.
 * - `POST StoreStage/{store}/Release` `{ why }` → after a refused seed, a named person releases the closed count, the store
 *   back to Shadow, logged (`BackOfficeScreen[StoreStage, 02]`).
 */
export interface StoreCountRow {
  storeCode: string
  inventoryDate: string
  isCountClosed: boolean
  /** `0001-01-01T00:00:00` while the count is open. */
  countClosedAt: string
  countClosedBy: string
}

/** One release of a closed count. `kind` is `Seeded` or `ByHand`. */
export interface StoreCountRelease {
  id: string
  storeCode: string
  inventoryDate: string
  countClosedAt: string
  countClosedBy: string
  kind: string
  releasedBy: string
  releasedAt: string
  why: string
}

/** What "count closed" did. */
export interface StoreCountCloseResult {
  store: string
  stage: string
  released: boolean
  batchRows: number
  seedRefusal: string | null
  /** The seed had not ended when Stock Visibility answered: it runs on there, and the count stays closed. */
  seedRunning?: boolean
  /** The seed was refused for a sale still on its way to SAP (`seedRefusal` says which), and the count was opened again. */
  reopened?: boolean
}

/** `GET StoreStage/{store}/Seed`: the store's seed as Stock Visibility last ran it, and what this read settled. */
export interface StoreSeedStatus {
  store: string
  /** `None` | `Running` | `Seeded` | `Refused` | `Failed`. */
  state: string
  kind: string
  reason: string
  askedAt: string | null
  endedAt: string | null
  batchRows: number
  /** The run answers the store's present closed count; false for a run an earlier closing asked. */
  ofThisClosing: boolean
  /** This read found the seed Seeded and released the store's count. */
  released: boolean
  /** This read found the seed refused for a sale still on its way to SAP, and opened the count again. */
  reopened: boolean
}

/** The hand release's body. */
export interface StoreCountReleaseRequest {
  why: string
}
