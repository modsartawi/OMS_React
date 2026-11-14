/**
 * The stage screen's server calls (BackOffice ticket 3899): SIS.Api's `StoreStage` routes over SIS.Stock 064. Cookie-only;
 * the reads behind `BackOfficeScreen[StoreStage, 03]`, the move behind `BackOfficeScreen[StoreStage, 02]`. The probe lives
 * in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. Only a missing list is read as
 * empty.
 */
import { api } from '@/core/api'
import type { StoreStage, StoreStageMove, StoreStageMoveRequest } from '@/core/models/store-stage'

export const storeStageApi = {
  /** `GET StoreStage` → each store's stage and its last move. */
  async list(): Promise<StoreStage[]> {
    return (await api.get<StoreStage[] | null>('StoreStage')) ?? []
  },

  /** `GET StoreStage/{store}/Moves` → the store's stage log, newest first. */
  async moves(store: string): Promise<StoreStageMove[]> {
    return (await api.get<StoreStageMove[] | null>(`StoreStage/${encodeURIComponent(store)}/Moves`)) ?? []
  },

  /** `POST StoreStage/{store}/Move` → the store's stage after the move. A refused move is a business `ApiError`. */
  move(store: string, request: StoreStageMoveRequest): Promise<StoreStage> {
    return api.post<StoreStage>(`StoreStage/${encodeURIComponent(store)}/Move`, request)
  },
}
