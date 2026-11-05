import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CloudOff, RotateCcw, SearchX, TimerOff } from 'lucide-react'
import ChartFrame from '@/core/charts/ChartFrame'
import TableChart from '@/core/charts/TableChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { apiErrorCode } from '@/core/api'
import { fsi } from '@/core/util/bidi'
import { panelFailure, unavailableReason } from './panel-state'
import { panelTable } from './panel-table'
import Refused from './Refused'
import ViewChart from './ViewChart'
import { analyticsRefusal } from './wire'

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
export type BodyState = 'loading' | 'busy' | 'idle' | 'empty' | 'failed' | 'unavailable' | 'refused'

export function bodyState(result: AnalyticsQueryResult | undefined, error: unknown, busy: boolean): BodyState {
  if (busy) return 'busy'
  if (error && !result) {
    const f = panelFailure(apiErrorCode(error))
    return f === 'retry' ? 'failed' : f === 'unavailable' ? 'unavailable' : 'refused'
  }
  if (!result) return 'loading'
  return result.rows.length === 0 ? 'empty' : 'idle'
}

export default function PanelBody({
  result,
  error,
  busy,
  definition,
  model,
  lang,
  table,
  onRetry,
}: {
  result: AnalyticsQueryResult | undefined
  error: unknown
  busy: boolean
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  table: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation('boards')
  const failure = error ? panelFailure(apiErrorCode(error)) : null

  if (error && !result && !busy) {
    if (failure === 'retry') return <Failed err={error} onRetry={onRetry} />
    if (failure === 'unavailable') {
      const refusal = analyticsRefusal(error, t('panel.unavailableTitle'))
      const reason = unavailableReason(definition, model) ?? ('key' in refusal ? t(refusal.key) : refusal.message)
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
        <ViewChart result={result} busy={busy} definition={definition} model={model} lang={lang} />
      )}
    </>
  )
}

function PanelTableView({ result, definition, model, lang }: { result: AnalyticsQueryResult; definition: AnalyticsViewDefinition; model: AnalyticsModel; lang: string }) {
  const { t: tc } = useTranslation('common')
  const view = useMemo(() => panelTable(result, definition, model, lang), [result, definition, model, lang])
  const measures = view.columns.filter((c) => c.role === 'measure').map((c) => c.label)
  const dims = view.columns.filter((c) => c.role === 'dimension').map((c) => c.label)
  return (
    <div data-panel-table>
      <TableChart
        columns={view.columns}
        rows={view.rows}
        sort={null}
        locale={lang}
        ariaLabel={tc('charts.tableLabel', { measures: fsi(measures.join(', ')), dimensions: fsi(dims.join(', ')) })}
      />
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
      <span>{'key' in refusal ? t(refusal.key) : refusal.message}</span>
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
