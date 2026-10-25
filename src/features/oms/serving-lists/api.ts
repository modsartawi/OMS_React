/**
 * The Serving lists screen's server calls (BackOffice spec 3042; door 3045 `ServingListWebEndpoints`, oms
 * tickets 567-571). Every `ServingListWeb/*` door is here; 567 calls only `lists()`. The probe
 * (`GET ServingListWeb/Access`) lives in `@/core/serving-list/access`, because the Dispatch board (572) reads
 * it too and a feature may not import another.
 *
 * Reads are Display 03, writes Execute 06; every write acts as the signed-in user (no body names the user)
 * and answers the list's `ServingListRow`. Refusals are `SVL-00001..09` (`SERVING_LIST_ERRORS`); a refused
 * batch add carries `{ badStoreCodes }` as `ApiError.data`.
 *
 * ⚠️ BackOffice 3045 is built on `spec3042`, not deployed: nothing here has met a real door.
 * `tools/serving-lists-drive.mjs` stubs every call in the shapes of `ServingListAdminModels.cs`.
 */
import { keepPreviousData } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  ServingListAddStoresRequest,
  ServingListChangeRow,
  ServingListCreateRequest,
  ServingListMemberRow,
  ServingListMembersFilter,
  ServingListNoteRequest,
  ServingListRenameRequest,
  ServingListRow,
  ServingListStoreEnabledRequest,
  ServingListStoreRow,
  ServingListStoreSearch,
} from '@/core/models/serving-list'

const BASE = 'ServingListWeb'
const list = (id: string) => `${BASE}/Lists/${encodeURIComponent(id)}`
const member = (id: string, storeCode: string) => `${list(id)}/Stores/${encodeURIComponent(storeCode)}`

export const servingListsApi = {
  // ── Reads (Display 03) ────────────────────────────────────────────────────────────────────────

  /** `GET ServingListWeb/Lists` — every list, by English name. */
  lists(): Promise<ServingListRow[]> {
    return api.get<ServingListRow[]>(`${BASE}/Lists`)
  },

  /** `GET ServingListWeb/Lists/{id}/Members?city=&enabled=&duty=` — by store code, no paging. */
  members(id: string, filter: ServingListMembersFilter = {}): Promise<ServingListMemberRow[]> {
    return api.get<ServingListMemberRow[]>(`${list(id)}/Members`, {
      city: filter.city,
      enabled: filter.enabled ?? undefined,
      duty: filter.duty,
    })
  },

  /** `GET ServingListWeb/Lists/{id}/Changes?take=` — newest first; take defaults to 200, at most 1000. */
  changes(id: string, take?: number): Promise<ServingListChangeRow[]> {
    return api.get<ServingListChangeRow[]>(`${list(id)}/Changes`, { take })
  },

  /** `GET ServingListWeb/Stores?search=&servingListId=&take=` — the add-stores picker, by code. */
  stores(q: ServingListStoreSearch = {}): Promise<ServingListStoreRow[]> {
    return api.get<ServingListStoreRow[]>(`${BASE}/Stores`, { search: q.search, servingListId: q.servingListId, take: q.take })
  },

  // ── Writes (Execute 06) ───────────────────────────────────────────────────────────────────────

  /** `POST ServingListWeb/Lists` — create. */
  create(body: ServingListCreateRequest): Promise<ServingListRow> {
    return api.post<ServingListRow>(`${BASE}/Lists`, body)
  },

  /** `PUT ServingListWeb/Lists/{id}/Name` — rename; the same names is a silent no-op. */
  rename(id: string, body: ServingListRenameRequest): Promise<ServingListRow> {
    return api.put<ServingListRow>(`${list(id)}/Name`, body)
  },

  /** `POST ServingListWeb/Lists/{id}/Deactivate` — succeeds even when a type points at it; `warning` names competed ones. */
  deactivate(id: string, body: ServingListNoteRequest = {}): Promise<ServingListRow> {
    return api.post<ServingListRow>(`${list(id)}/Deactivate`, body)
  },

  /** `POST ServingListWeb/Lists/{id}/Reactivate`. */
  reactivate(id: string, body: ServingListNoteRequest = {}): Promise<ServingListRow> {
    return api.post<ServingListRow>(`${list(id)}/Reactivate`, body)
  },

  /** `POST ServingListWeb/Lists/{id}/Stores` — batch add, enabled; one bad code refuses the batch. */
  addStores(id: string, body: ServingListAddStoresRequest): Promise<ServingListRow> {
    return api.post<ServingListRow>(`${list(id)}/Stores`, body)
  },

  /** `DELETE ServingListWeb/Lists/{id}/Stores/{storeCode}?note=` — remove; the log keeps it. */
  removeStore(id: string, storeCode: string, note?: string): Promise<ServingListRow> {
    return api.del<ServingListRow>(member(id, storeCode), { note })
  },

  /** `PUT ServingListWeb/Lists/{id}/Stores/{storeCode}/Enabled` — enable / disable. */
  setStoreEnabled(id: string, storeCode: string, body: ServingListStoreEnabledRequest): Promise<ServingListRow> {
    return api.put<ServingListRow>(`${member(id, storeCode)}/Enabled`, body)
  },
}

/** The lists read's key; 570's writes invalidate it. */
export const SERVING_LISTS_KEY = ['oms', 'serving-lists', 'lists'] as const

export function listsQuery() {
  return { queryKey: SERVING_LISTS_KEY, queryFn: () => servingListsApi.lists(), retry: false } as const
}

/**
 * The members read's key prefix (568). One list's members, whatever the filter, sit under
 * `[...SERVING_LIST_MEMBERS_KEY, id]` — a write on that list (569, 570) invalidates that prefix.
 */
export const SERVING_LIST_MEMBERS_KEY = ['oms', 'serving-lists', 'members'] as const

export function membersQuery(id: string, filter: ServingListMembersFilter) {
  return {
    queryKey: [...SERVING_LIST_MEMBERS_KEY, id, filter] as const,
    queryFn: () => servingListsApi.members(id, filter),
    placeholderData: keepPreviousData,
    retry: false,
  }
}
