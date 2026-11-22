/**
 * The page help drawer's open state (oms 952, BackOffice spec 4182 §D; orchestrator decision 8): in core, so the "?" in
 * `ScreenGate`'s header (core) opens it and the shell (`layout/`) mounts the drawer the help feature draws — neither
 * imports the other (precedent: `@/core/copilot-panel`).
 *
 * - `openHelp()` opens it, unless another dialog is open: a modal dialog holds the focus, and the drawer never takes it.
 * - `pressKey('Escape')` closes it (the drawer is a modal `SideSheet`, whose own cancel closes it too).
 */
import { create } from 'zustand'
import type { HelpLang } from '@/core/models/help'

export interface PageHelpState {
  open: boolean
  /** Opens the drawer; false (and stays closed) while another dialog is open. */
  openHelp: () => boolean
  close: () => void
  pressKey: (key: string) => void
}

/** Whether a dialog is open in the page now (a modal `<dialog>` or an ARIA modal). */
const dialogInPage = (): boolean =>
  typeof document !== 'undefined' && document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') !== null

export function createPageHelp(anotherDialogOpen: () => boolean = dialogInPage) {
  return create<PageHelpState>((set, get) => ({
    open: false,
    openHelp: () => {
      if (get().open) return true
      if (anotherDialogOpen()) return false
      set({ open: true })
      return true
    },
    close: () => set({ open: false }),
    pressKey: (key) => {
      if (key === 'Escape') set({ open: false })
    },
  }))
}

export const usePageHelp = createPageHelp()

/**
 * The screen edge the drawer docks to: the inline end of the help's language — right in English, left in Arabic. The
 * drawer takes the help language's `dir`, so the `SideSheet`'s inline-end docking lands it there.
 */
export const helpDrawerSide = (lang: HelpLang): 'right' | 'left' => (lang === 'ar' ? 'left' : 'right')

/** The pages that carry a "?": every analytics page, except the help center itself. */
export const hasPageHelp = (pathname: string): boolean =>
  (pathname === '/analytics' || pathname.startsWith('/analytics/')) && !/^\/analytics\/help(\/|$)/.test(pathname)
