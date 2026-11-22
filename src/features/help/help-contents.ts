/**
 * The order an area's articles read in (oms 951, BackOffice spec 4182 §D). Pure: no React, no i18n.
 */
import type { HelpArticleMeta } from '@/core/models/help'

/** The articles by their `order` (the server sends them ordered; the rail does not rely on it). */
export const inReadingOrder = <T extends HelpArticleMeta>(articles: readonly T[]): T[] => [...articles].sort((a, b) => a.order - b.order)

/** The articles before and after `slug` in reading order — null at either end, or when `slug` is not listed. */
export function neighbours(articles: readonly HelpArticleMeta[], slug: string): { previous: HelpArticleMeta | null; next: HelpArticleMeta | null } {
  const ordered = inReadingOrder(articles)
  const at = ordered.findIndex((a) => a.slug === slug)
  if (at < 0) return { previous: null, next: null }
  return { previous: ordered[at - 1] ?? null, next: ordered[at + 1] ?? null }
}
