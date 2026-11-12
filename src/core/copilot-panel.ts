import { create } from 'zustand'
import type { CopilotSqlItemRef } from './models/copilot'

/**
 * The app shell's copilot panel opener (ticket 782, spec 766 §F) — moved out of the top-bar button's
 * own state so a screen can open the SAME panel with a question in it. There is never a second Ask
 * client: a screen hands the question over here, and the copilot panel takes it and sends it through
 * its own conversation.
 *
 * - `openPanel(question?)` opens the sheet; a question (trimmed, non-blank) waits for the panel.
 * - `takeQuestion()` hands it over ONCE: the panel that takes it sends it, a second read gets null.
 * - `prefill(text)` (ticket 843) opens the sheet with the text IN THE BOX, sent by nobody: the user reads, edits
 *   and sends it. `takeDraft()` hands it over once, like `takeQuestion()`.
 * - `available` is published by the top-bar button from `Copilot/Access` (`canAsk === true`), so a
 *   feature can gate its ask box on the copilot probe without importing the copilot feature
 *   (feature-structure rule). It fails closed: false until the probe says yes, and going false closes
 *   the panel and drops any question.
 */
export interface CopilotPanelState {
  open: boolean
  /** The question waiting for the panel, or null. Read it through `takeQuestion`. */
  question: string | null
  /** The text waiting to be put in the panel's box unsent (843), or null. Read it through `takeDraft`. */
  draft: string | null
  /**
   * Q46 (BackOffice 3678): the SQL item "Change by asking" opened the panel on, or null. The copilot takes it ONCE
   * (`takeSqlItem`), starts a new conversation in SQL mode and sends it with the reader's first question. The analytics
   * feature hands it over here: neither feature imports the other.
   */
  sqlItem: CopilotSqlItemRef | null
  /** The copilot probe answered `canAsk: true` — published by the shell's button. */
  available: boolean
  openPanel: (question?: string) => void
  prefill: (text: string) => void
  openSqlItem: (item: CopilotSqlItemRef) => void
  takeSqlItem: () => CopilotSqlItemRef | null
  close: () => void
  takeQuestion: () => string | null
  takeDraft: () => string | null
  setAvailable: (available: boolean) => void
}

export function createCopilotPanel() {
  return create<CopilotPanelState>((set, get) => ({
    open: false,
    question: null,
    draft: null,
    sqlItem: null,
    available: false,
    openPanel: (question) => {
      const q = question?.trim() ?? ''
      set({ open: true, question: q === '' ? null : q })
    },
    prefill: (text) => {
      const d = text.trim()
      set({ open: true, draft: d === '' ? null : d })
    },
    openSqlItem: (item) => set({ open: true, sqlItem: { itemId: item.itemId, revision: item.revision } }),
    takeSqlItem: () => {
      const s = get().sqlItem
      if (s !== null) set({ sqlItem: null })
      return s
    },
    close: () => set({ open: false, question: null, draft: null, sqlItem: null }),
    takeQuestion: () => {
      const q = get().question
      if (q !== null) set({ question: null })
      return q
    },
    takeDraft: () => {
      const d = get().draft
      if (d !== null) set({ draft: null })
      return d
    },
    setAvailable: (available) => set(available ? { available } : { available, open: false, question: null, draft: null, sqlItem: null }),
  }))
}

export const useCopilotPanel = createCopilotPanel()
