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

/** `GET StoreStage/Access`: the two grants of the screen. */
export interface StoreStageAccess {
  screenAllowed: boolean
  canMove: boolean
  /** Ticket 3898: `BackOfficeScreen[StoreCountClose, 02]`, "count closed". */
  canCloseCount?: boolean
}

/** One row of a store's stage log. `mover` is `Person`, `CountClosing` or `Seed`. */
export interface StoreStageMove {
  store: string
  from: string
  to: string
  mover: string
  /** The mover's user id as SIS.Stock logged it (the durable key), or a system mover's name. */
  who: string
  /**
   * Owner ruling 2026-11-15: the person's name from HQ's user directory, named by SIS.Api; `who` itself when the directory
   * does not know it (the seed, the sweep's `SIS.Api`, an old row). Show this, keep `who` beside it.
   */
  whoName: string
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
  /** The closer's user id (stored). */
  countClosedBy: string
  /** Owner ruling 2026-11-15: the closer's name; `countClosedBy` when unknown. */
  countClosedByName: string
}

/** One release of a closed count. `kind` is `Seeded` or `ByHand`. */
export interface StoreCountRelease {
  id: string
  storeCode: string
  inventoryDate: string
  countClosedAt: string
  countClosedBy: string
  countClosedByName: string
  kind: string
  releasedBy: string
  /** Owner ruling 2026-11-15: the releaser's name; `releasedBy` when unknown (the sweep's `SIS.Api`). */
  releasedByName: string
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
}

/** The hand release's body. */
export interface StoreCountReleaseRequest {
  why: string
}
