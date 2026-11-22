/**
 * An age as the console says it (oms 942) — pure: a hold's age ("3 d 4 h"), a feed's last full pass ("12 min"). Returns
 * a locale key and its values; the component says it. Under a minute, and a time ahead of the reader's clock, read
 * "just now" — never a negative age.
 */

export interface AgeView {
  key: 'age.justNow' | 'age.minutes' | 'age.hours' | 'age.days'
  values: Record<string, number>
}

/** An age in seconds, as days and hours, hours and minutes, minutes, or "just now". */
export function ageView(seconds: number): AgeView {
  const minutes = Math.floor(seconds / 60)
  if (!Number.isFinite(seconds) || minutes < 1) return { key: 'age.justNow', values: {} }
  if (minutes < 60) return { key: 'age.minutes', values: { m: minutes } }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'age.hours', values: { h: hours, m: minutes % 60 } }
  return { key: 'age.days', values: { d: Math.floor(hours / 24), h: hours % 24 } }
}

/** A server time (local wall clock, no offset) as milliseconds on the reader's clock; null when it does not read. */
export function localMs(time: string | null | undefined): number | null {
  if (!time || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time)) return null
  const ms = new Date(time).getTime()
  return Number.isNaN(ms) ? null : ms
}
