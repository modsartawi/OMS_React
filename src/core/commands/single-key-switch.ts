import { create } from 'zustand'

/**
 * The single-key switch (ticket 393, spec 380 K6; ruling 365 §2): a per-user preference,
 * on by default, stored like `oms.darkMode`. Off, letters, `/` and `?` do nothing and
 * their hints hide, while chords, the palette and the mouse still work — how the app
 * meets WCAG 2.1.4 (a character-key shortcut can be turned off).
 *
 * It lives in `@/core` because the key layer reads it; the user menu and the shortcuts
 * sheet both toggle it.
 */
const STORAGE_KEY = 'oms.singleKeys'

/**
 * The stored value → on. Only the exact string this store writes for "off" turns the
 * keys off: a missing, cleared or hand-edited value keeps the default.
 */
export function parseSingleKeys(raw: string | null): boolean {
  return raw !== 'false'
}

function initialOn(): boolean {
  try {
    return parseSingleKeys(localStorage.getItem(STORAGE_KEY))
  } catch {
    return true // storage unavailable — the default
  }
}

interface SingleKeyState {
  on: boolean
  toggle: () => void
}

export const useSingleKeys = create<SingleKeyState>((set) => ({
  on: initialOn(),
  toggle: () =>
    set((s) => {
      const on = !s.on
      try {
        localStorage.setItem(STORAGE_KEY, String(on))
      } catch {
        /* storage unavailable — the switch just won't persist */
      }
      return { on }
    }),
}))
