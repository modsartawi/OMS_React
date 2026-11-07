import type { CopilotReportContext, CopilotReportEdit } from '@/core/models/copilot'
import { createItemContext, type ItemContextState, type PostedEdit } from './item-context'

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
 * none open) is dropped, as is one the designer closed without taking. Since 836 it is one instance of
 * `./item-context`, beside the board's (`./board-context`).
 */
export type PostedReportEdit = PostedEdit<CopilotReportEdit>

export type ReportContextState = ItemContextState<CopilotReportContext, CopilotReportEdit>

export function createReportContext() {
  return createItemContext<CopilotReportContext, CopilotReportEdit>(
    (c) => c.reportId,
    (e) => e.reportId,
  )
}

export const useReportContext = createReportContext()
