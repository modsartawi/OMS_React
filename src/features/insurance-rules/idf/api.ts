/**
 * The IDF priority screens' doors (BackOffice spec 3157; oms 619 lays the file out, 620–627 add theirs). SIS.Api
 * `IdfPriority/…`, on the usual envelope; times are local wall-clock (no `Z`). Shapes are the brief's
 * (`BackOffice/.issues/assets/3157-oms-react-idf-brief.md`); the BackOffice ticket that builds a door owns its
 * final spelling and 628 reconciles.
 *
 * ⚠️ Stubbed until oms 628 (`tools/idf-stubs.mjs`): no door here has met a real SIS.Api. UNGATED like the rest of
 * the group: a session without the IDF view grant is answered a bare 403 and each page says "no access".
 *
 * ⚠️ To keep parallel slices merge-clean: add your doors and query factories under YOUR ticket's slot comment only
 * (the blank lines between slots keep the hunks apart). Keep your types and logic in your own file beside
 * `masters.ts` (e.g. `store-lists.ts`, `upload.ts`) and import them here.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { IdfMaster } from './masters'
import type { IdfException, IdfExceptionBody } from './exceptions' // 624
import type { IdfLookupAnswer, IdfLookupQuery } from './lookup' // 625
import type { IdfEventsPage } from './events' // 626
import { eventsDoorParams, type IdfEventsQuery } from './events-filter' // 626

export const IDF_BASE = 'IdfPriority'
/** Every IDF query key starts here, so a write can invalidate the IDF screens at once. */
export const IDF_KEY = [...INSURANCE_RULES_KEY, 'idf'] as const
export const IDF_MASTERS_KEY = [...IDF_KEY, 'masters'] as const

// 619 · masters list
export const idfApi = {
  /** `GET IdfPriority/masters` (3161) — every master with its live version. */
  async masters(): Promise<IdfMaster[]> {
    return (await api.get<IdfMaster[] | null>(`${IDF_BASE}/masters`)) ?? []
  },
}

export function mastersQuery() {
  return { queryKey: IDF_MASTERS_KEY, queryFn: () => idfApi.masters(), retry: false } as const
}

// 620 · store lists — `idfStoreListsApi` (3162)

// 621 · master form — `idfMasterFormApi` (POST / PUT masters, 3161)

// 622 · upload and publish — `idfUploadApi` (3161)

// 623 · versions and restore — `idfVersionsApi` (3161)

// 624 · exceptions — `idfExceptionsApi` (3166)
export const IDF_EXCEPTIONS_KEY = [...IDF_KEY, 'exceptions'] as const
/**
 * 624 · `IdfPriority/exceptions` (3166). The brief gives DELETE a `{ reason }`; `api.del` takes no body (the estate's
 * DELETEs name their target on the query string), so the reason rides as `?reason=` — 628 reconciles with 3166.
 */
export const idfExceptionsApi = {
  async list(): Promise<IdfException[]> {
    return (await api.get<IdfException[] | null>(`${IDF_BASE}/exceptions`)) ?? []
  },
  add(body: IdfExceptionBody): Promise<IdfException> {
    return api.post<IdfException>(`${IDF_BASE}/exceptions`, body)
  },
  edit(id: string, body: IdfExceptionBody): Promise<IdfException> {
    return api.put<IdfException>(`${IDF_BASE}/exceptions/${encodeURIComponent(id)}`, body)
  },
  remove(id: string, reason: string): Promise<unknown> {
    return api.del<unknown>(`${IDF_BASE}/exceptions/${encodeURIComponent(id)}`, { reason })
  },
}
export function exceptionsQuery() {
  return { queryKey: IDF_EXCEPTIONS_KEY, queryFn: () => idfExceptionsApi.list(), retry: false } as const
}

// 625 · lookup — `idfLookupApi` (3168)
export const IDF_LOOKUP_KEY = [...IDF_KEY, 'lookup'] as const
export const idfLookupApi = {
  /** `GET IdfPriority/lookup?item=&store=&payer=&documentType=` (3168) — "why this priority". `buildQuery` drops a blank document type. */
  lookup(q: IdfLookupQuery): Promise<IdfLookupAnswer> {
    return api.get<IdfLookupAnswer>(`${IDF_BASE}/lookup`, { item: q.item, store: q.store, payer: q.payer, documentType: q.documentType })
  },
}

export function lookupQuery(q: IdfLookupQuery) {
  return { queryKey: [...IDF_LOOKUP_KEY, q], queryFn: () => idfLookupApi.lookup(q), retry: false } as const
}

// 626 · events — `idfEventsApi` (3167)
export const IDF_EVENTS_KEY = [...IDF_KEY, 'events'] as const
export const idfEventsApi = {
  /** `GET IdfPriority/events?from&to&store&payer&masterId&outcome&page` (3167) — one page of the log. */
  async events(q: IdfEventsQuery): Promise<IdfEventsPage> {
    const page = await api.get<IdfEventsPage | null>(`${IDF_BASE}/events`, eventsDoorParams(q))
    return page ?? { items: [], total: 0, page: q.page, pageSize: 0 }
  },
}
export function eventsQuery(q: IdfEventsQuery) {
  return { queryKey: [...IDF_EVENTS_KEY, eventsDoorParams(q)] as const, queryFn: () => idfEventsApi.events(q), retry: false } as const
}

// 627 · swap report and export — `idfReportApi` (3169)
