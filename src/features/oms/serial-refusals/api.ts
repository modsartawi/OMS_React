/**
 * The serial refusal report's server calls (ticket 573, BackOffice 3065). Every read is cookie-only and behind
 * `BackOfficeScreen[SerialRefusal, 03]`; each takes the range, the asking stores and the answer. The probe lives in
 * `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. The door's refusals are
 * `PICK-00301` (range over 92 days), `302` (reversed) and `303` (unknown answer), read by `refusalKey`.
 *
 * 🚩 The answers are passed through as sent — the screen never recomputes a count. Only a missing list is read as
 * empty, so a bare answer draws an empty grid, not a crash.
 */
import { api } from '@/core/api'
import type {
  SerialRefusalQuery,
  SerialRefusalReport,
  SerialRefusalRows,
  SerialRefusalRowsQuery,
  SerialRefusalTotals,
} from '@/core/models/serial-refusal'

const NO_TOTALS: SerialRefusalTotals = {
  refusals: 0,
  sold: 0,
  held: 0,
  sameStore: 0,
  crossStore: 0,
  unknownSale: 0,
  unknownStaff: 0,
  stores: 0,
  staff: 0,
  serials: 0,
}

export const serialRefusalApi = {
  /** `GET SerialRefusal/Report` → the totals and every section in one reply. */
  async report(query: SerialRefusalQuery): Promise<SerialRefusalReport> {
    const data = await api.get<Partial<SerialRefusalReport> | null>('SerialRefusal/Report', { ...query })
    return {
      asOf: data?.asOf ?? '',
      from: data?.from ?? query.from ?? '',
      to: data?.to ?? query.to ?? '',
      totals: { ...NO_TOTALS, ...(data?.totals ?? {}) },
      days: data?.days ?? [],
      stores: data?.stores ?? [],
      staff: data?.staff ?? [],
      articles: data?.articles ?? [],
      serials: data?.serials ?? [],
      heldBy: data?.heldBy ?? [],
      offenders: data?.offenders ?? [],
    }
  },

  /** `GET SerialRefusal/Rows` → the refusals behind a figure, newest first, at most 2000. */
  async rows(query: SerialRefusalRowsQuery): Promise<SerialRefusalRows> {
    const { noStaff, ...rest } = query
    const data = await api.get<Partial<SerialRefusalRows> | null>('SerialRefusal/Rows', {
      ...rest,
      ...(noStaff ? { noStaff: 'true' } : {}),
    })
    return {
      asOf: data?.asOf ?? '',
      from: data?.from ?? '',
      to: data?.to ?? '',
      truncated: data?.truncated === true,
      rows: data?.rows ?? [],
    }
  },
}
