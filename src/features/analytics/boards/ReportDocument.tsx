import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { AnalyticsLabel, AnalyticsModel, AnalyticsReport, AnalyticsReportBlock, AnalyticsReportWords } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { ReportPanel, type ParamNotice } from './BoardPanel'
import type { BoardContext } from './effective-query'
import { fillTokens } from './live-figures'

/**
 * A report, top to bottom (spec 819 §E, ticket 827): its sections in order, each heading then its blocks — a
 * panel through v1's panel frame (`ReportPanel`), a text with its live figures filled from the run's Words, or
 * the summary (or "summary unavailable", which drops the summary alone). One rendering for the runner's page
 * and the print page; the designer (828) frames each block with its own tools.
 */

/** A4 at 14 mm margins is ~688 CSS px: the print page lays the report out this wide on screen and on paper alike. */
export const PAPER_PX = 680

export interface ReportWordsView {
  /** The run's Words, or `undefined` while they are asked for the first time. */
  data: AnalyticsReportWords | undefined
  /** The Words door failed: every figure is missing and the summary unavailable; the panels still run. */
  failed: boolean
}

export type RunProps = {
  model: AnalyticsModel
  lang: string
  context: BoardContext
  role: 'author' | 'runner'
  onFetching: (id: string, fetching: boolean) => void
  onParamNotice: (id: string, notice: ParamNotice) => void
}

export default function ReportDocument({ report, words, ...run }: { report: AnalyticsReport; words: ReportWordsView } & RunProps) {
  const item = useMemo(() => ({ id: report.id, revision: report.revision }), [report.id, report.revision])
  const { lang } = run
  return (
    <div className="flex flex-col gap-6" data-report-sections>
      {report.definition.sections.map((s) => (
        <section key={s.id} className="flex flex-col gap-3" data-report-section={s.id}>
          {saysIn(s.heading, lang) && (
            <h2 className="border-b border-border/60 pb-1 text-base font-semibold tracking-tight [break-after:avoid]">
              <bdi>{saysIn(s.heading, lang)}</bdi>
            </h2>
          )}
          {s.blocks.map((b) => (
            <ReportBlock key={b.id} block={b} item={item} words={words} {...run} />
          ))}
        </section>
      ))}
    </div>
  )
}

/** One block as the report reads it; the designer (828) frames each with its own tools. */
export function ReportBlock({ block, item, words, ...run }: { block: AnalyticsReportBlock; item: { id: string; revision: number }; words: ReportWordsView } & RunProps) {
  if (block.kind === 'panel') return <ReportPanel block={block} report={item} {...run} />
  if (block.kind === 'text') return <LiveText id={block.id} text={block.text} lang={run.lang} words={words} />
  return <SummaryBlock id={block.id} lang={run.lang} words={words} />
}

/**
 * A text block with its live figures (801 §3): each figure is a machine value, isolated whole (`Ltr`); the text
 * around it is free text (`<bdi>`). A figure the run lacks reads "figure unavailable", one still on its way "…" —
 * never the raw token.
 */
export function LiveText({ id, text, lang, words }: { id: string; text: AnalyticsLabel; lang: string; words: ReportWordsView }) {
  const { t } = useTranslation('boards')
  const figures = words.failed ? NONE : (words.data?.figures ?? null)
  const parts = useMemo(() => fillTokens(saysIn(text, lang), figures), [text, lang, figures])
  return (
    <p className="whitespace-pre-line text-sm leading-7" data-report-text={id}>
      <bdi>
        {parts.map((p, i) =>
          p.kind === 'text' ? (
            p.text
          ) : p.kind === 'figure' ? (
            <span key={i} className="font-semibold" data-report-figure={p.token}>
              <Ltr>{p.value}</Ltr>
            </span>
          ) : p.kind === 'missing' ? (
            <span key={i} className="rounded bg-muted px-1 text-xs text-muted-foreground" title={t('report.figureMissingHint')} data-report-figure-missing={p.token}>
              {t('report.figureMissing')}
            </span>
          ) : (
            <span key={i} className="text-muted-foreground" aria-label={t('report.figurePendingLabel')} data-report-figure-pending={p.token}>
              {t('report.figurePending')}
            </span>
          ),
        )}
      </bdi>
    </p>
  )
}

const NONE: Record<string, string> = {}

/**
 * The AI summary block: the run's summary, number-checked by the server against this run's results, or
 * "summary unavailable" (with the server's reason) — which drops the summary alone, never the report.
 */
export function SummaryBlock({ id, lang, words }: { id: string; lang: string; words: ReportWordsView }) {
  const { t } = useTranslation('boards')
  const summary = words.data?.summary
  const text = !words.failed && summary && 'text' in summary ? saysIn(summary.text, lang) : ''
  const state = text ? 'written' : !words.failed && !words.data ? 'pending' : 'unavailable'
  const reason = !words.failed && summary && 'unavailable' in summary ? summary.unavailable : ''
  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 p-3 [break-inside:avoid]" data-report-summary={state} data-report-block={id}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden />
        {t('report.summary.title')}
      </p>
      {state === 'written' ? (
        <>
          <p className="text-sm leading-7" data-report-summary-text>
            <bdi>{text}</bdi>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('report.summary.checked')}</p>
        </>
      ) : state === 'pending' ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('report.summary.writing')}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" title={reason ? fsi(reason) : undefined}>
          {t('report.summary.unavailable')}
          {reason && (
            <>
              {' '}
              <bdi className="text-xs" data-report-summary-reason>
                {reason}
              </bdi>
            </>
          )}
        </p>
      )}
    </div>
  )
}
