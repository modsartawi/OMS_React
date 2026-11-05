import { create } from 'zustand'

/**
 * The app shell's copilot panel opener (ticket 782, spec 766 §F) — moved out of the top-bar button's
 * own state so a screen can open the SAME panel with a question in it. There is never a second Ask
 * client: a screen hands the question over here, and the copilot panel takes it and sends it through
 * its own conversation.
 *
 * - `openPanel(question?)` opens the sheet; a question (trimmed, non-blank) waits for the panel.
 * - `takeQuestion()` hands it over ONCE: the panel that takes it sends it, a second read gets null.
 * - `available` is published by the top-bar button from `Copilot/Access` (`canAsk === true`), so a
 *   feature can gate its ask box on the copilot probe without importing the copilot feature
 *   (feature-structure rule). It fails closed: false until the probe says yes, and going false closes
 *   the panel and drops any question.
 */
export interface CopilotPanelState {
  open: boolean
  /** The question waiting for the panel, or null. Read it through `takeQuestion`. */
  question: string | null
  /** The copilot probe answered `canAsk: true` — published by the shell's button. */
  available: boolean
  openPanel: (question?: string) => void
  close: () => void
  takeQuestion: () => string | null
  setAvailable: (available: boolean) => void
}

export function createCopilotPanel() {
  return create<CopilotPanelState>((set, get) => ({
    open: false,
    question: null,
    available: false,
    openPanel: (question) => {
      const q = question?.trim() ?? ''
      set({ open: true, question: q === '' ? null : q })
    },
    close: () => set({ open: false, question: null }),
    takeQuestion: () => {
      const q = get().question
      if (q !== null) set({ question: null })
      return q
    },
    setAvailable: (available) => set(available ? { available } : { available, open: false, question: null }),
  }))
}

export const useCopilotPanel = createCopilotPanel()
