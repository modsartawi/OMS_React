import { create } from 'zustand'
import type { CcAsk, CcLang, CcLine } from './models/command-center'
import type { CopilotSqlItemRef } from './models/copilot'

/**
 * oms 950 (BackOffice spec 4165, 4179): a finding the reader asked the copilot about — the server's written question and
 * its finding's id (`CcAsk`), and, from a brief line, the line itself and the language it was written in, so the copilot
 * draws the same card (`@/core/findings/FindingCard`) at the top of its panel. A pharmacy's scorecard asks with no line.
 */
export interface CopilotFinding extends CcAsk {
  line?: CcLine
  lang?: CcLang
}

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
 * - `askAbout(finding)` (oms 950) opens the sheet on a stored finding ("Ask" on a brief line or a pharmacy's scorecard,
 *   `@/core/findings/AskButton`): the copilot takes it once (`takeFinding()`) and asks its written question with the
 *   finding's id as context, in a new conversation.
 * - `available` is published by the top-bar button from the one permissions answer (`Copilot:01`, oms 914), so a
 *   feature can gate its ask box on the copilot grant without importing the copilot feature
 *   (feature-structure rule). It fails closed: false until the answer says yes, and going false closes
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
  /**
   * 950: the finding "Ask" opened the panel on, or null. The copilot takes it ONCE (`takeFinding`), starts a new
   * conversation and asks its written question with the finding's id as context. Neither feature imports the other.
   */
  finding: CopilotFinding | null
  /** The permissions answer holds `Copilot:01` — published by the shell's button. */
  available: boolean
  openPanel: (question?: string) => void
  prefill: (text: string) => void
  openSqlItem: (item: CopilotSqlItemRef) => void
  takeSqlItem: () => CopilotSqlItemRef | null
  askAbout: (finding: CopilotFinding) => void
  takeFinding: () => CopilotFinding | null
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
    finding: null,
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
    askAbout: (finding) => set({ open: true, finding }),
    takeFinding: () => {
      const f = get().finding
      if (f !== null) set({ finding: null })
      return f
    },
    close: () => set({ open: false, question: null, draft: null, sqlItem: null, finding: null }),
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
    setAvailable: (available) => set(available ? { available } : { available, open: false, question: null, draft: null, sqlItem: null, finding: null }),
  }))
}

export const useCopilotPanel = createCopilotPanel()
