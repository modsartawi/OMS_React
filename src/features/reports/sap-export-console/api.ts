/**
 * The SAP export console's server calls (BackOffice spec 2579; ticket 461 lands the store-day
 * read, 463 the fleet's two, 464 the store's two and the recompute, 465 adds its own). The access probe is `./access`, apart, so the menu that
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
import type {
  FleetStoreRow,
  FleetSummary,
  Paged,
  RecomputeRequest,
  RecomputeResponse,
  StoreDay,
  StoreDays,
  StoreDetail,
} from '@/core/models/sap-export'
import { fleetDoorParams, type FleetQuery } from './fleet-query'
import { storeDayParams, type StoreDayFilter } from './storeday-helpers'
import {
  normaliseFleet,
  normaliseFleetSummary,
  normaliseStore,
  normaliseStoreDay,
  normaliseStoreDays,
  type WireFleet,
  type WireFleetSummary,
  type WireStoreDay,
  type WireStoreDays,
  type WireStoreDetail,
} from './wire'

export const sapExportApi = {
  /**
   * `GET SapExport/StoreDay?code=&day=&label=&state=&page=&pageSize=` → one store-day,
   * classified live. Refusals: 404 `NO_STORE`, 400 `BAD_DAY` / `DAY_OUT_OF_WINDOW` /
   * `BAD_FILTER` / `BAD_PAGING`.
   */
  storeDay(code: string, day: string, filter: StoreDayFilter): Promise<StoreDay> {
    return api.get<WireStoreDay>('SapExport/StoreDay', storeDayParams(code, day, filter)).then(normaliseStoreDay)
  },

  /** `GET SapExport/Fleet/Summary` → the tiles and the fleet's oldest rollup stamp (2584). */
  fleetSummary(): Promise<FleetSummary> {
    return api.get<WireFleetSummary>('SapExport/Fleet/Summary').then(normaliseFleetSummary)
  },

  /**
   * `GET SapExport/Fleet?label=&rail=&state=&q=&sort=&page=&pageSize=` → one page of stores, from
   * the rollup (2584). Refusals: 400 `BAD_FILTER` / `BAD_PAGING`.
   */
  fleet(query: FleetQuery): Promise<Paged<FleetStoreRow>> {
    return api.get<WireFleet>('SapExport/Fleet', fleetDoorParams(query)).then(normaliseFleet)
  },

  /** `GET SapExport/Store?code=` → the store's row and its export facts, from the rollup (2584). Refusal: 404 `NO_STORE`. */
  store(code: string): Promise<StoreDetail> {
    return api.get<WireStoreDetail>('SapExport/Store', { code }).then(normaliseStore)
  },

  /** `GET SapExport/Store/Days?code=` → one day per day of the window, oldest first (2584). Refusal: 404 `NO_STORE`. */
  storeDays(code: string): Promise<StoreDays> {
    return api.get<WireStoreDays>('SapExport/Store/Days', { code }).then(normaliseStoreDays)
  },

  /**
   * `POST SapExport/Recompute` `{ code, day? }` — the console's ONE write: it re-judges the store's
   * rollup (one day, or the whole window without `day`) and never touches export data. Refusals:
   * 400 `BAD_REQUEST` / `BAD_DAY` / `DAY_OUT_OF_WINDOW`, 404 `NO_STORE`.
   */
  recompute(body: RecomputeRequest): Promise<RecomputeResponse> {
    return api.post<RecomputeResponse>('SapExport/Recompute', body)
  },
}

/** Every read of one store's rollup (its header and its strip): what a recompute re-reads. */
export const storeKey = (code: string) => ['reports', 'sap-export', 'store', code] as const

/** The fleet's reads, which a recompute also moves. */
export const FLEET_KEY = ['reports', 'sap-export', 'fleet'] as const

/** One store's live store-day reads (every day, every filter). */
export const storeDayKey = (code: string) => ['reports', 'sap-export', 'store-day', code] as const

/** The fleet page refetches its tiles and its list every minute (ticket 463). */
export const FLEET_REFETCH_MS = 60_000

/** The fleet tiles' query, refetched every minute. */
export function fleetSummaryQuery() {
  return {
    queryKey: [...FLEET_KEY, 'summary'] as const,
    queryFn: () => sapExportApi.fleetSummary(),
    refetchInterval: FLEET_REFETCH_MS,
  }
}

/**
 * The fleet list's query, refetched every minute. The previous query's page stays drawn while the
 * next one loads; a failed read draws none of it (the page's call). A refusal (`BAD_FILTER`) is an
 * answer, not an outage, so it is not retried.
 */
export function fleetStoresQuery(query: FleetQuery) {
  return {
    queryKey: [...FLEET_KEY, 'stores', query] as const,
    queryFn: () => sapExportApi.fleet(query),
    placeholderData: keepPreviousData,
    refetchInterval: FLEET_REFETCH_MS,
    retry: false,
  }
}

/** The store page's header. An unknown store (`NO_STORE`) is an answer, not an outage. */
export function storeQuery(code: string) {
  return {
    queryKey: [...storeKey(code), 'head'] as const,
    queryFn: () => sapExportApi.store(code),
    retry: false,
  }
}

/** The store page's 30-day strip. */
export function storeDaysQuery(code: string) {
  return {
    queryKey: [...storeKey(code), 'days'] as const,
    queryFn: () => sapExportApi.storeDays(code),
    retry: false,
  }
}

/**
 * The store-day read's query. The previous filter's rows stay drawn while the next one loads
 * (the page says so). Only ever the SAME store-day's: the page keys its view on the store-day,
 * so another store's or day's rows never stand in for this one's. A failed read draws none of
 * them (the page's call).
 */
export function storeDayQuery(code: string, day: string, filter: StoreDayFilter) {
  return {
    queryKey: [...storeDayKey(code), day, filter] as const,
    queryFn: () => sapExportApi.storeDay(code, day, filter),
    placeholderData: keepPreviousData,
    // A refusal (an unknown store, a day out of the window) is an answer, not an outage.
    retry: false,
  }
}
