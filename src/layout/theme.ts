import { create } from 'zustand'

const STORAGE_KEY = 'oms.darkMode'

function initialDark(): boolean {
  // index.html already applied the class pre-paint; mirror its decision.
  return document.documentElement.classList.contains('dark')
}

interface ThemeState {
  dark: boolean
  toggle: () => void
}

export const useTheme = create<ThemeState>((set) => ({
  dark: initialDark(),
  toggle: () =>
    set((s) => {
      const dark = !s.dark
      document.documentElement.classList.toggle('dark', dark)
      // The grid flips in the same paint as the app tokens (403 §5.4).
      document.documentElement.dataset.agThemeMode = dark ? 'dark' : 'light'
      try {
        localStorage.setItem(STORAGE_KEY, String(dark))
      } catch {
        /* storage unavailable — theme just won't persist */
      }
      return { dark }
    }),
}))
