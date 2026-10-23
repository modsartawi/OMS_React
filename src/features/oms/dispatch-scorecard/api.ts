/**
 * The dispatch scorecard's server calls (ticket 543, BackOffice 2965). Every read is cookie-only and
 * behind `BackOfficeScreen[DispatchScorecard, 03]`; each takes the range and the filters
 * (`from, to, type, channel, city, region, store`). The probe lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. The door's
 * refusals are `CALLOUT-301` (range over 92 days), `302` (reversed), `303` (unknown figure) and `304`
 * (store required), read by `refusalKey`.
 *
 * 🚩 The answers are passed through as sent — the screen never recomputes a rank or a median. Only a
 * missing list is read as empty, so a bare answer draws an empty grid, not a crash.
 */
import { api } from '@/core/api'
import type {
  DispatchScorecardCard,
  DispatchScorecardDrill,
  DispatchScorecardFigure,
  DispatchScorecardQuery,
  DispatchScorecardResult,
} from '@/core/models/dispatch-scorecard'

export const dispatchScorecardApi = {
  /** `GET DispatchScorecard/Grid` → stores and staff in one reply. */
  async grid(query: DispatchScorecardQuery): Promise<DispatchScorecardResult> {
    const data = await api.get<Partial<DispatchScorecardResult> | null>('DispatchScorecard/Grid', { ...query })
    return {
      asOf: data?.asOf ?? '',
      from: data?.from ?? query.from ?? '',
      to: data?.to ?? query.to ?? '',
      minimumBids: data?.minimumBids ?? 20,
      minimumAnswers: data?.minimumAnswers ?? 10,
      stores: data?.stores ?? [],
      staff: data?.staff ?? [],
    }
  },

  /** `GET DispatchScorecard/Drill` (+ `figure`, `staff`) → the bids behind one figure. */
  async drill(query: DispatchScorecardQuery, figure: DispatchScorecardFigure, staff: string): Promise<DispatchScorecardDrill> {
    const data = await api.get<Partial<DispatchScorecardDrill> | null>('DispatchScorecard/Drill', { ...query, figure, staff })
    return {
      asOf: data?.asOf ?? '',
      from: data?.from ?? '',
      to: data?.to ?? '',
      figure: data?.figure ?? figure,
      store: data?.store ?? query.store ?? '',
      staff: data?.staff ?? staff,
      rows: data?.rows ?? [],
    }
  },

  /** `GET DispatchScorecard/StoreCard` (`store` required) → the store's report card. */
  async storeCard(query: DispatchScorecardQuery): Promise<DispatchScorecardCard> {
    const data = await api.get<Partial<DispatchScorecardCard> | null>('DispatchScorecard/StoreCard', { ...query })
    return {
      asOf: data?.asOf ?? '',
      from: data?.from ?? '',
      to: data?.to ?? '',
      row: data?.row ?? null,
      measures: data?.measures ?? [],
      classes: data?.classes ?? [],
      staff: data?.staff ?? [],
    }
  },
}
