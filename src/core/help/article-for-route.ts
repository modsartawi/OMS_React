/**
 * Which article the page drawer opens (oms 952, BackOffice spec 4182 §D): the one whose front-matter `screens` hold the
 * current route, falling back to `start`.
 *
 * A screen is a route pattern (`/analytics/board/:id`) and covers that whole route — not the routes under it, so Home's
 * `/analytics` does not swallow every analytics page. A `:param` segment matches any one segment. Where several screens
 * match, the longest match wins: the one with the most literal segments (`/analytics/sql/new` over `/analytics/sql/:id`).
 */
import type { HelpArticleMeta } from '@/core/models/help'
import { HELP_START_SLUG } from './help-routes'

const segments = (path: string): string[] => path.split('/').filter((s) => s !== '')

/** How strongly `pattern` matches `path`: its literal segment count plus one, or 0 when it does not match. */
function matchScore(pattern: string, path: readonly string[]): number {
  const want = segments(pattern)
  if (want.length !== path.length) return 0
  let literals = 0
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':')) continue
    if (want[i] !== path[i]) return 0
    literals++
  }
  return literals + 1
}

/** The slug of the article covering `pathname`, or `start`. */
export function articleForRoute(articles: readonly HelpArticleMeta[] | undefined, pathname: string): string {
  const path = segments(pathname)
  let best = { slug: HELP_START_SLUG, score: 0 }
  for (const a of articles ?? []) {
    for (const screen of Array.isArray(a.screens) ? a.screens : []) {
      const score = matchScore(screen, path)
      if (score > best.score) best = { slug: a.slug, score }
    }
  }
  return best.slug
}
