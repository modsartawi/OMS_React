import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, CloudOff, RotateCcw, SearchX, TimerOff } from 'lucide-react'
import ChartFrame from '@/core/charts/ChartFrame'
import TableChart from '@/core/charts/TableChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { apiErrorCode, apiErrorData } from '@/core/api'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { panelFailure, refusalField, unavailableReason } from './panel-state'
import { panelTable } from './panel-table'
import Refused, { RefusalText } from './Refused'
import UntilNote from './UntilNote'
import { useCalculatedModel } from './use-calculations'
import ViewChart from './ViewChart'
import type { MarkPoint } from './drill'
import type { PointHandler } from './ViewChart'
import { analyticsRefusal, refusalWords } from './wire'

/**
 * A panel's body by state (spec 766 §F, ticket 773), for a board panel and the view page alike:
 *
 * - **failed** — `ANALYTICS-408` (past 30 s) or `-409` (engine unreachable) with no answer to show: a retry.
 *   Each panel owns its query, so the other panels keep going. A refresh that fails over an answer keeps
 *   the answer and says the refresh failed, with the same retry.
 * - **unavailable** — `ANALYTICS-410`: the area's reason (the model's, else the server's words).
 * - **empty** — "No data for these filters."
 * - **table** — the table view: the panel's rows (`./panel-table`), in the chart's order.
 * - otherwise the chart (`ViewChart`); any other refusal is `Refused`.
 *
 * The state is published on the panel as `data-board-panel-state` by the caller ({@link bodyState}).
 */
export type BodyState = 'loading' | 'busy' | 'idle' | 'empty' | 'failed' | 'unavailable' | 'retired' | 'refused'

/** `retired`: the members the definition names that the model no longer holds (`retiredMembers`). */
export function bodyState(result: AnalyticsQueryResult | undefined, error: unknown, busy: boolean, retired: readonly string[] = []): BodyState {
  if (retired.length > 0) return 'retired'
  if (busy) return 'busy'
  if (error && !result) {
    const f = failureOf(error)
    return f === 'retry' ? 'failed' : f === 'unavailable' ? 'unavailable' : f === 'retired' ? 'retired' : 'refused'
  }
  if (!result) return 'loading'
  return result.rows.length === 0 ? 'empty' : 'idle'
}

const failureOf = (error: unknown) => panelFailure(apiErrorCode(error), refusalField(apiErrorData(error)))

export default function PanelBody({
  result,
  error,
  busy,
  definition,
  model,
  lang,
  table,
  onRetry,
  onPoint,
  selected,
  retired = [],
}: {
  result: AnalyticsQueryResult | undefined
  error: unknown
  busy: boolean
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  table: boolean
  onRetry: () => void
  /** A board panel's mark click (772), passed to the chart. */
  onPoint?: PointHandler
  /** The point a cross-filter was clicked on here (772). */
  selected?: MarkPoint | null
  /** The members the definition names that the model no longer holds: the panel is not asked, it is retired. */
  retired?: readonly string[]
}) {
  const { t } = useTranslation('boards')
  const failure = error ? failureOf(error) : null

  // 766 §B / story 86: a retired member (gone from the model, or a 406 naming the field) is its own state,
  // never a failed board.
  if (retired.length > 0 || (failure === 'retired' && !result && !busy)) {
    const members = retired.length > 0 ? retired.join(' ') : (refusalField(apiErrorData(error)) ?? '')
    return (
      <State icon={<Archive className="size-5" aria-hidden />} title={t('panel.retiredTitle')} data-panel-retired={members}>
        <span>{t('panel.retiredBody')}</span>
      </State>
    )
  }

  if (error && !result && !busy) {
    if (failure === 'retry') return <Failed err={error} onRetry={onRetry} />
    if (failure === 'unavailable') {
      const refusal = analyticsRefusal(error, t('panel.unavailableTitle'))
      const reason = unavailableReason(definition, model, lang) ?? refusalWords(refusal, t)
      return (
        <State icon={<CloudOff className="size-5" aria-hidden />} title={t('panel.unavailableTitle')} data-panel-unavailable>
          <bdi>{reason}</bdi>
        </State>
      )
    }
    return <Refused err={error} fallbackKey="view.queryFailed" />
  }

  return (
    <>
      {error && result && failure === 'retry' && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-attention-800" role="alert" data-panel-refresh-failed>
          {t('panel.refreshFailed')}
          <Button variant="secondary" onClick={onRetry} data-panel-retry>
            {t('panel.retry')}
          </Button>
        </p>
      )}
      {result && result.rows.length === 0 ? (
        <ChartFrame busy={busy} hasChart>
          <p className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground" data-panel-empty>
            <SearchX className="size-5" aria-hidden />
            {t('panel.empty')}
          </p>
        </ChartFrame>
      ) : table && result ? (
        <ChartFrame busy={busy} hasChart>
          <PanelTableView result={result} definition={definition} model={model} lang={lang} />
        </ChartFrame>
      ) : (
        <ViewChart result={result} busy={busy} definition={definition} model={model} lang={lang} onPoint={onPoint} selected={selected} />
      )}
    </>
  )
}

function PanelTableView({ result, definition, model, lang }: { result: AnalyticsQueryResult; definition: AnalyticsViewDefinition; model: AnalyticsModel; lang: string }) {
  const { t: tc } = useTranslation('common')
  const { t } = useTranslation('boards')
  const seriesHeader = t('view.seriesColumn')
  // 861: calculated columns are measures, labelled in the viewer's language.
  const shown = useCalculatedModel(model, definition, result, lang)
  const view = useMemo(
    () => panelTable(result, definition, shown, lang, { series: seriesHeader, previous: (measure) => t('view.previousColumn', { measure: fsi(measure) }) }),
    [result, definition, shown, lang, seriesHeader, t],
  )
  const measures = view.columns.filter((c) => c.role === 'measure').map((c) => c.label)
  const dims = view.columns.filter((c) => c.role === 'dimension').map((c) => c.label)
  return (
    <div data-panel-table>
      <TableChart
        columns={view.columns}
        rows={view.rows}
        sort={null}
        locale={lang}
        ariaLabel={tc('charts.tableLabel', { measures: fsi(listText(measures, lang)), dimensions: fsi(listText(dims, lang)) })}
      />
      <UntilNote definition={definition} result={result} model={model} lang={lang} />
    </div>
  )
}

function Failed({ err, onRetry }: { err: unknown; onRetry: () => void }) {
  const { t } = useTranslation('boards')
  const refusal = analyticsRefusal(err, t('panel.failedTitle'))
  const code = refusal.code
  return (
    <State
      icon={code === 'ANALYTICS-408' ? <TimerOff className="size-5" aria-hidden /> : <CloudOff className="size-5" aria-hidden />}
      title={t('panel.failedTitle')}
      data-panel-failed={code ?? ''}
    >
      <span>
        <RefusalText refusal={refusal} />
      </span>
      <Button variant="secondary" onClick={onRetry} data-panel-retry>
        <RotateCcw className="size-3.5" aria-hidden />
        {t('panel.retry')}
      </Button>
    </State>
  )
}

function State({ icon, title, children, ...data }: { icon: ReactNode; title: string; children: ReactNode } & Record<`data-${string}`, string | boolean>) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground" role="alert" {...data}>
      <span className="text-attention-800">{icon}</span>
      <span className="font-medium text-foreground">{title}</span>
      {children}
    </div>
  )
}
