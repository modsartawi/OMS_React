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
}

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
