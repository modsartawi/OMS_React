/**
 * Every Analytics door (spec 766 §C — PROPOSED, owned by BackOffice 3378), through `@/core/api`, wrapped
 * in TanStack Query at the Page. Each answer is read through `./wire`, so an absent array is empty.
 *
 * The probe lives in `./access` (the menu imports it eagerly). Later slices add their doors here:
 * `DimensionValues` (771), `Items` (770), the item writes (776, 778, 779).
 */
import { api } from '@/core/api'
import type {
  AnalyticsItem,
  AnalyticsModel,
  AnalyticsQueryInput,
  AnalyticsQueryResult,
} from '@/core/models/analytics'
import { readItem, readModel, readResult } from './wire'

export const ANALYTICS_MODEL_KEY = ['analytics', 'model'] as const
export const analyticsItemKey = (id: string) => ['analytics', 'item', id] as const
/** A panel's query key — the query input itself, so the same input is the same entry. */
export const analyticsQueryKey = (input: AnalyticsQueryInput) => ['analytics', 'query', input] as const

export const analyticsApi = {
  /** `GET Analytics/Model` — the catalogue: areas, measures and dimensions, labelled in en and ar. */
  async model(): Promise<AnalyticsModel> {
    return readModel(await api.get<Record<string, unknown>>('Analytics/Model'))
  },
  /** `GET Analytics/Item/{id}` — a view or a board. `ANALYTICS-404` when it is gone. */
  async item(id: string): Promise<AnalyticsItem> {
    return readItem(await api.get<Record<string, unknown>>(`Analytics/Item/${encodeURIComponent(id)}`))
  },
  /** `POST Analytics/Query` — one panel's answer. */
  async query(input: AnalyticsQueryInput): Promise<AnalyticsQueryResult> {
    return readResult(await api.post<Record<string, unknown>>('Analytics/Query', input))
  },
}
