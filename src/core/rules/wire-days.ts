import { formatRange } from '@/core/util/bidi'

// The days HQ's rule doors send (BackOffice brief 2839, ticket 530; brief 2848, ticket 534): a
// campaign upload's window and a promotion's window are LOCAL days, and `windowUntil` is the
// INCLUSIVE last day — shown as sent, never the campaign JSON's exclusive `window.until`. Shared
// by the upload screens and the Promotions list, so it sits in `core/rules`. Pure.

/**
 * The day a wire date names, `yyyy-MM-dd`, cut from the string as sent — never through a `Date`,
 * so no time zone can move it. Blank for a missing or never-set (`0001-01-01`) date.
 */
export function dayOf(value: string | null | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '')
  if (!m || m[1].startsWith('0001-')) return ''
  return m[1]
}

/**
 * The window as ONE range of inclusive days (isolate it once), or null when there is none. HQ sends
 * both ends or neither; a lone end is no window, never shown as a one-day campaign.
 */
export function windowDays(from: string | null | undefined, until: string | null | undefined): string | null {
  const first = dayOf(from)
  const last = dayOf(until)
  return first && last ? formatRange(first, last) : null
}
