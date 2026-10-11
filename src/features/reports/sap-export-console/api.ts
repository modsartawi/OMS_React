/**
 * The SAP export console's server calls (BackOffice spec 2579; ticket 461 lands the store-day
 * read, 463–465 add theirs here). The access probe is `./access`, apart, so the menu that
 * imports it does not pull this module (and the wire and helpers behind it) into the main bundle.
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the envelope, the
 * error taxonomy and 401 are that module's. The shapes are the door contract's
 * (`@/core/models/sap-export`), and each read fills what an older door leaves out (`./wire`).
 *
 * ⚠️ BackOffice 2580–2585 are unbuilt: nothing here has met a real door. The drives stub every
 * call at `page.route`, in the contract's shapes; 466 is the live walk.
 */
import { keepPreviousData } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { StoreDay } from '@/core/models/sap-export'
import { storeDayParams, type StoreDayFilter } from './storeday-helpers'
import { normaliseStoreDay, type WireStoreDay } from './wire'

export const sapExportApi = {
  /**
   * `GET SapExport/StoreDay?code=&day=&label=&state=&page=&pageSize=` → one store-day,
   * classified live. Refusals: 404 `NO_STORE`, 400 `BAD_DAY` / `DAY_OUT_OF_WINDOW` /
   * `BAD_FILTER` / `BAD_PAGING`.
   */
  storeDay(code: string, day: string, filter: StoreDayFilter): Promise<StoreDay> {
    return api.get<WireStoreDay>('SapExport/StoreDay', storeDayParams(code, day, filter)).then(normaliseStoreDay)
  },
}

/**
 * The store-day read's query. The previous filter's rows stay drawn while the next one loads
 * (the page says so). Only ever the SAME store-day's: the page keys its view on the store-day,
 * so another store's or day's rows never stand in for this one's. A failed read draws none of
 * them (the page's call).
 */
export function storeDayQuery(code: string, day: string, filter: StoreDayFilter) {
  return {
    queryKey: ['reports', 'sap-export', 'store-day', code, day, filter] as const,
    queryFn: () => sapExportApi.storeDay(code, day, filter),
    placeholderData: keepPreviousData,
    // A refusal (an unknown store, a day out of the window) is an answer, not an outage.
    retry: false,
  }
}
