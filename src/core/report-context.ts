import { create } from 'zustand'
import type { CopilotReportContext, CopilotReportEdit } from '@/core/models/copilot'

/**
 * The report-in-context bridge (ticket 832, spec 819 §D/§E), beside the copilot panel opener. The copilot never
 * imports the analytics feature and the analytics feature never imports the copilot, so the two meet here:
 *
 * - the open designer `publish`es `{ reportId, revision, draft }` as it changes, and `clear`s it when it closes;
 * - the copilot reads `context` when it asks, and sends it as the Ask body's `reportContext`;
 * - an answer's `reportEdit` is `postEdit`ed with the question it answers; the designer `takeEdit`s it ONCE and
 *   applies it as one history step ("AI: <the request>"). It never saves it.
 *
 * A new report not saved yet is in context as `reportId: null` (story 101), and takes the edit made for `null`.
 * An edit reaches only the report it names, and only while that report is open: an edit for any other report (or
 * none open) is dropped, as is one the designer closed without taking.
 */
export interface PostedReportEdit {
  edit: CopilotReportEdit
  /** The question the edit answers: the history step's label. */
  request: string
}

export interface ReportContextState {
  /** The report open in the designer (its id `null` while it is new and unsaved), or null when none is open. */
  context: CopilotReportContext | null
  /** An edit waiting for the open designer, or null. Read it through `takeEdit`. */
  edit: PostedReportEdit | null
  publish: (context: CopilotReportContext) => void
  /** The designer closed: drops the context (and any edit) only when it is still that report's. */
  clear: (reportId: string | null) => void
  postEdit: (edit: CopilotReportEdit, request: string) => void
  /** Hands the waiting edit to `reportId`'s designer once; null for any other report. */
  takeEdit: (reportId: string | null) => PostedReportEdit | null
}

export function createReportContext() {
  return create<ReportContextState>((set, get) => ({
    context: null,
    edit: null,
    publish: (context) => set((s) => (s.context?.reportId === context.reportId ? { context } : { context, edit: null })),
    clear: (reportId) => {
      if (get().context?.reportId === reportId) set({ context: null, edit: null })
    },
    postEdit: (edit, request) => {
      if (get().context?.reportId === edit.reportId) set({ edit: { edit, request } })
    },
    takeEdit: (reportId) => {
      const waiting = get().edit
      if (!waiting || waiting.edit.reportId !== reportId) return null
      set({ edit: null })
      return waiting
    },
  }))
}

export const useReportContext = createReportContext()
