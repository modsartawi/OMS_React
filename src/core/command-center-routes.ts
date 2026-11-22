/**
 * The Retail Command Center's routes as strings (oms 946, BackOffice spec 4165): one place every caller builds a link
 * from — the command center pages, the shared finding card (`@/core/findings`) and the copilot (950), which links a
 * profile by route string only and never imports the feature (`.claude/rules/feature-structure.md`). Precedent
 * `@/core/analytics-routes`.
 *
 * It is also the ONE place the URL's narrowing (`scope`, `region`, `store`), period (`period`, `from`, `to`) and
 * language (`lang`) are written and read back (4165 review B3): the links, the router's patterns and the profiles'
 * query strings all go through it, so a link and the page it opens can never disagree on a key.
 *
 * Every link carries the page language (`lang`, decisions §3) when the caller has one, so a link keeps the reader's
 * language. 947-949 read these; they do not add their own builders.
 */
import {
  CC_PERIOD_KINDS,
  type CcCategoryLevel,
  type CcFilter,
  type CcLang,
  type CcScope,
  type CcTarget,
} from '@/core/models/command-center'

/** The home: the brief, the status line and the kingdom map. */
export const COMMAND_CENTER_PATH = '/analytics/command-center'

/** The router's paths (`app/router.tsx` registers these, without the leading slash): the tests guard the real routes. */
export const CC_ROUTES = {
  home: COMMAND_CENTER_PATH.slice(1),
  storeProfile: `${COMMAND_CENTER_PATH.slice(1)}/store/:storeCode`,
  categoryProfile: `${COMMAND_CENTER_PATH.slice(1)}/category/:level/:code`,
} as const

/** The store profile's pattern (948), the route names the pharmacy. */
export const STORE_PROFILE_PATTERN = `/${CC_ROUTES.storeProfile}`

/** The category profile's pattern (949), the route names the depth and the category. */
export const CATEGORY_PROFILE_PATTERN = `/${CC_ROUTES.categoryProfile}`

// ── The language ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The URL's language; anything but `ar` is English. */
export const langOf = (value: string | null | undefined): CcLang => (value === 'ar' ? 'ar' : 'en')

/** Arabic is right to left. */
export const dirOf = (lang: CcLang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr')

// ── The period ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A period the reader can choose: the rolling 4 weeks, year-to-date, or two dates (both ends, local `YYYY-MM-DD`). */
export type CcPeriodChoice = { period: 'rolling4' } | { period: 'ytd' } | { period: 'dates'; from: string; to: string }

/** A period or none named (the page's default). Spread flat into a request or a link's options. */
export type CcPeriodOption = CcPeriodChoice | { period?: undefined; from?: undefined; to?: undefined }

const PERIOD_KEYS = ['period', 'from', 'to'] as const

/** The period a query string names; none, an unknown one or dates missing an end name none (null). */
export function periodOf(params: URLSearchParams): CcPeriodChoice | null {
  const period = params.get('period')
  const from = params.get('from')
  const to = params.get('to')
  if (period === 'dates') return from && to ? { period: 'dates', from, to } : null
  return CC_PERIOD_KINDS.some((kind) => kind === period) ? ({ period } as CcPeriodChoice) : null
}

/**
 * A period's query pairs, the same keys for a link and for the server (BO 4177/4178): its kind, and its two ends with
 * dates. `defaultNamesNothing`: in a link the rolling 4 weeks are the default and name nothing.
 */
export const periodPairs = (option: CcPeriodOption | undefined, defaultNamesNothing = true): [string, string | undefined][] => {
  if (!option?.period || (defaultNamesNothing && option.period === 'rolling4')) return []
  return option.period === 'dates'
    ? [['period', 'dates'], ['from', option.from], ['to', option.to]]
    : [['period', option.period]]
}

/** Only the period of something that carries one (a request): its kind and, with dates, its two ends. */
export const pickPeriod = (option: CcPeriodOption | undefined): CcPeriodOption =>
  option?.period === 'dates' ? { period: 'dates', from: option.from, to: option.to } : option?.period ? { period: option.period } : {}

/** The same URL on another period, everything else kept. */
export const withPeriod = (params: URLSearchParams, next: CcPeriodChoice): URLSearchParams => replaced(params, PERIOD_KEYS, periodPairs(next))

// ── The narrowing ────────────────────────────────────────────────────────────────────────────────────────────────

const SCOPE_KEYS = ['scope', 'region', 'store'] as const

/** The narrowing a query string names; anything incomplete is the chain. */
export function scopeOf(params: URLSearchParams): CcScope {
  const kind = params.get('scope')
  const region = params.get('region')
  const store = params.get('store')
  if (kind === 'region' && region) return { kind: 'region', region }
  if (kind === 'store' && store) return { kind: 'store', storeCode: store }
  return { kind: 'chain' }
}

/** The scope's query pairs; the chain is the default and names nothing. */
export const scopePairs = (scope?: CcScope): [string, string | undefined][] =>
  scope?.kind === 'region'
    ? [['scope', 'region'], ['region', scope.region]]
    : scope?.kind === 'store'
      ? [['scope', 'store'], ['store', scope.storeCode]]
      : []

/** The same URL narrowed to `scope`, everything else kept, the other narrowing's key dropped. */
export const withScope = (params: URLSearchParams, scope: CcScope): URLSearchParams => replaced(params, SCOPE_KEYS, scopePairs(scope))

// ── The links ────────────────────────────────────────────────────────────────────────────────────────────────────

/** `params` with `keys` dropped and `pairs` set after the rest. */
const replaced = (params: URLSearchParams, keys: readonly string[], pairs: [string, string | undefined][]): URLSearchParams => {
  const next = new URLSearchParams(params)
  for (const key of keys) next.delete(key)
  for (const [key, value] of pairs) if (value) next.set(key, value)
  return next
}

/** A query string from ordered pairs, leaving out the empty ones; nothing when all are empty. */
const query = (pairs: [string, string | undefined][]): string => {
  const s = replaced(new URLSearchParams(), [], pairs).toString()
  return s ? `?${s}` : ''
}

/** The home, optionally with a pharmacy's scorecard panel open (`?store=`, 947) under the map filter it was opened in. */
export const homeHref = ({ store, lang, filter }: { store?: string; lang?: CcLang; filter?: CcFilter } = {}): string =>
  `${COMMAND_CENTER_PATH}${query([['filter', filter === 'all' ? undefined : filter], ['store', store], ['lang', lang]])}`

/** A pharmacy's store profile (948): `/analytics/command-center/store/:storeCode`, its period in the query. */
export const storeProfileHref = (storeCode: string, { lang, ...period }: CcPeriodOption & { lang?: CcLang } = {}): string =>
  `${COMMAND_CENTER_PATH}/store/${encodeURIComponent(storeCode)}${query([...periodPairs(period), ['lang', lang]])}`

/** A category profile (949): `/analytics/command-center/category/:level/:code`, narrowed by `scope`, over a period. */
export const categoryProfileHref = ({
  level,
  code,
  scope,
  lang,
  ...period
}: { level: CcCategoryLevel; code: string; scope?: CcScope; lang?: CcLang } & CcPeriodOption): string =>
  `${COMMAND_CENTER_PATH}/category/${level}/${encodeURIComponent(code)}${query([...scopePairs(scope), ...periodPairs(period), ['lang', lang]])}`

/** How a page builds its links: its language, where a pharmacy goes, and what a profile link keeps. */
export interface TargetHrefOptions {
  lang?: CcLang
  /** A pharmacy opens its scorecard panel on the home (`'scorecard'`) or its store profile (`'profile'`). */
  store: 'scorecard' | 'profile'
  /** On the home: the map filter the scorecard opens under. */
  filter?: CcFilter
  /** On a profile: the period a profile link keeps (store ↔ category). */
  period?: CcPeriodOption
  /** On a profile: the narrowing a category takes when the server names none of its own. */
  scope?: CcScope
}

/**
 * Where a link in a server sentence or cell goes. A pharmacy opens its scorecard panel on the home (`store:
 * 'scorecard'`, spec 4165 "a pharmacy code opens its scorecard") or its store profile elsewhere (`'profile'`); a category
 * opens its category profile, narrowed as the server says or else as the page is.
 */
export const targetHref = (target: CcTarget, { lang, store, filter, period, scope }: TargetHrefOptions): string =>
  target.kind === 'store'
    ? store === 'scorecard'
      ? homeHref({ store: target.storeCode, lang, filter })
      : storeProfileHref(target.storeCode, { ...pickPeriod(period), lang })
    : categoryProfileHref({ level: target.level, code: target.code, scope: target.scope ?? scope, ...pickPeriod(period), lang })
