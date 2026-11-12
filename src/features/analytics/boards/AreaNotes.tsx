import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { fsi } from '@/core/util/bidi'
import type { TableWords } from './panel-table'
import { areaNotes, type AreaNoteWords } from './unsplit'

/** 864: the cross-area notes' words (`boards:view.unsplit.*`) in the screen's language. */
export function useAreaNoteWords(): AreaNoteWords {
  const { t } = useTranslation('boards')
  return useMemo(
    () => ({
      notSplit: (v) => t('view.unsplit.notSplit', v),
      notFiltered: (v) => t('view.unsplit.notFiltered', v),
      totalIn: (v) => t('view.unsplit.totalIn', v),
      total: (v) => t('view.unsplit.total', v),
    }),
    [t],
  )
}

/**
 * A table's words (`boards:view.*`) in the screen's language: the series column's header, a measure's previous-period
 * header, its last-year header (877: the measure and last year's dates, each isolated whole) and an "All" row's unsplit
 * dimension. The table form and the downloads take them alike; a column tooltip is
 * the caller's (it needs the answer).
 */
export function useTableWords(): Required<Pick<TableWords, 'series' | 'previous' | 'lastYear' | 'all'>> {
  const { t } = useTranslation('boards')
  return useMemo(
    () => ({
      series: t('view.seriesColumn'),
      previous: (measure: string) => t('view.previousColumn', { measure: fsi(measure) }),
      lastYear: (measure: string, range: string) => t('view.lastYearColumn', { measure: fsi(measure), range: fsi(range) }),
      all: t('view.allMembers'),
    }),
    [t],
  )
}

/**
 * The panel note of a cross-area answer (ticket 864, BackOffice spec 3543 decisions 12 and 18): each figure that cannot
 * be split ("Deliveries cannot be split by Category.") with its totals — the "All" rows a chart never draws — and each
 * figure a filter did not reach ("Deliveries is not filtered by Category."). Nothing on a one-area answer. Every name and
 * number is isolated in `./unsplit`.
 */
export default function AreaNotes({
  definition,
  result,
  model,
  lang,
}: {
  definition: AnalyticsViewDefinition
  result: AnalyticsQueryResult | undefined
  /** The panel's drawing model (its variant and calculated measures named). */
  model: AnalyticsModel
  lang: string
}) {
  const words = useAreaNoteWords()
  const notes = useMemo(() => areaNotes(definition, result, model, lang, words), [definition, result, model, lang, words])
  if (notes.notSplit.length === 0 && notes.notFiltered.length === 0) return null
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground" role="note" data-panel-area-notes>
      {notes.notSplit.map((n) => (
        <div key={n.measure} data-panel-not-split={n.measure}>
          <p>{n.sentence}</p>
          {n.totals.length > 0 && (
            <ul className="ps-4" data-panel-unsplit-totals>
              {n.totals.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {notes.notFiltered.map((line, i) => (
        <p key={i} className="text-attention-800" data-panel-not-filtered>
          {line}
        </p>
      ))}
    </div>
  )
}
