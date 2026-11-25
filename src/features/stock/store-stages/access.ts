/**
 * The stage screen's grants (BackOffice tickets 3899, 3898), read off the one permissions answer (oms 914). The server
 * checks each grant again on its door.
 */
import type { Permissions } from '@/core/permissions'

/** `StoreStage:03` — the screen. */
export const canOpenStoreStages = (p: Permissions): boolean => p.has('StoreStage:03')

/** `StoreStage:02` — the move form. */
export const canMoveStoreStage = (p: Permissions): boolean => p.has('StoreStage:02')

/** `StoreCountClose:02` — "count closed". */
export const canCloseStoreCount = (p: Permissions): boolean => p.has('StoreCountClose:02')

/** `StoreBlockEarly:02` (BackOffice ticket 4261, ADR 0145) — the waive tick beside each failing fleet gate on a move to
 * Blocking. The server checks it again before Stock Visibility is asked. */
export const canBlockStoreEarly = (p: Permissions): boolean => p.has('StoreBlockEarly:02')

/** `StoreCountStart:02` — "Start count" and "Cancel count" (the desktop SAP integration screen's Block / Unblock). */
export const canStartStoreCount = (p: Permissions): boolean => p.has('StoreCountStart:02')
