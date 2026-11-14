/**
 * The stage screen's server calls (BackOffice ticket 3899): SIS.Api's `StoreStage` routes over SIS.Stock 064. Cookie-only;
 * the reads behind `BackOfficeScreen[StoreStage, 03]`, the move behind `BackOfficeScreen[StoreStage, 02]`. The probe lives
 * in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. Only a missing list is read as
 * empty.
 */
import { api } from '@/core/api'
import type {
  StoreCountCloseResult,
  StoreCountRelease,
  StoreCountReleaseRequest,
  StoreCountRow,
  StoreStage,
  StoreStageMove,
  StoreStageMoveRequest,
} from '@/core/models/store-stage'

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

  /** Ticket 3898: `GET StoreStage/Counts` → every store under count, with the count's closing mark. */
  async counts(): Promise<StoreCountRow[]> {
    return (await api.get<StoreCountRow[] | null>('StoreStage/Counts')) ?? []
  },

  /** Ticket 3898: `GET StoreStage/{store}/Releases` → the store's releases of closed counts, newest first. */
  async releases(store: string): Promise<StoreCountRelease[]> {
    return (await api.get<StoreCountRelease[] | null>(`StoreStage/${encodeURIComponent(store)}/Releases`)) ?? []
  },

  /** Ticket 3898: `POST StoreStage/{store}/CountClosed` → what "count closed" did (a refused seed is in the answer). */
  countClosed(store: string): Promise<StoreCountCloseResult> {
    return api.post<StoreCountCloseResult>(`StoreStage/${encodeURIComponent(store)}/CountClosed`, {})
  },

  /** Ticket 3898: `POST StoreStage/{store}/Release` → a closed count released by hand. A refusal is a business `ApiError`. */
  release(store: string, request: StoreCountReleaseRequest): Promise<boolean> {
    return api.post<boolean>(`StoreStage/${encodeURIComponent(store)}/Release`, request)
  },
}
