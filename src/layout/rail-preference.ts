import { create } from 'zustand'

// The rail's expand/collapse toggle (spec 380 F10, ticket 385): a per-user
// preference, kept beside the theme preference and persisted the same way.
// Collapsed is the default, and nothing but the toggle ever changes it — no
// route forces the rail open.
const STORAGE_KEY = 'oms.railExpanded'

/**
 * The stored value → expanded. Only the exact string this store writes reads as
 * expanded: a missing, cleared or hand-edited value falls back to collapsed
 * rather than pinning a 240px tree open on every screen.
 */
export function parseRailExpanded(raw: string | null): boolean {
  return raw === 'true'
}

function initialExpanded(): boolean {
  try {
    return parseRailExpanded(localStorage.getItem(STORAGE_KEY))
  } catch {
    return false // storage unavailable — start collapsed
  }
}

interface RailPreferenceState {
  expanded: boolean
  toggle: () => void
}

export const useRailPreference = create<RailPreferenceState>((set) => ({
  expanded: initialExpanded(),
  toggle: () =>
    set((s) => {
      const expanded = !s.expanded
      try {
        localStorage.setItem(STORAGE_KEY, String(expanded))
      } catch {
        /* storage unavailable — the toggle just won't persist */
      }
      return { expanded }
    }),
}))
