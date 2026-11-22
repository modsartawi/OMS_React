/**
 * The store profile's pure half (oms 948, BackOffice spec 4165 "The store profile"; BO 4177): the URL ⇄ the request,
 * and the server query the read and the export share. The route names the pharmacy (`/store/:storeCode`); the query
 * string names the period and the language, as `storeProfileHref` (`@/core/command-center-routes`) writes them, so
 * every link into the page and every period change land on the same request.
 */
import { COMMAND_CENTER_PATH, categoryProfileHref, storeProfileHref } from '@/core/command-center-routes'
import type { CcLang, CcPeriodKind, CcTarget } from '@/core/models/command-center'
import { langOf } from './lang'

/** The router's pattern for the page (`app/router.tsx` registers it without the leading slash). */
export const STORE_PROFILE_PATTERN = `${COMMAND_CENTER_PATH}/store/:storeCode`

/** A period the reader can choose: the rolling 4 weeks, year-to-date, or two dates (both ends, local `YYYY-MM-DD`). */
export type StorePeriod = { period: 'rolling4' } | { period: 'ytd' } | { period: 'dates'; from: string; to: string }

/** What the page asks the server for. */
export type StoreProfileRequest = StorePeriod & { storeCode: string; lang: CcLang }

/** The period a query string names. Anything else — none, an unknown one, dates missing an end — is the rolling 4 weeks. */
export function periodOf(params: URLSearchParams): StorePeriod {
  const period = params.get('period')
  const from = params.get('from')
  const to = params.get('to')
  if (period === 'ytd') return { period: 'ytd' }
  if (period === 'dates' && from && to) return { period: 'dates', from, to }
  return { period: 'rolling4' }
}

/** The request a URL names: the route's pharmacy, the query's period and language. */
export function storeRequestOf(route: { storeCode?: string }, params: URLSearchParams): StoreProfileRequest {
  return { storeCode: route.storeCode ?? '', ...periodOf(params), lang: langOf(params.get('lang')) }
}

/** The same URL on another period, the language kept. The rolling 4 weeks are the default and name nothing. */
export function withPeriod(params: URLSearchParams, next: StorePeriod): URLSearchParams {
  const out = new URLSearchParams(params)
  for (const key of ['period', 'from', 'to']) out.delete(key)
  if (next.period !== 'rolling4') out.set('period', next.period)
  if (next.period === 'dates') {
    out.set('from', next.from)
    out.set('to', next.to)
  }
  return out
}

/** The server's query (BO 4177), shared by the read and the export. Dates send their two ends; the others none. */
export function storeProfileParams(request: StoreProfileRequest): Record<string, string> {
  const period: CcPeriodKind = request.period
  return {
    storeCode: request.storeCode,
    period,
    ...(request.period === 'dates' ? { from: request.from, to: request.to } : {}),
    lang: request.lang,
  }
}

/**
 * Where a cell's or a sentence's link goes on the store profile, in the page language: a category opens its category
 * profile already narrowed to this pharmacy (ticket 948, unless the server names another narrowing); a pharmacy opens
 * its own store profile.
 */
export const storeTargetHref =
  (storeCode: string, lang: CcLang) =>
  (target: CcTarget): string =>
    target.kind === 'category'
      ? categoryProfileHref({ level: target.level, code: target.code, scope: target.scope ?? { kind: 'store', storeCode }, lang })
      : storeProfileHref(target.storeCode, { lang })
