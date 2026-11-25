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
  StoreSeedStatus,
  StoreCountRelease,
  StoreCountReleaseRequest,
  StoreCountRow,
  StoreCountStartRequest,
  StoreGates,
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

  /**
   * Ticket 4261: `GET StoreStage/{store}/Gates` → the store's gates toward Blocking as a move would measure them now, store
   * and fleet apart (`BackOfficeScreen[StoreStage, 03]`). A read; Stock Visibility measures it afresh, which can take a while.
   */
  gates(store: string): Promise<StoreGates> {
    return api.get<StoreGates>(`StoreStage/${encodeURIComponent(store)}/Gates`)
  },

  /**
   * `POST StoreStage/{store}/Move` → the store's stage after the move. A refused move is a business `ApiError`. A move to
   * Blocking carries `confirmed` and `waived` (ticket 4261); a waiver without `StoreBlockEarly:02` is refused
   * (`StageWaiveNotPermitted`) before Stock Visibility is asked.
   */
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

  /**
   * `GET StoreStage/{store}/Seed` → the store's seed as Stock Visibility last ran it. The seed runs on its own there and
   * may outlast "count closed"; the screen reads this while it runs. A read that finds this closing's seed ended settles
   * the count on the server (released, or opened again), and says so.
   */
  seedStatus(store: string): Promise<StoreSeedStatus> {
    return api.get<StoreSeedStatus>(`StoreStage/${encodeURIComponent(store)}/Seed`)
  },

  /** `POST StoreStage/{store}/CountStarted` → the store's new open count row. Refusals (already under count, a future
   * day, an unknown store) are business `ApiError`s. */
  countStarted(store: string, request: StoreCountStartRequest): Promise<StoreCountRow> {
    return api.post<StoreCountRow>(`StoreStage/${encodeURIComponent(store)}/CountStarted`, request)
  },

  /** `POST StoreStage/{store}/CountCancelled` → an OPEN count cancelled, with a reason. A closed count is refused. */
  countCancelled(store: string, request: StoreCountReleaseRequest): Promise<boolean> {
    return api.post<boolean>(`StoreStage/${encodeURIComponent(store)}/CountCancelled`, request)
  },

  /** Ticket 3898: `POST StoreStage/{store}/Release` → a closed count released by hand. A refusal is a business `ApiError`. */
  release(store: string, request: StoreCountReleaseRequest): Promise<boolean> {
    return api.post<boolean>(`StoreStage/${encodeURIComponent(store)}/Release`, request)
  },
}
