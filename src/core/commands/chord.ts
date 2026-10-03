/**
 * The palette's chord, Ctrl+K (ticket 392, spec 380 K4 + K7; ruling 365 §3).
 *
 * 🚩 **Matched on `event.code`, never `event.key`.** On an Arabic layout Chrome reports
 * the Arabic character on that cap in `key`, so the console's `key === 'k'` (ticket 192)
 * is suspected dead there while the browser's own omnibox key still fires. The code is
 * the physical key, the same on every layout.
 *
 * **Meta counts as Ctrl**, and the hint always says Ctrl (a Windows back office).
 *
 * The chord tier fires from anywhere — a text box, a grid cell — and is **inert while any
 * `dialog[open]` exists**. Inert still prevents the default: left to it, the key puts the
 * caret in the browser's address bar, which is worse than the palette the user asked for.
 */

/** The physical key the palette opens on. */
export const PALETTE_KEY_CODE = 'KeyK'

/** The slice of a `KeyboardEvent` the chord reads — a real event satisfies it. */
export interface ChordFacts {
  code: string
  key?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** Ctrl (or Meta) on the K key, with no Alt and no Shift — whatever character `key` names. */
export function isPaletteChord(e: ChordFacts): boolean {
  return e.code === PALETTE_KEY_CODE && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey
}

const NAMED_LEGENDS: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
}

/**
 * The legend printed on a key's cap, derived from its code (K17): `KeyK` → `K`. It is
 * the Latin legend on either layout — data, not a translatable string. Named keys
 * (Ctrl, Enter, Esc) are words, and go through `t('common:keys.*')` instead.
 */
export function keyLegend(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  return NAMED_LEGENDS[code] ?? code
}
