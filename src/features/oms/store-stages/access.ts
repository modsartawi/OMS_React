/**
 * The stage screen's access probe (BackOffice ticket 3899) — apart from `./api` so the OMS menu leaf, which imports it
 * eagerly, costs the main bundle only this.
 *
 * Through `@/core/api` like every call (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { StoreStageAccess } from '@/core/models/store-stage'

/** The ONE cache key the menu leaf and the page's gate share, so the probe costs one call. */
export const STORE_STAGE_ACCESS_KEY = ['oms', 'store-stages', 'access'] as const

/** The one set of options every reader passes: a refusal is an answer, and a grant does not change in a page life. */
export function storeStageAccessQuery() {
  return {
    queryKey: STORE_STAGE_ACCESS_KEY,
    queryFn: () => storeStageAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The screen opens on `screenAllowed === true`, so a malformed answer is a denial. */
export const canOpenStoreStages = (r: StoreStageAccess | null | undefined): boolean => r?.screenAllowed === true

/** The move form shows on `canMove === true`; the server checks the grant again on the move. */
export const canMoveStoreStage = (r: StoreStageAccess | null | undefined): boolean => r?.canMove === true

/** Ticket 3898: "count closed" shows on `canCloseCount === true`; the server checks the grant again. */
export const canCloseStoreCount = (r: StoreStageAccess | null | undefined): boolean => r?.canCloseCount === true

export const storeStageAccessApi = {
  /**
   * `GET StoreStage/Access` → `{ screenAllowed, canMove }`, cookie only, not grant-gated.
   *
   * 🚩 **Fails closed** — no 404-tolerant catch (`BackOfficeScreen[StoreStage, 03]` / `02`, roles `STORE_STAGE_VIEWER` /
   * `STORE_STAGE_MOVER`).
   */
  access(): Promise<StoreStageAccess> {
    return api.get<StoreStageAccess>('StoreStage/Access')
  },
}
