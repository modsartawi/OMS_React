/**
 * Every Analytics door (spec 766 §C — PROPOSED, owned by BackOffice 3378), through `@/core/api`, wrapped
 * in TanStack Query at the Page. Each answer is read through `./wire`, so an absent array is empty.
 *
 * The probe lives in `./access` (the menu imports it eagerly). Later slices add their doors here:
 * the item writes (778, 779); 776's in-place `PUT` and `…/Copy` are here. `Items` landed with 770.
 */
import { api, ApiError, type FileResponse } from '@/core/api'
import type {
  AnalyticsAudienceCandidates,
  AnalyticsBoard,
  AnalyticsHealth,
  AnalyticsItem,
  AnalyticsItemCopy,
  AnalyticsItemAudience,
  AnalyticsItemCreate,
  AnalyticsItemReassign,
  AnalyticsItemRevert,
  AnalyticsItemRevision,
  AnalyticsItemShare,
  AnalyticsItemUpdate,
  AnalyticsMember,
  AnalyticsModel,
  AnalyticsQueryInput,
  AnalyticsQueryResult,
  AnalyticsReport,
  AnalyticsReportRun,
  AnalyticsReportWords,
  AnalyticsReportWordsRequest,
  AnalyticsRevision,
  AnalyticsSchedule,
  AnalyticsScheduleWrite,
} from '@/core/models/analytics'
import { readCandidates } from './audience'
import { readHealth } from './health'
import { itemsQuery, type ItemsQuery } from './home'
import { readRevisions } from './revisions'
import { readRun, readRuns, readSchedule, readSchedules } from './schedule'
import { readBoard, readItem, readItems, readMembers, readModel, readReport, readResult, readWords } from './wire'

export const ANALYTICS_MODEL_KEY = ['analytics', 'model'] as const
export const ANALYTICS_ITEMS_KEY = ['analytics', 'items'] as const
/** The Items list as narrowed (`./home` `itemsQuery`); every list entry sits under `ANALYTICS_ITEMS_KEY`. */
export const analyticsItemsKey = (q: ItemsQuery) => [...ANALYTICS_ITEMS_KEY, q] as const
export const analyticsItemKey = (id: string) => ['analytics', 'item', id] as const
/** A board, read as a board: apart from `analyticsItemKey`, whose entries are read as views. */
export const analyticsBoardKey = (id: string) => ['analytics', 'board', id] as const
/** 827: a report, read as a report (its sections and parameters). */
export const analyticsReportKey = (id: string) => ['analytics', 'report', id] as const
/** 827: one run's live figures and summary — keyed by the revision and every value, so a value change asks again. */
export const analyticsWordsKey = (id: string, body: AnalyticsReportWordsRequest) => ['analytics', 'words', id, body] as const
/** An item's last 20 revisions (779). */
export const analyticsRevisionsKey = (id: string) => ['analytics', 'revisions', id] as const
/** 826: the share dialog's candidates for a search (roles and analytics users). */
export const analyticsAudienceCandidatesKey = (search: string, reportId?: string) => ['analytics', 'audienceCandidates', search, ...(reportId ? [reportId] : [])] as const
/** 833: a report's schedules, and its kept runs. */
export const analyticsSchedulesKey = (reportId: string) => ['analytics', 'schedules', reportId] as const
export const analyticsRunsKey = (reportId: string) => ['analytics', 'runs', reportId] as const
export const analyticsMembersKey = (dimension: string, search: string) => ['analytics', 'members', dimension, search] as const
/** A panel's query key — the query input itself, so the same input is the same entry. */
export const analyticsQueryKey = (input: AnalyticsQueryInput) => ['analytics', 'query', input] as const
/** The analytics status card (785). */
export const ANALYTICS_HEALTH_KEY = ['analytics', 'health'] as const

/** 827: an item read as a report that is not one (a view, a board, a CTO demo id) is the report's not-found. */
const notAReport = () => new ApiError('business', 'Not a report.', 404, [{ errorCode: 'ANALYTICS-404', internalErrorCode: '', errorMessage: 'Not a report.' }])

export const analyticsApi = {
  /** `GET Analytics/Health` (BackOffice 3386, curators only): how Cube and the dbt runs are going. */
  async health(): Promise<AnalyticsHealth> {
    return readHealth(await api.get<Record<string, unknown>>('Analytics/Health'))
  },
  /** `GET Analytics/Model` — the catalogue: areas, measures and dimensions, labelled in en and ar. */
  async model(): Promise<AnalyticsModel> {
    return readModel(await api.get<Record<string, unknown>>('Analytics/Model'))
  },
  /**
   * `GET Analytics/Items` — the items the caller may read (ticket 770), narrowed by §C's `kind`, `tier` and
   * `search` where the caller has them (`itemsQuery`). The screens still group and filter what comes back.
   */
  async items(q: ItemsQuery = {}): Promise<AnalyticsItem[]> {
    return readItems(await api.get<unknown>('Analytics/Items', { ...itemsQuery(q) }))
  },
  /** `GET Analytics/Item/{id}` — a view or a board. `ANALYTICS-404` when it is gone. */
  async item(id: string): Promise<AnalyticsItem> {
    return readItem(await api.get<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}`))
  },
  /** `GET Analytics/Item/{id}` read as a board (ticket 771): its panels and saved filters. */
  async board(id: string): Promise<AnalyticsBoard> {
    return readBoard(await api.get<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}`))
  },
  /**
   * 827: `GET Analytics/Item/{id}` read as a report (spec 819 §C, ⚠ proposed): `kind: 'report'`, its parameters,
   * bindings and sections. The CTO demo's frozen `Analytics/Report/{id}` is gone; an id that is not a report's is
   * not found.
   */
  async report(id: string): Promise<AnalyticsReport> {
    const raw = await api.get<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}`)
    if (raw?.kind !== 'report') throw notAReport()
    return readReport(raw)
  },
  /**
   * 827: `POST Analytics/Report/{id}/Words` with `{ revision, values }` (spec 819 §C, ⚠ proposed) — the run's live
   * figures, filled and formatted by the server, and the summary (number-checked against the run) or why it is
   * unavailable.
   */
  async words(id: string, body: AnalyticsReportWordsRequest): Promise<AnalyticsReportWords> {
    return readWords(await api.post<unknown>(`Analytics/Report/${encodeURIComponent(id)}/Words`, body))
  },
  /** `GET Analytics/DimensionValues` — up to 50 members of `dimension` matching `search` (store, city, region). */
  async dimensionValues(dimension: string, search: string): Promise<AnalyticsMember[]> {
    return readMembers(await api.get<unknown>('Analytics/DimensionValues', { dimension, search }))
  },
  /** `POST Analytics/Query` — one panel's answer. */
  async query(input: AnalyticsQueryInput): Promise<AnalyticsQueryResult> {
    return readResult(await api.post<Record<string, unknown>>('Analytics/Query', input))
  },
  /**
   * `POST Analytics/Item` — creates the item as Personal to the caller (ticket 775). Answers the created
   * item. ⚠ §C names the door, not its body: `AnalyticsItemCreate` is the web's proposal.
   */
  async create(body: AnalyticsItemCreate): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>('Analytics/Item', body))
  },
  /**
   * `PUT Analytics/Item/{id}` with `baseRevision` — save in place (ticket 776). `ANALYTICS-403` when it is not
   * the caller's to edit, `ANALYTICS-405` when someone saved a newer revision (`./item-save` reads both).
   * Answers the saved item (read as a view's envelope; a board caller re-reads through `board(id)`).
   */
  async update(id: string, body: AnalyticsItemUpdate): Promise<AnalyticsItem> {
    return readItem(await api.put<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}`, body))
  },
  /** `POST Analytics/Item/{id}/Copy` — save as my copy (ticket 776): a Personal item recording its source. */
  async copy(id: string, body: AnalyticsItemCopy): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Copy`, body))
  },
  /** `GET Analytics/Item/{id}/Revisions` — the item's last 20 revisions, who and when (ticket 779). */
  async revisions(id: string): Promise<AnalyticsRevision[]> {
    return readRevisions(await api.get<unknown>(`Analytics/Item/${encodeURIComponent(id)}/Revisions`))
  },
  /**
   * `POST Analytics/Item/{id}/Revert` with `{ revision }` (ticket 779) — writes that revision's snapshot as a NEW
   * revision, so a revert is itself undone by reverting again. Answers the item at the new revision (read as a
   * view's envelope; a board caller re-reads through `board(id)`).
   */
  async revert(id: string, body: AnalyticsItemRevert): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Revert`, body))
  },
  /**
   * 778: `POST Analytics/Item/{id}/Share` / `…/Unshare` with `{ revision }` — the owner shows their item, or takes it
   * back (Personal ↔ Shared). Answers the item. ⚠ §C's `{ revision }` is read as the body of Copy, Share, Unshare and
   * Certify alike: the revision the screen showed. 826 (spec 819 §C): Share takes an `audience` too — everyone, or
   * roles and users. Unshare is unchanged (and a curator's unshare is the same door).
   */
  async share(id: string, body: AnalyticsItemShare): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Share`, body))
  },
  async unshare(id: string, body: AnalyticsItemRevision): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Unshare`, body))
  },
  /**
   * 778: `POST Analytics/Item/{id}/Certify` with `{ revision }`, on the SOURCE item — a curator freezes that
   * revision as a Certified copy (`certifiedFrom: id`) or, when the copy exists, writes it into the copy as one new
   * revision. ⚠ Answers the Certified copy. `ANALYTICS-402` without the curator grant.
   */
  async certify(id: string, body: AnalyticsItemRevision): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Certify`, body))
  },
  /** 778: `POST Analytics/Item/{id}/Uncertify` (no body) on the Certified item. ⚠ Answers the item, no longer Certified. */
  async uncertify(id: string): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Uncertify`, {}))
  },
  /**
   * 826: `PUT Analytics/Item/{id}/Audience` with `{ audience }` — the owner changes a Shared item's audience, or a
   * curator narrows it. Written to the item's history; NOT a definition revision, so no `baseRevision` and never
   * `ANALYTICS-405`. ⚠ Answers the item (proposed), at the same revision.
   */
  async setAudience(id: string, body: AnalyticsItemAudience): Promise<AnalyticsItem> {
    return readItem(await api.put<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Audience`, body))
  },
  /**
   * 826: `GET Analytics/AudienceCandidates` with `search` (a name or an employee id) — up to 50 authz roles (a
   * deleted one `removed`) and analytics users. Feeds the share dialog and the reassign picker.
   */
  async audienceCandidates(search: string, reportId?: string): Promise<AnalyticsAudienceCandidates> {
    // 833: with `reportId` (⚠ proposed) each user also says their address, the run grant and whether they sit in
    // that report's audience — the schedule editor's recipient filter (`./schedule`).
    return readCandidates(await api.get<unknown>('Analytics/AudienceCandidates', { search, reportId }))
  },
  /**
   * 826: `POST Analytics/Item/{id}/Reassign` with `{ owner }` (curators only) — hands the item to another author;
   * its audience and tier are kept. The new owner must hold author (the server judges). Answers the item.
   */
  async reassign(id: string, body: AnalyticsItemReassign): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}/Reassign`, body))
  },
  // ── 833: schedules and kept runs (spec 819 §C, ⚠ proposed). The owner and curators manage schedules. ──
  /** `GET Analytics/Report/{id}/Schedules` — the report's schedules, each with its suspension when suspended. */
  async schedules(reportId: string): Promise<AnalyticsSchedule[]> {
    return readSchedules(await api.get<unknown>(`Analytics/Report/${encodeURIComponent(reportId)}/Schedules`))
  },
  /** `POST …/Schedules` — `ANALYTICS-414` names each refused recipient (`refusedRecipients`). Answers the schedule. */
  async createSchedule(reportId: string, body: AnalyticsScheduleWrite): Promise<AnalyticsSchedule> {
    return readSchedule(await api.post<unknown>(`Analytics/Report/${encodeURIComponent(reportId)}/Schedules`, body))
  },
  /** `PUT …/Schedules/{sid}` — an edit, or enable / pause. `ANALYTICS-414` as on create. Answers the schedule. */
  async updateSchedule(reportId: string, sid: string, body: AnalyticsScheduleWrite): Promise<AnalyticsSchedule> {
    return readSchedule(await api.put<unknown>(`Analytics/Report/${encodeURIComponent(reportId)}/Schedules/${encodeURIComponent(sid)}`, body))
  },
  async deleteSchedule(reportId: string, sid: string): Promise<void> {
    await api.del<unknown>(`Analytics/Report/${encodeURIComponent(reportId)}/Schedules/${encodeURIComponent(sid)}`)
  },
  /** `POST …/Schedules/{sid}/SendNow` — sends the saved schedule at once (a test or a resend). Answers the kept run. */
  async sendNow(reportId: string, sid: string): Promise<AnalyticsReportRun> {
    return readRun(await api.post<unknown>(`Analytics/Report/${encodeURIComponent(reportId)}/Schedules/${encodeURIComponent(sid)}/SendNow`, {}))
  },
  /** `GET Analytics/Report/{id}/Runs` — the kept runs the caller may open (owner, curators, a run's own recipients). */
  async runs(reportId: string): Promise<AnalyticsReportRun[]> {
    return readRuns(await api.get<unknown>(`Analytics/Report/${encodeURIComponent(reportId)}/Runs`))
  },
  /** `GET Analytics/ReportRun/{runId}` — one run's record, kept for good. */
  async run(runId: string): Promise<AnalyticsReportRun> {
    return readRun(await api.get<unknown>(`Analytics/ReportRun/${encodeURIComponent(runId)}`))
  },
  /** `GET Analytics/ReportRun/{runId}/Html` or `/Pdf` — the artefact that was sent, for 90 days; then `410`. */
  runArtefact(runId: string, kind: 'Html' | 'Pdf'): Promise<FileResponse> {
    return api.blob(`Analytics/ReportRun/${encodeURIComponent(runId)}/${kind}`)
  },
  /** 778: `DELETE Analytics/Item/{id}`. A board that shows a deleted view keeps a "view removed" panel (404). */
  async remove(id: string): Promise<void> {
    await api.del<unknown>(`Analytics/Item/${encodeURIComponent(id)}`)
  },
}
