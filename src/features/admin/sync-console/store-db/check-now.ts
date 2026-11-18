/**
 * Check now (oms 917, BackOffice 4032 door `POST StoreDatabase/CheckNow`): take a fresh reading of one store, on the
 * console's reason dialog. Pure — pinned by `check-now.test.ts`.
 */
import type { Permissions } from '@/core/permissions'
import type { StoreDbCheckNowBody } from '@/core/models/store-database'
import { canActStoreDb } from '../access'
import { cleanReason, reasonReady } from '../control-helpers'

/** Check now needs `StoreDatabase.Act` (beside View); without it the button is not drawn at all. */
export const checkNowVisible = (p: Permissions): boolean => canActStoreDb(p)

/** The door's body, the reason trimmed; `null` while the reason is empty — nothing is sent without one. */
export function checkNowBody(code: string, reason: string): StoreDbCheckNowBody | null {
  if (!reasonReady(reason)) return null
  return { code, reason: cleanReason(reason) }
}
