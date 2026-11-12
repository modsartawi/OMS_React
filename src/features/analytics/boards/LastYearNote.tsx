import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsModel, AnalyticsQueryResult } from '@/core/models/analytics'
import { lastYearNotes, type LastYearNoteWords } from './last-year'

/** 877: the "not held" note's words (`boards:view.lastYearNotHeld*`) in the screen's language. */
export function useLastYearNoteWords(): LastYearNoteWords {
  const { t } = useTranslation('boards')
  return useMemo(
    () => ({
      notHeld: (v) => t('view.lastYearNotHeld', v),
      notHeldNoDay: (v) => t('view.lastYearNotHeldNoDay', v),
    }),
    [t],
  )
}

/**
 * The note under an answer whose last year is not held somewhere (ticket 877; BackOffice spec 3587 B11, ticket 3606):
 * "Last year is not shown for Points: the data starts on Jan 1, 2026." — one line per area. Those figures have no
 * last-year column, series or KPI figure (`./last-year`), so nothing reads as a zero; this says why. Nothing when every
 * area holds last year, when it was not asked, or while the answer is not in. Every name and day is isolated in
 * `./last-year`.
 */
export default function LastYearNote({
  result,
  model,
  lang,
}: {
  result: AnalyticsQueryResult | null | undefined
  /** The panel's drawing model (its variant measures named). */
  model: Pick<AnalyticsModel, 'measures'>
  lang: string
}) {
  const words = useLastYearNoteWords()
  const notes = useMemo(() => lastYearNotes(result, model, lang, words), [result, model, lang, words])
  if (notes.length === 0) return null
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground" role="note" data-panel-last-year-not-held={notes.length}>
      {notes.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  )
}
