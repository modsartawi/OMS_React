/**
 * The category profile's pure half (oms 949, BackOffice spec 4165 "The category profile"; BO 4178): the URL ⇄ the
 * request, the server query, and the query the page reads. The route names the depth and the category
 * (`/category/:level/:code`); the query string names the narrowing, the period and the language, as
 * `categoryProfileHref` (`@/core/command-center-routes`) writes them, so every link into the page and every filter
 * change land on the same request.
 */
import { COMMAND_CENTER_PATH } from '@/core/command-center-routes'
import { CC_PERIOD_KINDS, type CcCategoryLevel, type CcLang, type CcPeriodKind, type CcScope } from '@/core/models/command-center'
import { langOf } from './lang'

/** The router's pattern for the page (`app/router.tsx` registers it without the leading slash). */
export const CATEGORY_PROFILE_PATTERN = `${COMMAND_CENTER_PATH}/category/:level/:code`

/** What the page asks the server for. */
export interface CategoryProfileRequest {
  level: CcCategoryLevel
  code: string
  scope: CcScope
  /** Absent: the server's default (the last four weeks). */
  period?: CcPeriodKind
  lang: CcLang
}

/** The narrowing the query string names; anything incomplete is the chain. */
export const scopeOf = (params: URLSearchParams): CcScope => {
  const kind = params.get('scope')
  const region = params.get('region')
  const store = params.get('store')
  if (kind === 'region' && region) return { kind: 'region', region }
  if (kind === 'store' && store) return { kind: 'store', storeCode: store }
  return { kind: 'chain' }
}

const isPeriod = (value: string | null): value is CcPeriodKind => CC_PERIOD_KINDS.some((kind) => kind === value)

/** The request a URL names: the route's depth and category, the query's narrowing, period and language. */
export function categoryRequestOf(route: { level?: string; code?: string }, params: URLSearchParams): CategoryProfileRequest {
  const period = params.get('period')
  return {
    level: route.level === 'second' ? 'second' : 'top',
    code: route.code ?? '',
    scope: scopeOf(params),
    ...(isPeriod(period) ? { period } : {}),
    lang: langOf(params.get('lang')),
  }
}

/** The same URL narrowed to `scope`: the language and the period kept, the other narrowing's key dropped. */
export function withScope(params: URLSearchParams, scope: CcScope): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of ['scope', 'region', 'store']) next.delete(key)
  if (scope.kind === 'region') {
    next.set('scope', 'region')
    next.set('region', scope.region)
  } else if (scope.kind === 'store') {
    next.set('scope', 'store')
    next.set('store', scope.storeCode)
  }
  return next
}

/** The server's query (BO 4178). The chain names no region or pharmacy; an unnamed period is the server's default. */
export function categoryProfileParams(request: CategoryProfileRequest): Record<string, string> {
  const { level, code, scope, period, lang } = request
  return {
    level,
    category: code,
    scope: scope.kind,
    ...(scope.kind === 'region' ? { region: scope.region } : {}),
    ...(scope.kind === 'store' ? { storeCode: scope.storeCode } : {}),
    ...(period ? { period } : {}),
    lang,
  }
}
