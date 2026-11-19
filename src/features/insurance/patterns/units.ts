/**
 * How a time span and a distance read on the pattern screens (oms 922): the list's span and shortest gap, a leg's km and
 * time ("312 km · 1 h 40 min"). Pure: these pick the locale's words (`duration.<key>`) and the figures they carry; the
 * figures stay Latin digits in either language, as everywhere in the app.
 */

/** A span in its largest two units: "45 min", "2 h", "1 h 40 min", "2 d", "2 d 3 h". */
export type DurationWords =
  | { key: 'minutes'; m: number }
  | { key: 'hours'; h: number }
  | { key: 'hoursMinutes'; h: number; m: number }
  | { key: 'days'; d: number }
  | { key: 'daysHours'; d: number; h: number }

export function durationWords(minutes: number): DurationWords {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
  const m = total % 60
  if (d > 0) return h > 0 ? { key: 'daysHours', d, h } : { key: 'days', d }
  if (h > 0) return m > 0 ? { key: 'hoursMinutes', h, m } : { key: 'hours', h }
  return { key: 'minutes', m }
}

const whole = (n: number) => Math.round(n).toLocaleString('en-US')

/** A distance's figure: a tenth under 10 km (two stores in one city), whole and grouped from 10 km. */
export function kmFigure(km: number): string {
  const tenths = Math.round(km * 10) / 10
  return tenths < 10 ? tenths.toFixed(1) : whole(km)
}

/** A speed's figure in km/h: whole and grouped. */
export function speedFigure(kmPerHour: number): string {
  return whole(kmPerHour)
}
