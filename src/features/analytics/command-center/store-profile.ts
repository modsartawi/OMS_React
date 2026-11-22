/**
 * The store profile's pure half (oms 948, BackOffice spec 4165 "The store profile"; BO 4177): the URL ⇄ the request,
 * and the server query the read and the export share. The route names the pharmacy (`STORE_PROFILE_PATTERN`); the
 * query string names the period and the language, written and read back by `@/core/command-center-routes`
 * (`periodOf`, `withPeriod`), so every link into the page and every period change land on the same request.
 */
import { langOf, periodOf, periodPairs, type CcPeriodChoice } from '@/core/command-center-routes'
import type { CcLang } from '@/core/models/command-center'

/** What the page asks the server for. */
export type StoreProfileRequest = CcPeriodChoice & { storeCode: string; lang: CcLang }

/** The request a URL names: the route's pharmacy, the query's period (none named: the rolling 4 weeks) and language. */
export function storeRequestOf(route: { storeCode?: string }, params: URLSearchParams): StoreProfileRequest {
  return { storeCode: route.storeCode ?? '', ...(periodOf(params) ?? { period: 'rolling4' }), lang: langOf(params.get('lang')) }
}

/** The server's query (BO 4177), shared by the read and the export. The period is always named; dates send their ends. */
export function storeProfileParams(request: StoreProfileRequest): Record<string, string> {
  return { storeCode: request.storeCode, ...Object.fromEntries(periodPairs(request, false)), lang: request.lang }
}
