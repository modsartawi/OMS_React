/**
 * Sizes as every Store database panel spells them (oms 915; later panels reuse it). The wire carries KB (spec D6,
 * every field suffixed `Kb`); the tab reads GB / MB / KB. Pure: the unit word is the caller's `t()`
 * (`storeDb.units.<unit>`, `{{n}}` slot) — so if BO sends MB instead, only this file changes.
 */

import type { TFunction } from 'i18next'

export type SizeUnit = 'gb' | 'mb' | 'kb'

export interface Size {
  unit: SizeUnit
  /** The figure, en-US grouped, ready for the unit's `{{n}}`. */
  n: string
}

/** The wire's KB in a megabyte and a gigabyte — the one set every Store database module reads. */
export const KB_PER_MB = 1024
export const KB_PER_GB = 1024 * 1024

const fixed = (n: number, digits: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** A drive's free KB as the server sends it: `-1` = the drive was not matched — unknown, never a size. */
export const driveFreeKb = (kb: number | null | undefined): number | null => (kb == null || kb < 0 ? null : kb)

/** A KB figure as a size; `null` when there is no reading. */
export function kbSize(kb: number | null | undefined): Size | null {
  if (kb == null || !Number.isFinite(kb)) return null
  if (kb >= KB_PER_GB) return { unit: 'gb', n: fixed(kb / KB_PER_GB, 1) }
  if (kb >= KB_PER_MB) return { unit: 'mb', n: fixed(Math.floor(kb / KB_PER_MB), 0) }
  return { unit: 'kb', n: fixed(kb, 0) }
}

/** A size in its unit's words (`storeDb.units.<unit>`); blank for none. The one spelling grids and lines share. */
export const sizeText = (t: TFunction, size: Size | null): string => (size ? t(`storeDb.units.${size.unit}`, { n: size.n }) : '')

/** A KB figure in its unit's words; blank for no reading. Fits a grid `valueFormatter` (no isolate: it reaches Ctrl+C). */
export const kbText = (t: TFunction, kb: number | null | undefined): string => sizeText(t, kbSize(kb))

/** A `0..1` share as a percent figure (no sign — the locale adds it); `null` when there is none. */
export function sharePercent(share: number | null | undefined): string | null {
  if (share == null || !Number.isFinite(share)) return null
  return (Math.round(share * 1000) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })
}
