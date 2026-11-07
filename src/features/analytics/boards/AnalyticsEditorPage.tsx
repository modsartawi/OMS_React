import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { itemHref, NEW_REPORT_PATH } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsChart, AnalyticsFilter, AnalyticsItem, AnalyticsLabel, AnalyticsModel, AnalyticsSeries, AnalyticsViewDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { analyticsAccessQuery, canAuthorAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsMembersKey, analyticsQueryKey } from './api'
import { BoardEditorBody, type BuildView } from './BoardEditor'
import ColourPicker from './ColourPicker'
import {
  allowedDimensions,
  colourDimension,
  colourMemberWords,
  DEFAULT_PERIOD,
  filterableDimensions,
  editItemLink,
  GRAINS,
  grainFor,
  MAX_DIMENSIONS,
  type Grain,
  readEditorSeed,
  settledSlots,
  withCompare,
  withMemberSlot,
  type EditorSeed,
} from './editor'
import { ChartFields, QueryFields, TitleFields } from './EditorFields'
import { ownCategoryDimensions, seriesProblems } from './series'
import SeriesFields from './SeriesFields'
import { editorRefusal } from './editor-refusal'
import { comparing } from './effective-query'
import EditorRefusalNote from './EditorRefusalNote'
import { SaveRefusalNote, SaveStanding } from './SaveNotes'
import { chartFor, chartOffers, choiceOf, suggestChoice, type ChartChoice } from './shape-rules'
import { generatedTitle } from './title'
import ReportDesignerPage from './ReportDesignerPage'
import ViewChart from './ViewChart'
import { useItemSave, type SaveHow } from './use-item-save'
import { analyticsRefusal, dimensionOf, measureOf, refusalWords } from './wire'

/**
 * The builder at `/analytics/new?kind=view` (spec 766 §F, stories 41–47, 755 items 4–5; ticket 775).
 *
 * Measures, breakdowns, filters and the period come from `Analytics/Model` only. The chart types offered
 * are the shape rules' (`./shape-rules`); each other type says why it is unavailable. Number format,
 * legend, series colours (the chart tokens only, by slot) and a title and subtitle in English and Arabic;
 * an empty title is generated from the model labels (`./title`). The preview asks `Analytics/Query` with
 * the inline definition and draws through the view page's own form dispatch (`ViewChart`). Saving is
 * `POST Analytics/Item`, Personal, then lands on the new view.
 *
 * Editing an existing view (776, `editItemLink(item)` from the view page) saves by its tier
 * (`./item-actions`) through the shared save path (`./use-item-save`): in place with `baseRevision`, or as
 * my copy; 403 offers the copy, 405 names who saved last and offers a copy or a reload.
 *
 * Seeded by route state (`newViewLink(seed)` in `./editor`) — 772's drill "Save as view" opens it so.
 * `kind=board`, and `/analytics/board/:id/edit`, are the board editor (777, `./BoardEditor`); its "build a new
 * view" opens this view editor in a dialog, which links the saved view as a panel instead of navigating.
 * `kind=report` is the report designer (828, `./ReportDesignerPage`).
 */
export default function AnalyticsEditorPage() {
  const { t } = useTranslation('boards')
  const [params] = useSearchParams()
  const location = useLocation()
  const { id: boardId } = useParams()
  const board = !!boardId || params.get('kind') === 'board'
  // 828: `?kind=report` is the report designer, on a new report.
  if (!boardId && params.get('kind') === 'report') return <ReportDesignerPage />
  const editing = board ? !!boardId : !!readEditorSeed(location.state)?.item
  return (
    <ScreenGate
      query={analyticsAccessQuery()}
      // 822 (spec 819 §E): the builder and editor routes are the author grant's; a runner's direct URL shows the
      // no-access state in the builder's own words.
      can={canAuthorAnalytics}
      ns="boards"
      keyPrefix="authorAccess"
      title={t(board ? (editing ? 'boardEditor.editTitle' : 'boardEditor.title') : editing ? 'editor.editTitle' : 'editor.title')}
      subtitle={t(board ? 'boardEditor.subtitle' : 'editor.subtitle')}
    >
      {/* Story 70: a report can be started from the builder too, not only the home — inside the author gate above. */}
      {!editing && (
        <div className="mb-3 flex justify-end">
          <Link to={NEW_REPORT_PATH} className={buttonClass('outlined')} data-analytics-builder-new-report>
            <FileText className="size-3.5" aria-hidden />
            {t('designer.newReportInstead')}
          </Link>
        </div>
      )}
      {board ? (
        <BoardEditorBody boardId={boardId ?? null} buildView={buildView} />
      ) : (
        <EditorBody />
      )}
    </ScreenGate>
  )
}

/** The board editor's "build a new view": this editor, empty, saving a Personal view and handing it back. */
const buildView: BuildView = (model, onSaved) => <ViewEditor model={model} seed={null} onReseed={() => {}} onSavedView={onSaved} />

function EditorBody() {
  const { t } = useTranslation('boards')
  const location = useLocation()
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })
  // Read once: the seed is where the editor STARTS, not a value it follows. A 405 "reload" re-seeds it
  // from the item as it is now, and the editor starts over (its `key`).
  const [seed, setSeed] = useState(() => readEditorSeed(location.state))
  const [start, setStart] = useState(0)

  if (model.error) {
    const refusal = analyticsRefusal(model.error, t('editor.loadFailed'))
    return <ErrorBanner title={t('editor.loadFailed')} message={refusalWords(refusal, t)} />
  }
  if (!model.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('editor.loading')}
      </div>
    )
  }
  return (
    <ViewEditor
      key={start}
      model={model.data}
      seed={seed}
      onReseed={(item) => {
        setSeed(readEditorSeed(editItemLink(item).state))
        setStart((n) => n + 1)
      }}
    />
  )
}

const EMPTY_LABEL: AnalyticsLabel = { en: '', ar: '' }
const PREVIEW_DEBOUNCE_MS = 250

function ViewEditor({
  model,
  seed,
  onReseed,
  onSavedView,
}: {
  model: AnalyticsModel
  seed: EditorSeed | null
  onReseed: (item: AnalyticsItem) => void
  /** Given (777's board editor), the saved view is handed back here instead of opening its page. */
  onSavedView?: (item: AnalyticsItem) => void
}) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const navigate = useNavigate()

  const start = seed?.definition
  const [measures, setMeasures] = useState<string[]>(start?.query.measures ?? [])
  const [dimensions, setDimensions] = useState<string[]>(start?.query.dimensions ?? [])
  const [filters, setFilters] = useState<AnalyticsFilter[]>(start?.query.filters ?? [])
  const [period, setPeriod] = useState<string>(start?.query.period ?? DEFAULT_PERIOD)
  const [grain, setGrain] = useState<Grain>(() => GRAINS.find((g) => g === start?.query.grain) ?? 'day')
  const [choice, setChoice] = useState<ChartChoice | null>(start ? choiceOf(start.chart) : null)
  const [settings, setSettings] = useState<AnalyticsChart>(start?.chart ?? { type: 'table' })
  const [compare, setCompare] = useState<boolean>(start?.query.compareToPrevious === true)
  const [slots, setSlots] = useState<Record<string, Record<string, number>>>(start?.slots ?? {})
  const [title, setTitle] = useState<AnalyticsLabel>(seed?.title ?? EMPTY_LABEL)
  const [subtitle, setSubtitle] = useState<AnalyticsLabel>(seed?.subtitle ?? EMPTY_LABEL)
  // 825: named series (up to 4), each with its own filters on the view's own category breakdowns.
  const [series, setSeries] = useState<AnalyticsSeries[]>(start?.series ?? [])

  const allowed = useMemo(() => allowedDimensions(measures, model), [measures, model])
  const allowedKeys = useMemo(() => new Set(allowed.map((d) => d.key)), [allowed])
  const offers = chartOffers({ measures, dimensions, series: series.length }, model)
  const offer = choice ? offers.find((o) => o.choice === choice) : undefined
  // A choice the new selection no longer fits is not drawn or saved; it comes back if the fit does. Until one is
  // picked (or while the pick does not fit) the builder picks the best fitting type, so the preview always draws.
  const suggested = suggestChoice(offers, { measures, dimensions, series: series.length }, model)
  const chosen = offer?.offered ? choice : suggested
  const keptGrain = grainFor(dimensions, model, grain)

  const definition: AnalyticsViewDefinition | null = useMemo(() => {
    if (!chosen) return null
    const { grain: _old, ...startQuery } = start?.query ?? { grain: null }
    void _old
    const query = withCompare(
      {
        ...startQuery,
        measures,
        dimensions,
        filters: filters.filter((f) => f.values.length > 0 && allowedKeys.has(f.dimension)),
        period,
        ...(keptGrain ? { grain: keptGrain } : {}),
      },
      chosen,
      compare,
    )
    // A series' filter with no value yet filters nothing; a view with no series carries no `series` at all.
    const named = series.map((x) => ({ ...x, filters: x.filters.filter((f) => f.values.length > 0) }))
    const { series: _oldSeries, ...rest } = start ?? {}
    void _oldSeries
    return { ...rest, chart: chartFor(chosen, settings), query, slots, ...(named.length ? { series: named } : {}) }
  }, [chosen, measures, dimensions, filters, allowedKeys, period, settings, slots, start, compare, keptGrain, series])

  // The preview asks for the definition a moment after the last change, not on every keystroke.
  const [asked, setAsked] = useState(definition)
  useEffect(() => {
    const id = setTimeout(() => setAsked(definition), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [definition])
  // 766 §C: the previous period's rows are asked for when the definition compares to it.
  const input = asked ? { definition: asked, ...comparing(asked) } : null
  const answer = useQuery({
    queryKey: analyticsQueryKey(input ?? { definition: { chart: { type: 'table' }, query: { measures: [], dimensions: [], filters: [] } } }),
    queryFn: () => analyticsApi.query(input!),
    enabled: !!input,
    placeholderData: keepPreviousData,
    retry: false,
  })

  // Series colours: the coloured breakdown's members on screen, if it is an open one.
  const colourDim = definition ? colourDimension(definition, model) : null
  const colourDimModel = dimensionOf(model, colourDim)
  const fixedColours = !!colourDimModel && colourDimModel.values.length > 0
  const members = useMemo(() => {
    if (!colourDim || fixedColours || !answer.data) return []
    return [...new Set(answer.data.rows.map((r) => String(r[colourDim] ?? '')))].filter(Boolean)
  }, [answer.data, colourDim, fixedColours])
  // An open breakdown's members read by name (`code · name`), looked up once from DimensionValues.
  const lookup = useQuery({
    queryKey: analyticsMembersKey(colourDim ?? '', ''),
    queryFn: () => analyticsApi.dimensionValues(colourDim!, ''),
    enabled: !!colourDim && !fixedColours && members.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const names = useMemo(() => new Map((lookup.data ?? []).map((m) => [m.key, m.label])), [lookup.data])
  const savedFor = (colourDim && slots[colourDim]) || {}
  const onScreen = settledSlots(savedFor, members)

  const editing = seed?.item ?? null
  const save = useItemSave({
    kind: 'view',
    editing,
    onSaved: (item, how) => {
      toast.success(t(how === 'copy' ? 'save.copied' : how === 'in-place' ? 'save.savedInPlace' : 'editor.saved'))
      if (onSavedView) onSavedView(item)
      else navigate(itemHref('view', item.id))
    },
  })
  const { actions } = save
  const onSave = (how: SaveHow) => {
    if (!definition) return
    // The member → slot map is written when the view is saved (766 §F), for the members on screen.
    const withSlots = colourDim && !fixedColours && members.length ? { ...definition, slots: { ...slots, [colourDim]: onScreen } } : definition
    save.save(how, { title, subtitle, definition: withSlots })
  }
  const primary: SaveHow | null = actions.save === 'read-only' ? null : actions.save
  const reload = () => save.reloadInto((item) => onReseed(item as AnalyticsItem))

  const refusalOf = (err: unknown) => (definition ? editorRefusal(err, definition, model, lang) : null)
  const previewRefusal = answer.error ? refusalOf(answer.error) : null
  const saveRefusal = save.error && !save.refusal ? refusalOf(save.error) : null
  // 825: the series checks — the web's mirror live, or the server's 411 list after a save.
  const seriesDims = useMemo(() => {
    const own = ownCategoryDimensions({ chart: settings, query: { measures, dimensions, filters: [] } }, model)
    return filterableDimensions(allowed).filter((d) => own.has(d.key))
  }, [allowed, measures, dimensions, settings, model])
  const liveProblems = useMemo(() => seriesProblems({ chart: settings, query: { measures, dimensions, filters: [] }, series }, model), [settings, measures, dimensions, series, model])
  const serverProblems = saveRefusal?.kind === 'declaration' ? saveRefusal.series : []
  const shownProblems = liveProblems.length ? liveProblems : serverProblems
  const invalidOn = (section: 'measure' | 'dimension' | 'chart') => {
    const r = [saveRefusal, previewRefusal].find((x) => x?.kind === 'invalid')
    return r?.kind === 'invalid' && !!r.field && r.field.toLowerCase().includes(section)
  }

  const pickMeasures = (next: string[]) => {
    setMeasures(next)
    const fits = new Set(allowedDimensions(next, model).map((d) => d.key))
    setDimensions((ds) => ds.filter((d) => fits.has(d)))
  }
  const setFilter = (dimension: string, values: string[]) =>
    setFilters((fs) => [...fs.filter((f) => f.dimension !== dimension), ...(values.length ? [{ dimension, values }] : [])])
  const label = (l: AnalyticsLabel | undefined, key: string) => saysIn(l, lang) || key
  const measureName = (k: string) => label(measureOf(model, k)?.label, k)

  const draft: AnalyticsViewDefinition = definition ?? { chart: settings, query: { measures, dimensions, filters, period } }
  const generated = {
    en: generatedTitle(draft, model, 'en', i18n.getFixedT('en', 'boards'), fsi),
    ar: generatedTitle(draft, model, 'ar', i18n.getFixedT('ar', 'boards'), fsi),
  }
  const shownTitle = saysIn(title, lang) || generatedTitle(draft, model, lang, i18n.getFixedT(lang, 'boards'))
  const shownSubtitle = saysIn(subtitle, lang)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(20rem,26rem)_1fr]" data-analytics-editor>
      <form className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4" onSubmit={(e) => e.preventDefault()}>
        <QueryFields
          model={model}
          lang={lang}
          measures={measures}
          onMeasures={pickMeasures}
          dimensions={dimensions}
          onDimensions={(next) => setDimensions(next.slice(0, MAX_DIMENSIONS))}
          allowed={allowed}
          filters={filters}
          onFilter={setFilter}
          period={period}
          onPeriod={setPeriod}
          invalid={{ measure: invalidOn('measure'), dimension: invalidOn('dimension') }}
          grain={grain}
          onGrain={setGrain}
        />
        <ChartFields
          offers={offers}
          chosen={chosen}
          suggested={!!chosen && chosen !== choice}
          onChoose={setChoice}
          invalid={invalidOn('chart')}
          measures={measures}
          measureName={measureName}
          settings={settings}
          onSettings={setSettings}
          compare={compare}
          onCompare={setCompare}
        />
        <SeriesFields
          series={series}
          onSeries={(next) => {
            setSeries(next)
            if (save.error) save.reset()
          }}
          dimensions={seriesDims}
          lang={lang}
          problems={shownProblems}
        />
        {series.length === 0 && (
        <ColourPicker
          fixedLabel={fixedColours ? label(colourDimModel?.label, colourDim ?? '') : null}
          members={members}
          onScreen={onScreen}
          wordsOf={(m) => colourMemberWords(colourDim ?? '', m, model, names, lang)}
          onPick={(m, s) => colourDim && setSlots((all) => ({ ...all, [colourDim]: withMemberSlot(all[colourDim] ?? {}, members, m, s) }))}
        />
        )}
        <TitleFields title={title} onTitle={setTitle} subtitle={subtitle} onSubtitle={setSubtitle} generated={generated} />

        <SaveStanding editing={editing} actions={actions} />
        {save.refusal ? (
          <SaveRefusalNote refusal={save.refusal} pending={save.pending} onCopy={() => onSave('copy')} onReload={reload} />
        ) : save.error && !(saveRefusal?.kind === 'declaration' && saveRefusal.series.length > 0) ? (
          <EditorRefusalNote
            refusal={saveRefusal}
            err={save.error}
            fallbackKey="editor.saveFailed"
            model={model}
            onShorten={(p) => {
              setPeriod(p)
              save.reset()
            }}
          />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {primary === 'in-place' && actions.actions.includes('saveAsCopy') && (
            <Button variant="secondary" onClick={() => onSave('copy')} disabled={!definition || save.pending} data-editor-save-copy>
              {save.pending && save.how === 'copy' ? t('editor.saving') : t('save.asCopy')}
            </Button>
          )}
          <Button
            onClick={() => primary && onSave(primary)}
            disabled={!definition || !primary || save.pending || liveProblems.length > 0}
            data-editor-save
            data-editor-save-how={primary ?? 'none'}
          >
            {save.pending && save.how === primary ? t('editor.saving') : t(primary === 'copy' ? 'save.asMyCopy' : 'editor.save')}
          </Button>
        </div>
      </form>

      <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" aria-label={t('editor.preview')} data-analytics-preview>
        <header className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{t('editor.preview')}</p>
          <h2 className="text-base font-semibold tracking-tight" data-analytics-preview-title>
            <bdi>{shownTitle}</bdi>
          </h2>
          {shownSubtitle && (
            <p className="text-sm text-muted-foreground">
              <bdi>{shownSubtitle}</bdi>
            </p>
          )}
        </header>
        {!asked ? (
          <p className="flex h-72 items-center justify-center text-sm text-muted-foreground" data-analytics-preview-idle>
            {t('editor.previewIdle')}
          </p>
        ) : answer.error && !answer.data ? (
          <EditorRefusalNote refusal={previewRefusal} err={answer.error} fallbackKey="view.queryFailed" model={model} onShorten={setPeriod} />
        ) : (
          // The view page's and the board panel's own form dispatch (771): the preview draws as the view will.
          <ViewChart result={answer.data} busy={answer.isFetching} definition={asked} model={model} lang={lang} />
        )}
      </section>
    </div>
  )
}
