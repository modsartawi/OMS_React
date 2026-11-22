/**
 * The Retail Command Center's routes as strings (oms 946, BackOffice spec 4165): one place every caller builds a link
 * from — the command center pages, the shared finding card (`@/core/findings`) and the copilot (950), which links a
 * profile by route string only and never imports the feature (`.claude/rules/feature-structure.md`). Precedent
 * `@/core/analytics-routes`.
 *
 * Every link carries the page language (`lang`, decisions §3) when the caller has one, so a link keeps the reader's
 * language. 947-949 read these; they do not add their own builders.
 */
import type { CcLang, CcPeriodKind, CcScope, CcTarget } from '@/core/models/command-center'

/** The home: the brief, the status line and the kingdom map. */
export const COMMAND_CENTER_PATH = '/analytics/command-center'

/** A query string from ordered pairs, leaving out the empty ones; nothing when all are empty. */
const query = (pairs: [string, string | undefined][]): string => {
  const params = new URLSearchParams()
  for (const [key, value] of pairs) if (value) params.set(key, value)
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** The home, optionally with a pharmacy's scorecard panel open (`?store=`, 947). */
export const homeHref = ({ store, lang }: { store?: string; lang?: CcLang } = {}): string =>
  `${COMMAND_CENTER_PATH}${query([['store', store], ['lang', lang]])}`

/** A pharmacy's store profile (948): `/analytics/command-center/store/:storeCode`, its period in the query. */
export const storeProfileHref = (
  storeCode: string,
  { period, from, to, lang }: { period?: CcPeriodKind; from?: string; to?: string; lang?: CcLang } = {},
): string =>
  `${COMMAND_CENTER_PATH}/store/${encodeURIComponent(storeCode)}${query([['period', period], ['from', from], ['to', to], ['lang', lang]])}`

/** The scope's query pairs; the chain is the default and names nothing. */
const scopePairs = (scope?: CcScope): [string, string | undefined][] =>
  scope?.kind === 'region'
    ? [['scope', 'region'], ['region', scope.region]]
    : scope?.kind === 'store'
      ? [['scope', 'store'], ['store', scope.storeCode]]
      : []

/** A category profile (949): `/analytics/command-center/category/:level/:code`, narrowed by `scope`. */
export const categoryProfileHref = ({
  level,
  code,
  scope,
  period,
  lang,
}: {
  level: 'top' | 'second'
  code: string
  scope?: CcScope
  period?: CcPeriodKind
  lang?: CcLang
}): string =>
  `${COMMAND_CENTER_PATH}/category/${level}/${encodeURIComponent(code)}${query([...scopePairs(scope), ['period', period], ['lang', lang]])}`

/**
 * Where a link in a server sentence or cell goes. A pharmacy opens its scorecard panel on the home (`store:
 * 'scorecard'`, spec 4165 "a pharmacy code opens its scorecard") or its store profile elsewhere (`'profile'`); a category
 * opens its category profile.
 */
export const targetHref = (target: CcTarget, { lang, store }: { lang?: CcLang; store: 'scorecard' | 'profile' }): string =>
  target.kind === 'store'
    ? store === 'scorecard'
      ? homeHref({ store: target.storeCode, lang })
      : storeProfileHref(target.storeCode, { lang })
    : categoryProfileHref({ level: target.level, code: target.code, scope: target.scope, lang })
