/**
 * The IDF priority screens' doors (BackOffice spec 3157; oms 619 lays the file out, 620–627 add theirs). SIS.Api
 * `IdfPriority/…`, on the usual envelope; times are local wall-clock (no `Z`). Shapes are the brief's
 * (`BackOffice/.issues/assets/3157-oms-react-idf-brief.md`); the BackOffice ticket that builds a door owns its
 * final spelling and 628 reconciles.
 *
 * 628 reconciled every door with the brief's `## Changes` (the doors as 3161–3169 built them; the payer key is the
 * insurer's customer id, `insurerCustomerId`). `tools/idf-stubs.mjs` mirrors those shapes for the drives. UNGATED like
 * the rest of the group: a session without the IDF view grant is answered a bare 403 and each page says "no access".
 *
 * ⚠️ To keep parallel slices merge-clean: add your doors and query factories under YOUR ticket's slot comment only
 * (the blank lines between slots keep the hunks apart). Keep your types and logic in your own file beside
 * `masters.ts` (e.g. `store-lists.ts`, `upload.ts`) and import them here.
 */
import { api, type FileResponse } from '@/core/api'
import { INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { IdfMaster, IdfMasterVersion } from './masters'
import { storeSetBody, type IdfStoreList, type IdfStoreListCreateBody, type IdfStoreListRenameBody } from './store-lists' // 620
import type { IdfException, IdfExceptionBody } from './exceptions' // 624
import { lookupDoorParams, type IdfLookupAnswer, type IdfLookupQuery } from './lookup' // 625
import type { IdfEventsPage } from './events' // 626
import { eventsDoorParams, filterDoorParams, type IdfEventsFilter, type IdfEventsQuery } from './events-filter' // 626, 627
import { uploadForm, type IdfUploadReport } from './upload' // 622
import type { IdfMasterBody } from './master-form' // 621
import type { IdfVersion } from './versions' // 623
import { reportOrEmpty, type IdfSwapReport } from './report' // 627
import { itemsDoorParams, type IdfEntriesPage, type IdfEntryRow, type IdfItemsQuery } from './items' // 643, 645
import type { IdfDraft, IdfDraftAddBody } from './draft' // 645
import type { IdfDraftGroupBody } from './draft' // 646
import { groupsDoorParams, type IdfGroup, type IdfGroupBody, type IdfGroupEditBody, type IdfGroupsPage, type IdfGroupsQuery } from './groups' // 652
import type { IdfGroupsImportReport, IdfGroupsImportResult } from './groups-import' // 653
import type { IdfChangesPage } from './changes' // 650
import { changesDoorParams, changesExportParams, type IdfChangesQuery } from './changes-filter' // 650
import type { IdfGeneralClearBody, IdfGeneralSetBody } from './general-edit' // 648

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
export const IDF_STORE_LISTS_KEY = [...IDF_KEY, 'store-lists'] as const
export const idfStoreListsApi = {
  /** `GET IdfPriority/store-lists` — every named list with its stores. */
  async lists(): Promise<IdfStoreList[]> {
    return (await api.get<IdfStoreList[] | null>(`${IDF_BASE}/store-lists`)) ?? []
  },
  /** `POST IdfPriority/store-lists` `{ code, nameEn, nameAr, storeCodes? }` — a new list (code: plain ASCII, ≤ 26, unique). */
  create(body: IdfStoreListCreateBody): Promise<IdfStoreList> {
    return api.post<IdfStoreList>(`${IDF_BASE}/store-lists`, body)
  },
  /** `PUT IdfPriority/store-lists/{id}` `{ nameEn, nameAr }` — rename; the code never changes. */
  rename(id: string, body: IdfStoreListRenameBody): Promise<IdfStoreList> {
    return api.put<IdfStoreList>(`${IDF_BASE}/store-lists/${encodeURIComponent(id)}`, body)
  },
  /** `PUT IdfPriority/store-lists/{id}/stores` `{ storeCodes }` — the whole set, replacing the old one. 3162 has no delete door. */
  saveStores(id: string, storeCodes: string[]): Promise<IdfStoreList> {
    return api.put<IdfStoreList>(`${IDF_BASE}/store-lists/${encodeURIComponent(id)}/stores`, storeSetBody(storeCodes))
  },
}
export function storeListsQuery() {
  return { queryKey: IDF_STORE_LISTS_KEY, queryFn: () => idfStoreListsApi.lists(), retry: false } as const
}

// 621 · master form — `idfMasterFormApi` (POST / PUT masters, 3161)
export const idfMasterFormApi = {
  /** `POST IdfPriority/masters` → the new master. Refused on an overlapping scope (3162), naming the clash. */
  create(body: IdfMasterBody): Promise<IdfMaster> {
    return api.post<IdfMaster>(`${IDF_BASE}/masters`, body)
  },
  /** `PUT IdfPriority/masters/{id}` → the master. Kind is fixed after create; the body still carries it. */
  edit(id: string, body: IdfMasterBody): Promise<IdfMaster> {
    return api.put<IdfMaster>(`${IDF_BASE}/masters/${encodeURIComponent(id)}`, body)
  },
}

// 622 · upload and publish — `idfUploadApi` (3161)
export const idfUploadApi = {
  /** `POST IdfPriority/masters/{id}/uploads` multipart `{ file }` → the row report. Publishes nothing. */
  upload(masterId: string, file: File): Promise<IdfUploadReport> {
    return api.upload<IdfUploadReport>(`${IDF_BASE}/masters/${encodeURIComponent(masterId)}/uploads`, uploadForm(file))
  },
  /** `POST …/uploads/{uploadId}/publish { note }` → the new live version. Refused unless the upload's `ok`. */
  publish(masterId: string, uploadId: string, note: string): Promise<IdfMasterVersion> {
    return api.post<IdfMasterVersion>(
      `${IDF_BASE}/masters/${encodeURIComponent(masterId)}/uploads/${encodeURIComponent(uploadId)}/publish`,
      { note },
    )
  },
}

// 623 · versions and restore — `idfVersionsApi` (3161)
export const IDF_VERSIONS_KEY = [...IDF_KEY, 'versions'] as const
export const idfVersionsApi = {
  /** `GET IdfPriority/masters/{id}/versions` — every version of the master, the live one marked. */
  async versions(masterId: string): Promise<IdfVersion[]> {
    return (await api.get<IdfVersion[] | null>(`${IDF_BASE}/masters/${encodeURIComponent(masterId)}/versions`)) ?? []
  },
  /** `POST …/versions/{versionId}/restore { note }` → the NEW live version; the restored one is left as it was. */
  restore(masterId: string, versionId: string, note: string): Promise<IdfMasterVersion> {
    return api.post<IdfMasterVersion>(
      `${IDF_BASE}/masters/${encodeURIComponent(masterId)}/versions/${encodeURIComponent(versionId)}/restore`,
      { note },
    )
  },
}
export function versionsQuery(masterId: string) {
  return { queryKey: [...IDF_VERSIONS_KEY, masterId] as const, queryFn: () => idfVersionsApi.versions(masterId), retry: false } as const
}

// 624 · exceptions — `idfExceptionsApi` (3166)
export const IDF_EXCEPTIONS_KEY = [...IDF_KEY, 'exceptions'] as const
/** 624 · `IdfPriority/exceptions` (3166). DELETE takes a JSON body `{ reason }` (3166 binds it `[FromBody]`) and answers `{ exceptionId }`. */
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
  remove(id: string, reason: string): Promise<{ exceptionId: string }> {
    return api.delWithBody<{ exceptionId: string }>(`${IDF_BASE}/exceptions/${encodeURIComponent(id)}`, { reason })
  },
}
export function exceptionsQuery() {
  return { queryKey: IDF_EXCEPTIONS_KEY, queryFn: () => idfExceptionsApi.list(), retry: false } as const
}

// 625 · lookup — `idfLookupApi` (3168)
export const IDF_LOOKUP_KEY = [...IDF_KEY, 'lookup'] as const
export const idfLookupApi = {
  /**
   * `GET IdfPriority/lookup?item=&store=&payer=&documentType=&subDocumentType=&nphiesClaimType=` (3168, 3166) — "why
   * this priority". `payer` is the insurer's customer id; `buildQuery` drops every blank field.
   */
  lookup(q: IdfLookupQuery): Promise<IdfLookupAnswer> {
    return api.get<IdfLookupAnswer>(`${IDF_BASE}/lookup`, lookupDoorParams(q))
  },
}

export function lookupQuery(q: IdfLookupQuery) {
  return { queryKey: [...IDF_LOOKUP_KEY, q], queryFn: () => idfLookupApi.lookup(q), retry: false } as const
}

// 626 · events — `idfEventsApi` (3167)
export const IDF_EVENTS_KEY = [...IDF_KEY, 'events'] as const
export const idfEventsApi = {
  /** `GET IdfPriority/events?from&to&store&payer&masterId&outcome&page` (3167) — one page of the log, `{ page, pageSize, total, rows }`. */
  async events(q: IdfEventsQuery): Promise<IdfEventsPage> {
    const page = await api.get<IdfEventsPage | null>(`${IDF_BASE}/events`, eventsDoorParams(q))
    return { page: page?.page ?? q.page, pageSize: page?.pageSize ?? 0, total: page?.total ?? 0, rows: page?.rows ?? [] }
  },
}
export function eventsQuery(q: IdfEventsQuery) {
  return { queryKey: [...IDF_EVENTS_KEY, eventsDoorParams(q)] as const, queryFn: () => idfEventsApi.events(q), retry: false } as const
}

// 627 · swap report and export — `idfReportApi` (3169)
export const IDF_REPORT_KEY = [...IDF_KEY, 'swap-report'] as const
/** Both doors take the event log's SHARED filter (window, store, payer, master) — never its outcome or page. */
export const idfReportApi = {
  /** `GET IdfPriority/swap-report?from&to&store&payer&masterId` (3169) — `{ from, to, rows, totals }`, rows grouped master × store × payer. */
  async report(f: IdfEventsFilter): Promise<IdfSwapReport> {
    return reportOrEmpty(await api.get<IdfSwapReport | null>(`${IDF_BASE}/swap-report`, filterDoorParams(f)))
  },
  /** `GET IdfPriority/swap-report/export` (3169) — the server's `.xlsx` for the same filter. */
  export(f: IdfEventsFilter): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/swap-report/export`, filterDoorParams(f))
  },
}
export function swapReportQuery(f: IdfEventsFilter) {
  return { queryKey: [...IDF_REPORT_KEY, filterDoorParams(f)] as const, queryFn: () => idfReportApi.report(f), retry: false } as const
}

// 643 · a version's items — `idfEntriesApi` (3187)
export const IDF_ENTRIES_KEY = [...IDF_KEY, 'entries'] as const
export const idfEntriesApi = {
  /** `GET IdfPriority/masters/{masterId}/versions/{versionId}/entries?search&idf&page` (3187) — one page of that version's items. */
  async entries(masterId: string, versionId: string, q: IdfItemsQuery): Promise<IdfEntriesPage> {
    const path = `${IDF_BASE}/masters/${encodeURIComponent(masterId)}/versions/${encodeURIComponent(versionId)}/entries`
    const page = await api.get<IdfEntriesPage | null>(path, itemsDoorParams(q))
    return { page: page?.page ?? q.page, pageSize: page?.pageSize ?? 0, total: page?.total ?? 0, rows: page?.rows ?? [] }
  },
}
export function entriesQuery(masterId: string, versionId: string, q: IdfItemsQuery) {
  return {
    queryKey: [...IDF_ENTRIES_KEY, masterId, versionId, itemsDoorParams(q)] as const,
    queryFn: () => idfEntriesApi.entries(masterId, versionId, q),
    retry: false,
  } as const
}

// 644 · master export + template — `idfMasterFilesApi` (3188)
export const idfMasterFilesApi = {
  /** `GET IdfPriority/masters/{masterId}/versions/{versionId}/export` — that version (live or old) as `.xlsx` in the upload format. */
  export(masterId: string, versionId: string): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/masters/${encodeURIComponent(masterId)}/versions/${encodeURIComponent(versionId)}/export`)
  },
  /** `GET IdfPriority/masters/template` — the upload's header, no rows. */
  template(): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/masters/template`)
  },
}

// 645 · draft (3189) — `idfDraftApi`
export const IDF_DRAFT_KEY = [...IDF_KEY, 'draft'] as const
/** The base version's rows are read this many a page (the server may cap it lower; the loop follows `total`). */
export const IDF_DRAFT_BASE_PAGE_SIZE = 500
const draftPath = (masterId: string) => `${IDF_BASE}/masters/${encodeURIComponent(masterId)}/draft`
export const idfDraftApi = {
  /** `GET …/masters/{id}/draft` — the open draft with every row, or null when none. */
  async draft(masterId: string): Promise<IdfDraft | null> {
    return (await api.get<IdfDraft | null>(draftPath(masterId))) ?? null
  },
  /** `POST …/draft` — copies the live items into a new draft. Refused while one is open (`data { by, changedAt }`). */
  start(masterId: string): Promise<IdfDraft | null> {
    return api.post<IdfDraft | null>(draftPath(masterId), {})
  },
  /** `POST …/draft/items { itemNumber, idfNumber, priority }` — refused with `data { rule, messageEn, messageAr }`. */
  add(masterId: string, body: IdfDraftAddBody): Promise<unknown> {
    return api.post<unknown>(`${draftPath(masterId)}/items`, body)
  },
  /** `PUT …/draft/items/{itemNumber} { priority }`. */
  reRank(masterId: string, itemNumber: string, priority: number): Promise<unknown> {
    return api.put<unknown>(`${draftPath(masterId)}/items/${encodeURIComponent(itemNumber)}`, { priority })
  },
  /** `DELETE …/draft/items/{itemNumber}`. */
  remove(masterId: string, itemNumber: string): Promise<unknown> {
    return api.del<unknown>(`${draftPath(masterId)}/items/${encodeURIComponent(itemNumber)}`)
  },
  /** `POST …/draft/publish { note }` → the new live version. Refused while the draft is stale. */
  publish(masterId: string, note: string): Promise<IdfMasterVersion> {
    return api.post<IdfMasterVersion>(`${draftPath(masterId)}/publish`, { note })
  },
  /** `DELETE …/draft` — discards it (anyone with the edit grant; recorded). */
  discard(masterId: string): Promise<unknown> {
    return api.del<unknown>(draftPath(masterId))
  },
  /**
   * Every row of the version a draft was copied from, for the draft diff: the entries door (3187) page after page
   * until `total` (or an empty page). ⚠️ 654: replace with the draft door's own per-row marks if 3189 adds them.
   */
  async baseRows(masterId: string, versionId: string): Promise<IdfEntryRow[]> {
    const path = `${IDF_BASE}/masters/${encodeURIComponent(masterId)}/versions/${encodeURIComponent(versionId)}/entries`
    const rows: IdfEntryRow[] = []
    for (let page = 1; ; page += 1) {
      const got = await api.get<IdfEntriesPage | null>(path, { page: String(page), pageSize: String(IDF_DRAFT_BASE_PAGE_SIZE) })
      const batch = got?.rows ?? []
      rows.push(...batch)
      if (batch.length === 0 || rows.length >= (got?.total ?? 0)) return rows
    }
  },
}
export function draftQuery(masterId: string) {
  return { queryKey: [...IDF_DRAFT_KEY, masterId] as const, queryFn: () => idfDraftApi.draft(masterId), retry: false } as const
}
/** The base rows live under the entries key, so a publish's `IDF_KEY` invalidation refreshes them too. */
export function draftBaseQuery(masterId: string, versionId: string) {
  return { queryKey: [...IDF_ENTRIES_KEY, masterId, versionId, 'all'] as const, queryFn: () => idfDraftApi.baseRows(masterId, versionId), retry: false } as const
}

// 646 · draft owner, rebase, add a group (3190) — `idfDraftOwnerApi`
export const idfDraftOwnerApi = {
  /** `POST …/draft/rebase` — re-applies the draft's edits on the current live version. The answer is not specced; refetch. */
  rebase(masterId: string): Promise<unknown> {
    return api.post<unknown>(`${draftPath(masterId)}/rebase`, {})
  },
  /**
   * `POST …/draft/groups { idfNumber, priority }` — every member of the group, each checked as an add; answers the draft
   * plus `{ added, rows: [{ itemNumber, rule, messageEn, messageAr }] }` (read it with `groupAddResult`).
   */
  addGroup(masterId: string, body: IdfDraftGroupBody): Promise<unknown> {
    return api.post<unknown>(`${draftPath(masterId)}/groups`, body)
  },
}

// 647 · general master items — `idfGeneralApi` (3191). 648–651 key their reads under `IDF_GENERAL_KEY` (650's change
// log as `IDF_GENERAL_CHANGES_KEY`) so a general write can invalidate the general master alone.
export const IDF_GENERAL_KEY = [...IDF_KEY, 'general'] as const
export const IDF_GENERAL_ITEMS_KEY = [...IDF_GENERAL_KEY, 'items'] as const
export const idfGeneralApi = {
  /** `GET IdfPriority/general/items?search&idf&page` (3191) — one page of the general master's items (643's shape). */
  async items(q: IdfItemsQuery): Promise<IdfEntriesPage> {
    const page = await api.get<IdfEntriesPage | null>(`${IDF_BASE}/general/items`, itemsDoorParams(q))
    return { page: page?.page ?? q.page, pageSize: page?.pageSize ?? 0, total: page?.total ?? 0, rows: page?.rows ?? [] }
  },
}
export function generalItemsQuery(q: IdfItemsQuery) {
  return {
    queryKey: [...IDF_GENERAL_ITEMS_KEY, itemsDoorParams(q)] as const,
    queryFn: () => idfGeneralApi.items(q),
    retry: false,
  } as const
}

// 648 · set / clear one general item (3192). Both apply at once; the caller invalidates `IDF_GENERAL_KEY`.
export const idfGeneralEditApi = {
  /** `PUT IdfPriority/general/items/{itemNumber} { idfNumber, priority, reason }` — set or re-rank one item. */
  set(itemNumber: string, body: IdfGeneralSetBody): Promise<unknown> {
    return api.put<unknown>(`${IDF_BASE}/general/items/${encodeURIComponent(itemNumber)}`, body)
  },
  /** `DELETE IdfPriority/general/items/{itemNumber} { reason }` — the reason in the BODY. */
  clear(itemNumber: string, reason: string): Promise<unknown> {
    const body: IdfGeneralClearBody = { reason }
    return api.delWithBody<unknown>(`${IDF_BASE}/general/items/${encodeURIComponent(itemNumber)}`, body)
  },
}

// 649 · general upload → preview → apply (3193)

// 650 · general change log — `idfChangesApi` (3194)
export const IDF_GENERAL_CHANGES_KEY = [...IDF_GENERAL_KEY, 'changes'] as const
export const idfChangesApi = {
  /** `GET IdfPriority/general/changes?item&idf&user&from&to&page` (3194) — one page of the log, newest first. */
  async changes(q: IdfChangesQuery): Promise<IdfChangesPage> {
    const page = await api.get<IdfChangesPage | null>(`${IDF_BASE}/general/changes`, changesDoorParams(q))
    return { page: page?.page ?? q.page, pageSize: page?.pageSize ?? 0, total: page?.total ?? 0, rows: page?.rows ?? [] }
  },
  /** `GET IdfPriority/general/changes/export` (3194) — the server's `.xlsx` of the filtered rows (no page). */
  export(q: IdfChangesQuery): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/general/changes/export`, changesExportParams(q))
  },
}
export function generalChangesQuery(q: IdfChangesQuery) {
  return { queryKey: [...IDF_GENERAL_CHANGES_KEY, changesDoorParams(q)] as const, queryFn: () => idfChangesApi.changes(q), retry: false } as const
}

// 651 · general export + template — `idfGeneralFilesApi` (3195)
export const idfGeneralFilesApi = {
  /** `GET IdfPriority/general/export` — the whole general master as `.xlsx`. */
  export(): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/general/export`)
  },
  /** `GET IdfPriority/general/template` — the general upload's header, no rows. */
  template(): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/general/template`)
  },
}

// 652 · IDF groups — `idfGroupsApi` (BackOffice 3196; spec 3185 sketch, 654 reconciles)
export const IDF_GROUPS_KEY = [...IDF_KEY, 'groups'] as const
export const idfGroupsApi = {
  /** `GET IdfPriority/groups?search=&page=` — one page of groups, `{ page, pageSize, total, rows }`, each with its item count. */
  async list(q: IdfGroupsQuery): Promise<IdfGroupsPage> {
    const page = await api.get<IdfGroupsPage | null>(`${IDF_BASE}/groups`, groupsDoorParams(q))
    return { page: page?.page ?? q.page, pageSize: page?.pageSize ?? 0, total: page?.total ?? 0, rows: page?.rows ?? [] }
  },
  /** `POST IdfPriority/groups { idfNumber, description, dosageForm }`. */
  add(body: IdfGroupBody): Promise<IdfGroup> {
    return api.post<IdfGroup>(`${IDF_BASE}/groups`, body)
  },
  /** `PUT IdfPriority/groups/{idfNumber} { description, dosageForm }` — the number never changes. */
  edit(idfNumber: string, body: IdfGroupEditBody): Promise<IdfGroup> {
    return api.put<IdfGroup>(`${IDF_BASE}/groups/${encodeURIComponent(idfNumber)}`, body)
  },
  /** `DELETE IdfPriority/groups/{idfNumber}` — refused while items point at it (`data.itemCount`). */
  remove(idfNumber: string): Promise<unknown> {
    return api.del<unknown>(`${IDF_BASE}/groups/${encodeURIComponent(idfNumber)}`)
  },
  /** `GET IdfPriority/groups/export` — every group as the server's `.xlsx`. */
  export(): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/groups/export`)
  },
  /** `GET IdfPriority/groups/template` — the import's header, no rows (653's Import uses it). */
  template(): Promise<FileResponse> {
    return api.blob(`${IDF_BASE}/groups/template`)
  },
}
export function groupsQuery(q: IdfGroupsQuery) {
  return { queryKey: [...IDF_GROUPS_KEY, groupsDoorParams(q)] as const, queryFn: () => idfGroupsApi.list(q), retry: false } as const
}

// 653 · IDF groups import — `idfGroupsImportApi` (BackOffice 3197; spec 3185 sketch, 654 reconciles)
export const idfGroupsImportApi = {
  /** `POST IdfPriority/groups/uploads` multipart `{ file }` → every row with its action, failing rows with their rule. Writes nothing. */
  async upload(file: File): Promise<IdfGroupsImportReport> {
    const r = await api.upload<IdfGroupsImportReport | null>(`${IDF_BASE}/groups/uploads`, uploadForm(file))
    return { uploadId: r?.uploadId ?? '', ok: r?.ok === true, rows: r?.rows ?? [] }
  },
  /** `POST …/groups/uploads/{uploadId}/apply` (no body stated; `{}`) → `{ added, updated }`. Refused unless the upload's `ok`. */
  apply(uploadId: string): Promise<IdfGroupsImportResult> {
    return api.post<IdfGroupsImportResult>(`${IDF_BASE}/groups/uploads/${encodeURIComponent(uploadId)}/apply`, {})
  },
}
