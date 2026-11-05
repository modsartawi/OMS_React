/**
 * Every Analytics door (spec 766 §C — PROPOSED, owned by BackOffice 3378), through `@/core/api`, wrapped
 * in TanStack Query at the Page. Each answer is read through `./wire`, so an absent array is empty.
 *
 * The probe lives in `./access` (the menu imports it eagerly). Later slices add their doors here:
 * the item writes (776, 778, 779). `Items` landed with 770.
 */
import { api } from '@/core/api'
import type {
  AnalyticsBoard,
  AnalyticsItem,
  AnalyticsItemCreate,
  AnalyticsMember,
  AnalyticsModel,
  AnalyticsQueryInput,
  AnalyticsQueryResult,
} from '@/core/models/analytics'
import { readBoard, readItem, readItems, readMembers, readModel, readResult } from './wire'

export const ANALYTICS_MODEL_KEY = ['analytics', 'model'] as const
export const ANALYTICS_ITEMS_KEY = ['analytics', 'items'] as const
export const analyticsItemKey = (id: string) => ['analytics', 'item', id] as const
/** A board, read as a board: apart from `analyticsItemKey`, whose entries are read as views. */
export const analyticsBoardKey = (id: string) => ['analytics', 'board', id] as const
export const analyticsMembersKey = (dimension: string, search: string) => ['analytics', 'members', dimension, search] as const
/** A panel's query key — the query input itself, so the same input is the same entry. */
export const analyticsQueryKey = (input: AnalyticsQueryInput) => ['analytics', 'query', input] as const

export const analyticsApi = {
  /** `GET Analytics/Model` — the catalogue: areas, measures and dimensions, labelled in en and ar. */
  async model(): Promise<AnalyticsModel> {
    return readModel(await api.get<Record<string, unknown>>('Analytics/Model'))
  },
  /**
   * `GET Analytics/Items` — every item the caller may read (ticket 770). No `kind`/`tier`/search params:
   * the home groups and searches the one list itself, so typing narrows it without a call per key.
   */
  async items(): Promise<AnalyticsItem[]> {
    return readItems(await api.get<unknown>('Analytics/Items'))
  },
  /** `GET Analytics/Item/{id}` — a view or a board. `ANALYTICS-404` when it is gone. */
  async item(id: string): Promise<AnalyticsItem> {
    return readItem(await api.get<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}`))
  },
  /** `GET Analytics/Item/{id}` read as a board (ticket 771): its panels and saved filters. */
  async board(id: string): Promise<AnalyticsBoard> {
    return readBoard(await api.get<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}`))
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
   * item. ⚠ §C names the door, not its body: `AnalyticsItemCreate` is the web's proposal. 776 adds the
   * in-place `PUT` and `…/Copy` beside it.
   */
  async create(body: AnalyticsItemCreate): Promise<AnalyticsItem> {
    return readItem(await api.post<Record<string, unknown>>('Analytics/Item', body))
  },
}
