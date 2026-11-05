import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Ban, Info } from 'lucide-react'
import { slotColour } from '@/core/charts/slots'
import i18n from '@/core/i18n'
import type {
  AnalyticsChart,
  AnalyticsFilter,
  AnalyticsItem,
  AnalyticsLabel,
  AnalyticsLegendPosition,
  AnalyticsModel,
  AnalyticsNumberFormat,
  AnalyticsViewDefinition,
} from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import MultiSelect from '@/core/ui/MultiSelect'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsQueryKey } from './api'
import { BoardEditorBody, type BuildView } from './BoardEditor'
import {
  allowedDimensions,
  colourDimension,
  DEFAULT_PERIOD,
  editItemLink,
  LEGEND_POSITIONS,
  MAX_DIMENSIONS,
  NUMBER_FORMATS,
  PERIODS,
  pickableMeasures,
  readEditorSeed,
  settledSlots,
  withMemberSlot,
  type EditorSeed,
} from './editor'
import { editorRefusal, type EditorRefusal } from './editor-refusal'
import { SaveRefusalNote, SaveStanding } from './SaveNotes'
import { chartFor, chartOffers, choiceOf, type ChartChoice } from './shape-rules'
import { generatedTitle } from './title'
import { labelIn } from './view-model'
import ViewChart from './ViewChart'
import { useItemSave, type SaveHow } from './use-item-save'
import { analyticsRefusal, refusalWords } from './wire'

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
 */
export default function AnalyticsEditorPage() {
  const { t } = useTranslation('boards')
  const [params] = useSearchParams()
  const location = useLocation()
  const { id: boardId } = useParams()
  const board = !!boardId || params.get('kind') === 'board'
  const editing = board ? !!boardId : !!readEditorSeed(location.state)?.item
  return (
    <ScreenGate
      query={analyticsAccessQuery()}
      can={canViewAnalytics}
      ns="boards"
      title={t(board ? (editing ? 'boardEditor.editTitle' : 'boardEditor.title') : editing ? 'editor.editTitle' : 'editor.title')}
      subtitle={t(board ? 'boardEditor.subtitle' : 'editor.subtitle')}
    >
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
  const [choice, setChoice] = useState<ChartChoice | null>(start ? choiceOf(start.chart) : null)
  const [settings, setSettings] = useState<AnalyticsChart>(start?.chart ?? { type: 'table' })
  const [slots, setSlots] = useState<Record<string, Record<string, number>>>(start?.slots ?? {})
  const [title, setTitle] = useState<AnalyticsLabel>(seed?.title ?? EMPTY_LABEL)
  const [subtitle, setSubtitle] = useState<AnalyticsLabel>(seed?.subtitle ?? EMPTY_LABEL)

  const allowed = useMemo(() => allowedDimensions(measures, model), [measures, model])
  const allowedKeys = useMemo(() => new Set(allowed.map((d) => d.key)), [allowed])
  const offers = chartOffers({ measures, dimensions }, model)
  const offer = choice ? offers.find((o) => o.choice === choice) : undefined
  // A choice the new selection no longer fits is not drawn or saved; it comes back if the fit does.
  const chosen = offer?.offered ? choice : null

  const definition: AnalyticsViewDefinition | null = useMemo(() => {
    if (!chosen) return null
    const query = {
      ...(start?.query ?? {}),
      measures,
      dimensions,
      filters: filters.filter((f) => f.values.length > 0 && allowedKeys.has(f.dimension)),
      period,
    }
    return { ...(start ?? {}), chart: chartFor(chosen, settings), query, slots }
  }, [chosen, measures, dimensions, filters, allowedKeys, period, settings, slots, start])

  // The preview asks for the definition a moment after the last change, not on every keystroke.
  const [asked, setAsked] = useState(definition)
  useEffect(() => {
    const id = setTimeout(() => setAsked(definition), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [definition])
  const input = asked ? { definition: asked } : null
  const answer = useQuery({
    queryKey: analyticsQueryKey(input ?? { definition: { chart: { type: 'table' }, query: { measures: [], dimensions: [], filters: [] } } }),
    queryFn: () => analyticsApi.query(input!),
    enabled: !!input,
    placeholderData: keepPreviousData,
    retry: false,
  })

  // Series colours: the coloured breakdown's members on screen, if it is an open one.
  const colourDim = definition ? colourDimension(definition, model) : null
  const colourDimModel = model.dimensions.find((d) => d.key === colourDim)
  const fixedColours = !!colourDimModel && colourDimModel.values.length > 0
  const members = useMemo(() => {
    if (!colourDim || fixedColours || !answer.data) return []
    return [...new Set(answer.data.rows.map((r) => String(r[colourDim] ?? '')))].filter(Boolean)
  }, [answer.data, colourDim, fixedColours])
  const savedFor = (colourDim && slots[colourDim]) || {}
  const onScreen = settledSlots(savedFor, members)

  const editing = seed?.item ?? null
  const save = useItemSave({
    kind: 'view',
    editing,
    onSaved: (item, how) => {
      toast.success(t(how === 'copy' ? 'save.copied' : how === 'in-place' ? 'save.savedInPlace' : 'editor.saved'))
      if (onSavedView) onSavedView(item)
      else navigate(`/analytics/view/${encodeURIComponent(item.id)}`)
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
  const reload = () => {
    save
      .reload()
      .then((item) => onReseed(item as AnalyticsItem))
      .catch(() => toast.error(t('save.reloadFailed')))
  }

  const refusalOf = (err: unknown) => (definition ? editorRefusal(err, definition, model) : null)
  const previewRefusal = answer.error ? refusalOf(answer.error) : null
  const saveRefusal = save.error && !save.refusal ? refusalOf(save.error) : null
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
  const label = (l: AnalyticsLabel | undefined, key: string) => labelIn(l, lang) || key
  const measureName = (k: string) => label(model.measures.find((m) => m.key === k)?.label, k)

  const draft: AnalyticsViewDefinition = definition ?? { chart: settings, query: { measures, dimensions, filters, period } }
  const generated = {
    en: generatedTitle(draft, model, 'en', i18n.getFixedT('en', 'boards'), fsi),
    ar: generatedTitle(draft, model, 'ar', i18n.getFixedT('ar', 'boards'), fsi),
  }
  const shownTitle = labelIn(title, lang) || generatedTitle(draft, model, lang, i18n.getFixedT(lang, 'boards'))
  const shownSubtitle = labelIn(subtitle, lang)
  const unavailableAreas = model.areas.filter((a) => !a.available)
  const sortValue = settings.sort ? `${settings.sort.key}:${settings.sort.direction}` : ''

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(20rem,26rem)_1fr]" data-analytics-editor>
      <form className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4" onSubmit={(e) => e.preventDefault()}>
        <Field label={t('editor.measures')} invalid={invalidOn('measure')}>
          <MultiSelect
            label={t('editor.measures')}
            value={measures}
            onChange={pickMeasures}
            options={pickableMeasures(model).map((m) => ({ value: m.key, text: labelIn(m.label, lang) || m.key }))}
            data-testid="editor-measures"
          />
        </Field>
        {unavailableAreas.length > 0 && (
          <div className="-mt-2 text-xs text-muted-foreground" data-analytics-unavailable-areas>
            <span className="font-medium">{t('editor.unavailableAreas')}</span>
            <ul className="mt-0.5 flex flex-col gap-0.5">
              {unavailableAreas.map((a) => (
                <li key={a.key} data-analytics-unavailable-area={a.key}>
                  <Trans
                    t={t}
                    i18nKey="editor.areaReason"
                    values={{ area: a.key, reason: fsi(a.unavailableReason ?? '') }}
                    components={{ area: <Ltr /> }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field label={t('editor.dimensions')} hint={t('editor.dimensionsHint')} invalid={invalidOn('dimension')}>
          <MultiSelect
            label={t('editor.dimensions')}
            value={dimensions}
            onChange={(next) => setDimensions(next.slice(0, MAX_DIMENSIONS))}
            options={allowed.map((d) => ({ value: d.key, text: labelIn(d.label, lang) || d.key }))}
            data-testid="editor-dimensions"
          />
        </Field>

        {allowed
          .filter((d) => d.values.length > 0)
          .map((d) => (
            <Field key={d.key} label={t('editor.filterOn', { dimension: fsi(labelIn(d.label, lang) || d.key) })}>
              <MultiSelect
                label={t('editor.filterOn', { dimension: fsi(labelIn(d.label, lang) || d.key) })}
                value={filters.find((f) => f.dimension === d.key)?.values ?? []}
                onChange={(values) => setFilter(d.key, values)}
                options={d.values.map((v) => ({ value: v.key, text: labelIn(v.label, lang) || v.key }))}
                data-testid={`editor-filter-${d.key}`}
              />
            </Field>
          ))}

        <Field label={t('editor.period')}>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} data-editor-period>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`editor.periodName.${p}`)}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset className="flex flex-col gap-2" data-analytics-chart-types aria-invalid={invalidOn('chart') || undefined}>
          <legend className="text-xs font-medium text-muted-foreground">{t('editor.chart')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {offers.map((o) => (
              <Chip
                key={o.choice}
                on={chosen === o.choice}
                aria-disabled={!o.offered || undefined}
                title={o.offered ? undefined : t(`editor.why.${o.reason}`)}
                onClick={() => o.offered && setChoice(o.choice)}
                data-analytics-choice={o.choice}
                data-offered={o.offered ? 'yes' : 'no'}
              >
                {t(`editor.choice.${o.choice}`)}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('editor.chartHint')}</p>
          {offer?.offered && offer.folds && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground" data-analytics-folds>
              <Info className="size-3.5" aria-hidden />
              {t('editor.folds')}
            </p>
          )}
          {measures.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground" data-analytics-why-not>
              {offers.map((o) =>
                o.offered ? null : (
                  <li key={o.choice} className="flex gap-1" data-analytics-why={o.choice}>
                    <Ban className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span>
                      <span className="font-medium text-foreground">{t(`editor.choice.${o.choice}`)}</span> {t(`editor.why.${o.reason}`)}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('editor.format')}>
            <Select
              value={settings.format ?? 'auto'}
              onChange={(e) => setSettings((s) => ({ ...s, format: e.target.value as AnalyticsNumberFormat }))}
              data-editor-format
            >
              {NUMBER_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`editor.formatName.${f}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('editor.legend')}>
            <Select
              value={settings.legend ?? 'bottom'}
              onChange={(e) => setSettings((s) => ({ ...s, legend: e.target.value as AnalyticsLegendPosition }))}
              data-editor-legend
            >
              {LEGEND_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {t(`editor.legendName.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('editor.sort')}>
            <Select
              value={sortValue}
              onChange={(e) => {
                const [key, direction] = e.target.value.split(':')
                setSettings((s) => ({ ...s, sort: key ? { key, direction: direction === 'asc' ? 'asc' : 'desc' } : null }))
              }}
              data-editor-sort
            >
              <option value="">{t('editor.sortDefault')}</option>
              {measures.flatMap((m) => [
                <option key={`${m}:desc`} value={`${m}:desc`}>
                  {t('editor.sortDesc', { column: fsi(measureName(m)) })}
                </option>,
                <option key={`${m}:asc`} value={`${m}:asc`}>
                  {t('editor.sortAsc', { column: fsi(measureName(m)) })}
                </option>,
              ])}
            </Select>
          </Field>
          <Field label={t('editor.topN')}>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={settings.topN ?? ''}
              placeholder={t('editor.topNPlaceholder')}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                setSettings((s) => ({ ...s, topN: Number.isFinite(n) && n > 0 ? n : null }))
              }}
              data-editor-top-n
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5" data-analytics-colours>
          <span className="text-xs font-medium text-muted-foreground">{t('editor.colours')}</span>
          {fixedColours ? (
            <p className="text-xs text-muted-foreground">{t('editor.coloursFixed', { dimension: fsi(label(colourDimModel?.label, colourDim ?? '')) })}</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('editor.coloursNone')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((m) => (
                <li key={m} className="flex items-center gap-2" data-analytics-colour-member={m}>
                  <span className="min-w-16 text-xs">
                    <bdi>{m}</bdi>
                  </span>
                  <div className="flex gap-1" role="group" aria-label={t('editor.colourFor', { member: fsi(m) })}>
                    {[0, 1, 2, 3, 4].map((s) => (
                      <Chip
                        key={s}
                        on={onScreen[m] === s}
                        className="px-1.5"
                        aria-label={t('editor.colourSlot', { n: s + 1 })}
                        onClick={() => colourDim && setSlots((all) => ({ ...all, [colourDim]: withMemberSlot(all[colourDim] ?? {}, members, m, s) }))}
                        data-colour-slot={s}
                      >
                        <span className="block size-3 rounded-full" style={{ background: slotColour(s) }} aria-hidden />
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('editor.titleEn')} hint={t('editor.titleHint')}>
            <Input value={title.en} dir="ltr" placeholder={generated.en} onChange={(e) => setTitle((x) => ({ ...x, en: e.target.value }))} data-editor-title="en" />
          </Field>
          <Field label={t('editor.titleAr')}>
            <Input value={title.ar} dir="rtl" placeholder={generated.ar} onChange={(e) => setTitle((x) => ({ ...x, ar: e.target.value }))} data-editor-title="ar" />
          </Field>
          <Field label={t('editor.subtitleEn')}>
            <Input value={subtitle.en} dir="ltr" onChange={(e) => setSubtitle((x) => ({ ...x, en: e.target.value }))} data-editor-subtitle="en" />
          </Field>
          <Field label={t('editor.subtitleAr')}>
            <Input value={subtitle.ar} dir="rtl" onChange={(e) => setSubtitle((x) => ({ ...x, ar: e.target.value }))} data-editor-subtitle="ar" />
          </Field>
        </div>

        <SaveStanding editing={editing} actions={actions} />
        {save.refusal ? (
          <SaveRefusalNote refusal={save.refusal} pending={save.pending} onCopy={() => onSave('copy')} onReload={reload} />
        ) : save.error ? (
          <RefusalNote
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
            disabled={!definition || !primary || save.pending}
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
          <RefusalNote refusal={previewRefusal} err={answer.error} fallbackKey="view.queryFailed" model={model} onShorten={setPeriod} />
        ) : (
          // The view page's and the board panel's own form dispatch (771): the preview draws as the view will.
          <ViewChart result={answer.data} busy={answer.isFetching} definition={asked} model={model} lang={lang} />
        )}
      </section>
    </div>
  )
}

/** 406 names the field, 407 offers the shorter window, 410 shows the area's reason; else the server's words. */
function RefusalNote({
  refusal,
  err,
  fallbackKey,
  model,
  onShorten,
}: {
  refusal: EditorRefusal | null
  err: unknown
  fallbackKey: string
  model: AnalyticsModel
  onShorten: (period: string) => void
}) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  if (!refusal) {
    const r = analyticsRefusal(err, t(fallbackKey))
    return <ErrorBanner title={t(fallbackKey)} message={refusalWords(r, t)} />
  }
  if (refusal.kind === 'window') {
    const measure = labelIn(model.measures.find((m) => m.key === refusal.measure)?.label, lang) || refusal.measure
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-analytics-refusal="window">
        <span className="min-w-0 flex-1">{t('editor.refused.window', { measure: fsi(measure), days: fsi(refusal.days) })}</span>
        {refusal.shorter && (
          <Button variant="secondary" onClick={() => onShorten(refusal.shorter!)} data-analytics-shorten={refusal.shorter}>
            {t('editor.refused.shorten', { period: t(`editor.period.${refusal.shorter}`) })}
          </Button>
        )}
      </div>
    )
  }
  const words =
    refusal.kind === 'invalid'
      ? refusal.field
        ? t('editor.refused.invalidField', { field: fsi(refusal.field) })
        : refusal.message || t('refusal.invalid')
      : t('editor.refused.area', { reason: fsi(refusal.reason) })
  return (
    <div className="rounded-lg border border-danger-border bg-danger-050 p-3 text-sm text-danger-800" role="alert" data-analytics-refusal={refusal.kind}>
      <bdi>{words}</bdi>
    </div>
  )
}
