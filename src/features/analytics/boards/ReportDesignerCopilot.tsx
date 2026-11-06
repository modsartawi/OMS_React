import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsReportDefinition } from '@/core/models/analytics'
import { useReportContext } from '@/core/report-context'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import type { DraftStep, ReportDraft } from './ReportDesignerPage'

/**
 * The designer's half of the report-in-context bridge (ticket 832, spec 819 §D/§E). The copilot is another feature,
 * so the two meet only in `@/core/report-context`:
 * - while the designer is open, its `{ reportId, revision, draft }` is published (the draft as it changes, saved or
 *   not), and cleared when the designer closes. A new report not saved yet is published too, as `reportId: null` and
 *   revision 0 (story 101, ⚠ proposed), so "add the cancellation rate as a bar" edits it rather than making another;
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
    publish({ reportId, revision: reportId ? revision : 0, draft })
  }, [publish, reportId, revision, draft])

  useEffect(() => () => clear(reportId), [clear, reportId])

  useEffect(() => {
    if (!waiting) return
    const taken = take(reportId)
    if (taken) applyRef.current(taken.edit.definition, taken.request)
  }, [waiting, reportId, take])
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
