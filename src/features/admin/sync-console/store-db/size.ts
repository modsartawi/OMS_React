/**
 * Sizes as every Store database panel spells them (oms 915; later panels reuse it). The wire carries KB (spec D6,
 * GUESSED field suffix `Kb`); the tab reads GB / MB / KB. Pure: the unit word is the caller's `t()`
 * (`storeDb.units.<unit>`, `{{n}}` slot) — so if BO sends MB instead, only this file changes.
 */

export type SizeUnit = 'gb' | 'mb' | 'kb'

export interface Size {
  unit: SizeUnit
  /** The figure, en-US grouped, ready for the unit's `{{n}}`. */
  n: string
}

const MB = 1024
const GB = 1024 * 1024

const fixed = (n: number, digits: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** A KB figure as a size; `null` when there is no reading. */
export function kbSize(kb: number | null | undefined): Size | null {
  if (kb == null || !Number.isFinite(kb)) return null
  if (kb >= GB) return { unit: 'gb', n: fixed(kb / GB, 1) }
  if (kb >= MB) return { unit: 'mb', n: fixed(Math.floor(kb / MB), 0) }
  return { unit: 'kb', n: fixed(kb, 0) }
}

/** A `0..1` share as a percent figure (no sign — the locale adds it); `null` when there is none. */
export function sharePercent(share: number | null | undefined): string | null {
  if (share == null || !Number.isFinite(share)) return null
  return (Math.round(share * 1000) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })
}
