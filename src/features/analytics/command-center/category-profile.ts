/**
 * The category profile's pure half (oms 949, BackOffice spec 4165 "The category profile"; BO 4178): the URL ⇄ the
 * request, and the server query the read and the export share. The route names the depth and the category
 * (`CATEGORY_PROFILE_PATTERN`); the query string names the narrowing, the period and the language, written and read
 * back by `@/core/command-center-routes` (`scopeOf`, `periodOf`, `withScope`, `withPeriod`), so every link into the
 * page and every filter change land on the same request.
 */
import { langOf, periodOf, periodPairs, pickPeriod, scopeOf, type CcPeriodOption } from '@/core/command-center-routes'
import type { CcCategoryLevel, CcLang, CcScope } from '@/core/models/command-center'

/** What the page asks the server for. No period named: the server's default (the last four weeks). */
export type CategoryProfileRequest = {
  level: CcCategoryLevel
  code: string
  scope: CcScope
  lang: CcLang
} & CcPeriodOption

/** The request a URL names: the route's depth and category, the query's narrowing, period and language. */
export function categoryRequestOf(route: { level?: string; code?: string }, params: URLSearchParams): CategoryProfileRequest {
  return {
    level: route.level === 'second' ? 'second' : 'top',
    code: route.code ?? '',
    scope: scopeOf(params),
    ...periodOf(params),
    lang: langOf(params.get('lang')),
  }
}

/** The server's query (BO 4178). The chain names no region or pharmacy; an unnamed period is the server's default. */
export function categoryProfileParams(request: CategoryProfileRequest): Record<string, string> {
  const { level, code, scope, lang } = request
  return {
    level,
    category: code,
    scope: scope.kind,
    ...(scope.kind === 'region' ? { region: scope.region } : {}),
    ...(scope.kind === 'store' ? { storeCode: scope.storeCode } : {}),
    ...Object.fromEntries(periodPairs(pickPeriod(request), false)),
    lang,
  }
}
