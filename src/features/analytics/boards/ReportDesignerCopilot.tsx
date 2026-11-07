import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { useBoardContext } from '@/core/board-context'
import { useCopilotPanel } from '@/core/copilot-panel'
import type { AnalyticsBoardDefinition, AnalyticsLabel, AnalyticsReportDefinition } from '@/core/models/analytics'
import { useReportContext } from '@/core/report-context'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { copilotEditable } from './copilot-edit'
import type { EditingItem } from './item-save'
import type { DraftStep, ReportDraft } from './ReportDesignerPage'

/**
 * The designer's half of the report-in-context bridge (ticket 832, spec 819 §D/§E). The copilot is another feature,
 * so the two meet only in `@/core/report-context`:
 * - while the designer is open, its `{ reportId, revision, draft }` is published (the draft as it changes, saved or
 *   not), with its title for the copilot panel's "Editing: …" chip (836), and cleared when the designer closes. A new
 *   report not saved yet is published too, as `reportId: null` and revision 0 (story 101, ⚠ proposed);
 * - an answer's `reportEdit` for THIS report (or for `null`, while it is new) is taken once and handed to `apply`
 *   with the question it answers — the designer applies it as one history step labelled "AI: <the request>". It never
 *   saves it.
 *
 * Outside the designer nothing is in context, and the copilot's `create_report` makes a new report.
 */
export function useReportInContext(reportId: string | null, revision: number, draft: ReportDraft, apply: (definition: AnalyticsReportDefinition, request: string) => void) {
  const publish = useReportContext((s) => s.publish)
  const clear = useReportContext((s) => s.clear)
  const take = useReportContext((s) => s.takeEdit)
  const waiting = useReportContext((s) => s.edit)
  const applyRef = useRef(apply)
  applyRef.current = apply

  useEffect(() => {
    publish({ reportId, revision: reportId ? revision : 0, draft: draft.definition }, draft.title)
  }, [publish, reportId, revision, draft.definition, draft.title])

  useEffect(() => () => clear(reportId), [clear, reportId])

  useEffect(() => {
    if (!waiting) return
    const taken = take(reportId)
    if (taken) applyRef.current(taken.edit.definition, taken.request)
  }, [waiting, reportId, take])
}

/**
 * 836: the board editor's half of the board-in-context bridge (`@/core/board-context`), the same as the report's. Only
 * a saved board is published (`edit_board` edits a board that exists); an answer's `boardEdit` for it is taken once and
 * handed to `apply` with its question. It never saves it.
 */
export function useBoardInContext(
  boardId: string | null,
  revision: number,
  definition: AnalyticsBoardDefinition,
  title: AnalyticsLabel,
  apply: (definition: AnalyticsBoardDefinition, request: string) => void,
) {
  const publish = useBoardContext((s) => s.publish)
  const clear = useBoardContext((s) => s.clear)
  const take = useBoardContext((s) => s.takeEdit)
  const waiting = useBoardContext((s) => s.edit)
  const applyRef = useRef(apply)
  applyRef.current = apply
  // The editor rebuilds its definition every render: publish when what it says changes, not when its object does.
  const said = JSON.stringify(definition)
  const saidRef = useRef(definition)
  saidRef.current = definition

  useEffect(() => {
    if (boardId) publish({ boardId, revision, draft: saidRef.current }, title)
  }, [publish, boardId, revision, said, title])

  useEffect(() => () => clear(boardId), [clear, boardId])

  useEffect(() => {
    if (!waiting || !boardId) return
    const taken = take(boardId)
    if (taken) applyRef.current(taken.edit.definition, taken.request)
  }, [waiting, boardId, take])
}

/**
 * 836: "Edit with copilot" in a designer's toolbar: opens the copilot panel on the item in context. Offered while the
 * copilot is available; on an item the AI may not edit (new, someone else's, Certified) it is disabled and says why.
 */
export function EditWithCopilot({ editing }: { editing: EditingItem | null }) {
  const { t } = useTranslation('boards')
  const available = useCopilotPanel((s) => s.available)
  const openPanel = useCopilotPanel((s) => s.openPanel)
  const userId = useSession((s) => s.userId)
  if (!available) return null
  const can = copilotEditable(editing, userId)
  return (
    <Button
      variant="outlined"
      disabled={can !== 'ok'}
      title={t(can === 'ok' ? 'editWithCopilot.hint' : `editWithCopilot.${can}`)}
      onClick={() => openPanel()}
      data-edit-with-copilot={can}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {t('editWithCopilot.action')}
    </Button>
  )
}

/** The copilot's step just applied: "AI: <the request>", and Undo takes the whole of it back. */
export function AiStepNotice({ step, onUndo }: { step: DraftStep | null; onUndo: () => void }) {
  const { t } = useTranslation('boards')
  if (step?.kind !== 'ai') return null
  return (
    <div role="status" className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs" data-designer-ai-step>
      <span data-designer-ai-label>{t('designer.history.ai', { request: fsi(step.request) })}</span>
      <Button variant="link" onClick={onUndo} data-designer-ai-undo>
        {t('designer.history.undo')}
      </Button>
    </div>
  )
}
