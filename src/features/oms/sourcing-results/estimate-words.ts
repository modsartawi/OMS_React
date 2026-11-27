/**
 * An order's estimate in words (ticket 971; review 4354 #9): the orders drawer and the bar tab's largest differences
 * both read it from here, so no difference reads "at the same time" in both. Pure.
 */
import type { TFunction } from 'i18next'
import { fsi } from '@/core/util/bidi'

/** Minutes against what happened, in words; + = the advisor's plan earlier. */
export function estimateWords(t: TFunction<'sourcing-results'>, minutes: number | null): string {
  if (minutes == null) return t('dash')
  if (minutes === 0) return t('drawer.estimate.same')
  return t(minutes > 0 ? 'drawer.estimate.earlier' : 'drawer.estimate.later', { minutes: fsi(Math.abs(minutes)) })
}
