import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Hourglass, TriangleAlert, Unlink } from 'lucide-react'
import { apiErrorCode, apiErrorData } from '@/core/api'
import { formatDay } from '@/core/charts/format'
import type { AnalyticsBoardPanel, AnalyticsItem, AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition, BoardLayout } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsQueryKey } from './api'
import { pointOf } from './drill'
import { drilledDefinition, effectiveQuery, panelKey, panelPeriod, queryKeyOf, type BoardContext, type CrossFilter, type DrillStep, type ViewPanel } from './effective-query'
import PanelActions from './PanelActions'
import PanelBody, { bodyState } from './PanelBody'
import PanelDrill from './PanelDrill'
import { useFullscreen, useScrollToPanel } from './panel-hooks'
import { panelMarks, panelPermalink, refusedParam, retiredMembers } from './panel-state'
import { asBoardPanel, type ReportPanelBlock } from './report'
import { notFilteredBy, paramLabel } from './params'
import Refused from './Refused'
import { viewTitleOf } from './ViewChart'

/**
 * One panel of a board (ticket 771) on the 12-column grid: a view by reference, a text panel or a
 * section header. A view panel owns its query — keyed by its effective query, with
 * `placeholderData: keepPreviousData`, so a re-ask dims the previous chart and never blanks — and
 * reports whether it is fetching, for the strip's n of N. A superseded answer lands in its old key's
 * cache entry and is never drawn: the newer key wins.
 *
 * Memoised, with its effective query made inside it from the board's `context`, so when another panel's
 * fetching state re-renders the board, this panel's chart is not redrawn.
 *
 * 773's panel actions and freshness sit in the header (`data-board-panel-actions`, `./PanelActions`) and
 * its states in the body (`./PanelBody`); the card is what goes full screen, and `#panel-<id>` (the
 * panel's permalink) scrolls to it.
 *
 * 772: a click on a mark reports a cross-filter point up (`onCross`, stable); the board toggles it. The
 * panel's drill by steps are its own state (not saved, not in the URL), drawn by `PanelDrill`.
 */

/** The grid placement: logical columns, so the board mirrors under RTL. */
const place = ({ x, y, w, h }: BoardLayout): CSSProperties => ({ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` })

type PanelProps = {
  item?: AnalyticsItem
  itemError?: unknown
  /** The board-wide state the effective query is made from (memoised by the board). */
  context: BoardContext
  model: AnalyticsModel
  lang: string
  onFetching: (id: string, fetching: boolean) => void
  /** A mark clicked here (772): the board toggles its cross-filter. Stable. */
  onCross: (point: CrossFilter) => void
  /** 780: hands the board's refresh loop this panel's re-ask (`null` on unmount). Stable. */
  registerRefresh?: (id: string, refresh: (() => void) | null) => void
  /** 823: who reads the "not filtered by …" line — the author sees every parameter, a runner only those moved. */
  role?: 'author' | 'runner'
  /** 823: the parameters this panel's answer fell back on, and the one an `ANALYTICS-412` named, for the strip. Stable. */
  onParamNotice?: (id: string, notice: ParamNotice) => void
  /** 827: a report's panel flows top to bottom, full width, instead of standing on the board's grid. */
  flow?: boolean
}

/** What one panel's answer says about the board's parameters (823). */
export interface ParamNotice {
  fellBack: string[]
  invalid: string | null
}

export default memo(function BoardPanel({ panel, ...view }: { panel: AnalyticsBoardPanel } & PanelProps) {
  if (panel.kind === 'view') return <ViewPanelCard panel={panel} {...view} />
  if (panel.kind === 'section') {
    return (
      <h2 className="self-end border-b border-border/60 pb-1 text-sm font-semibold tracking-tight" style={place(panel.layout)} data-board-panel={panel.id} data-board-panel-kind="section">
        <bdi>{saysIn(panel.title, view.lang)}</bdi>
      </h2>
    )
  }
  return (
    <Card panel={panel} kind="text">
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        <bdi>{saysIn(panel.text, view.lang)}</bdi>
      </p>
    </Card>
  )
})

function Card({
  panel,
  kind,
  children,
  ref,
  flow = false,
  ...data
}: { panel: AnalyticsBoardPanel; kind: string; children: ReactNode; ref?: Ref<HTMLElement>; flow?: boolean } & Record<`data-${string}`, string | undefined>) {
  return (
    <article
      ref={ref}
      id={`panel-${panel.id}`}
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 [break-inside:avoid] [&:fullscreen]:overflow-auto [&:fullscreen]:p-6"
      style={flow ? undefined : place(panel.layout)}
      data-board-panel={panel.id}
      data-board-panel-kind={kind}
      {...data}
    >
      {children}
    </article>
  )
}

function ViewPanelCard({ panel, item, itemError, context, model, lang, onFetching, onCross, registerRefresh, role = 'runner', onParamNotice, flow }: { panel: ViewPanel } & PanelProps) {
  const { t } = useTranslation('boards')
  const [drill, setDrill] = useState<DrillStep[]>([])
  // A view naming a member the model no longer holds is retired: not asked at all (766 §B).
  const retired = useMemo(() => (item ? retiredMembers(item.definition, model) : []), [item, model])
  const input = useMemo(
    () => (item && retired.length === 0 ? effectiveQuery({ panel, view: item.definition, revision: item.revision, model }, context, drill) : null),
    [panel, item, model, context, drill, retired],
  )
  const drawn = useMemo(() => (item ? drilledDefinition(item.definition, drill) : undefined), [item, drill])
  const onPoint = useCallback(
    (dimension: string, member: string) => {
      const point = pointOf(dimension, member, model)
      if (point) onCross({ source: panel.id, ...point })
    },
    [model, onCross, panel.id],
  )
  const cross = context.crossFilter
  // The point the board's cross-filter was clicked on HERE, on the breakdown this panel now shows.
  const point = useMemo(
    () => (cross && cross.source === panel.id && cross.dimension === drawn?.query.dimensions[0] ? { dimension: cross.dimension, member: cross.member } : null),
    [cross, panel.id, drawn],
  )
  // 853: a draft panel is keyed by what of the draft it runs, not the whole draft (`queryKeyOf`).
  const keyed = useMemo(() => (input && item ? queryKeyOf(input, item.definition) : null), [input, item])
  const answer = useQuery({
    queryKey: analyticsQueryKey(keyed ?? { viewId: panel.viewId }),
    queryFn: () => analyticsApi.query(input!),
    enabled: !!input,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const busy = answer.isFetching
  // 853: the server refuses a whole draft a save would refuse (a text naming a removed panel, `ANALYTICS-411`), which
  // no change of this panel's key fixes: a refused draft panel asks again when the draft changes.
  // Only a refusal of the draft as a whole: a 412/415/404 is this panel's own, which another edit does not fix.
  const refusedDraft = !!context.draft && DRAFT_REFUSALS.has(apiErrorCode(answer.error) ?? '')
  useEffect(() => {
    if (refusedDraft) void answer.refetch({ cancelRefetch: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new draft asks again, not the refusal itself
  }, [context.draft])
  // While a drill step is asked, the previous answer stays drawn — with the definition it answered, not
  // the drilled one it does not match. Adjusted during render, so no frame pairs one with the other.
  const [shown, setShown] = useState(drawn)
  if (answer.data && !answer.isPlaceholderData && shown !== drawn) setShown(drawn)
  const chartDef = answer.isPlaceholderData ? shown : drawn
  const frame = useRef<HTMLElement>(null)
  const fullscreen = useFullscreen(frame)
  const [table, setTable] = useState(false)
  useScrollToPanel(panel.id, frame, !!answer.data || !!answer.error)
  const onTable = useCallback(() => setTable((on) => !on), [])
  const permalink = useCallback(() => panelPermalink(window.location.href, panel.id), [panel.id])
  const { refetch } = answer
  const asks = !!input
  useEffect(() => {
    if (!registerRefresh || !asks) return
    // An answer still on its way is left to land, not asked again.
    registerRefresh(panel.id, () => void refetch({ cancelRefetch: false }))
    return () => registerRefresh(panel.id, null)
  }, [registerRefresh, panel.id, refetch, asks])
  useEffect(() => {
    onFetching(panel.id, busy)
    return () => onFetching(panel.id, false)
  }, [onFetching, panel.id, busy])
  // 823: the answer's fallbacks and a 412's parameter go up to the strip, which names them.
  const fellBackNames = (answer.isPlaceholderData ? [] : (answer.data?.fellBack ?? [])).map((f) => f.param).join(' ')
  const invalid = answer.error ? refusedParam(apiErrorCode(answer.error), apiErrorData(answer.error)) : null
  useEffect(() => {
    if (!onParamNotice) return
    onParamNotice(panel.id, { fellBack: fellBackNames ? fellBackNames.split(' ') : [], invalid })
  }, [onParamNotice, panel.id, fellBackNames, invalid])
  useEffect(() => (onParamNotice ? () => onParamNotice(panel.id, { fellBack: [], invalid: null }) : undefined), [onParamNotice, panel.id])
  const unfiltered = useMemo(
    () => (answer.data ? notFilteredBy(context.params, context.values, answer.data.notReached ?? [], role) : []),
    [answer.data, context.params, context.values, role],
  )

  // 777: a view deleted from under the board is a "view removed" panel; the rest of the board keeps working.
  if (itemError && apiErrorCode(itemError) === 'ANALYTICS-404') {
    return (
      <Card flow={flow} panel={panel} kind="view" data-board-panel-state="removed">
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground" data-board-view-removed>
          <Unlink className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('board.viewRemoved')} {t('board.viewRemovedHint')}
          </span>
        </p>
      </Card>
    )
  }
  if (itemError) {
    return (
      <Card flow={flow} panel={panel} kind="view" data-board-panel-state="refused">
        <Refused err={itemError} fallbackKey="board.viewFailed" />
      </Card>
    )
  }
  if (!item || !drawn) {
    return (
      <Card flow={flow} panel={panel} kind="view" data-board-panel-state="loading">
        <p className="text-sm text-muted-foreground" role="status">
          {t('board.panelLoading')}
        </p>
      </Card>
    )
  }

  const result = answer.data
  const title = viewTitleOf(item, model, lang, t)
  return (
    <Card
      ref={frame}
      flow={flow}
      panel={panel}
      kind="view"
      data-board-panel-state={bodyState(result, answer.error, busy, retired)}
      data-panel-key={keyed ? panelKey(keyed) : undefined}
      data-board-cross-source={point ? 'true' : undefined}
      data-board-drill-depth={String(drill.length)}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="min-w-0 text-sm font-semibold tracking-tight" data-board-panel-title>
          <bdi>{title}</bdi>
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-board-panel-actions>
          <PanelActions
            viewId={panel.viewId || panel.id}
            title={title}
            result={result}
            updatedAt={answer.dataUpdatedAt}
            definition={chartDef ?? drawn}
            model={model}
            lang={lang}
            onRefresh={answer.refetch}
            table={table}
            onTable={onTable}
            frame={frame}
            fullscreen={fullscreen}
            permalink={permalink}
          />
        </div>
      </header>
      {unfiltered.length > 0 && (
        <p className="text-xs text-muted-foreground" data-board-not-filtered={unfiltered.map((p) => p.name).join(' ')}>
          {t('panel.notFilteredBy')}{' '}
          {unfiltered.map((p, i) => (
            <Fragment key={p.name}>
              {i > 0 && t('panel.listSeparator')}
              <bdi className="font-medium">{paramLabel(p, lang, t)}</bdi>
            </Fragment>
          ))}
        </p>
      )}
      <PanelMarks definition={chartDef ?? drawn} result={result} model={model} lang={lang} />
      <PanelDrill view={item.definition} drilled={drawn} steps={drill} point={point} model={model} lang={lang} period={panelPeriod(panel, item.definition, context)} onDrill={setDrill} />
      <PanelBody
        result={result}
        error={answer.error}
        busy={busy}
        definition={chartDef ?? drawn}
        model={model}
        lang={lang}
        table={table}
        onRetry={answer.refetch}
        onPoint={onPoint}
        selected={point}
        retired={retired}
      />
    </Card>
  )
}

/**
 * 827 (spec 819 §E): the model's marks under a panel's header, on board and report panels alike — each measure's
 * caveat (free text, `<bdi>`), and "may still rise" from the first young day the answer holds (a machine value, `Ltr`).
 */
function PanelMarks({ definition, result, model, lang }: { definition: AnalyticsViewDefinition; result: AnalyticsQueryResult | undefined; model: AnalyticsModel; lang: string }) {
  const { t } = useTranslation('boards')
  const marks = useMemo(() => panelMarks(definition, result, model), [definition, result, model])
  if (marks.caveats.length === 0 && !marks.stillRising) return null
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {marks.caveats.map((c) => (
        <p key={c.en || c.ar} className="flex items-start gap-1" data-panel-caveat>
          <TriangleAlert className="mt-0.5 size-3 shrink-0 text-attention-800" aria-hidden />
          <bdi>{saysIn(c, lang)}</bdi>
        </p>
      ))}
      {marks.stillRising && (
        <p className="flex items-start gap-1" data-panel-still-rising={marks.stillRising.from} title={t('panel.mayStillRiseHint', { count: marks.stillRising.days, n: fsi(String(marks.stillRising.days)) })}>
          <Hourglass className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>
            <Trans t={t} i18nKey="panel.mayStillRise" values={{ from: formatDay(marks.stillRising.from, lang) }} components={{ day: <Ltr /> }} />
          </span>
        </p>
      )}
    </div>
  )
}

/** A report's run: the report item its panels ask by (`{ itemId, revision, panelId, values }`). */
export interface ReportRun {
  id: string
  revision: number
}

const NO_CROSS = () => {}

/**
 * 827: one report panel through v1's panel frame — the same loading, freshness, actions, drill, "not filtered
 * by" and marks as a board panel. Its definition is inline, so it stands in as a view of that definition (titled
 * by the block, else generated); it asks by the report and its own `panelId`, full width, with no cross-filter.
 */
/** The refusals of a draft as a whole (validated as a save would be, BackOffice 3419): any edit may fix them. */
const DRAFT_REFUSALS = new Set(['ANALYTICS-406', 'ANALYTICS-411'])

export const ReportPanel = memo(function ReportPanel({
  block,
  report,
  ...view
}: { block: ReportPanelBlock; report: ReportRun } & Omit<PanelProps, 'item' | 'itemError' | 'onCross' | 'flow'>) {
  const panel = useMemo(() => asBoardPanel(block), [block])
  const item = useMemo(
    (): AnalyticsItem => ({
      id: block.id,
      kind: 'view',
      title: block.title,
      subtitle: { en: '', ar: '' },
      owner: '',
      tier: 'personal',
      sourceChangedSinceCopy: block.sourceChangedSinceCopy === true,
      revision: report.revision,
      updatedAt: '',
      updatedBy: '',
      definition: block.definition,
    }),
    [block, report.revision],
  )
  return (
    <div data-report-panel={block.id}>
      <ViewPanelCard panel={panel} item={item} onCross={NO_CROSS} flow {...view} />
    </div>
  )
})
