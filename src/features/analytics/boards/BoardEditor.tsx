import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Heading, Plus, Sparkles, Type } from 'lucide-react'
import { itemHref } from '@/core/analytics-routes'
import { apiErrorCode } from '@/core/api'
import i18n from '@/core/i18n'
import type { AnalyticsBoard, AnalyticsBoardDefinition, AnalyticsBoardPanel, AnalyticsItem, AnalyticsLabel, AnalyticsModel, Param } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey, analyticsItemsKey } from './api'
import { BOARD_REFRESH_SECONDS, BASE_FILTERS, NO_WAVE } from './board'
import { addParam, bindPanel, blankParam, canBind, keptBindings, removeParam, validate, type Declarations } from './bindings'
import DeclarationProblems from './DeclarationProblems'
import { declarationRefusal, type DeclarationProblem } from './editor-refusal'
import BoardEditorGrid, { type PanelView } from './BoardEditorGrid'
import FilterStrip from './FilterStrip'
import { editingItemOf } from './item-save'
import { layoutReducer, minSizeOf, type LayoutState } from './layout'
import { boardParams, convertV1Board, defaultsOf, readyMadeParams, v1Of } from './params'
import ParamInspector, { type InspectorFocus, type InspectorPanel } from './ParamInspector'
import Refused from './Refused'
import { SaveRefusalNote, SaveStanding } from './SaveNotes'
import { useItemSave, type SaveHow } from './use-item-save'
import { analyticsRefusal, refusalWords } from './wire'
import { viewTitleOf } from './ViewChart'
import ViewPicker from './ViewPicker'

/**
 * The board editor (spec 766 §F, 755 items 7–11, ticket 777) at `/analytics/board/:id/edit` and
 * `/analytics/new?kind=board`: lay panels out on the 12-column grid (`./BoardEditorGrid`, `./layout`); add a
 * panel from a view I can read (mine, Shared or Certified) linked by reference, or build a new view with 775's
 * editor (saved as a view, then linked); text and section-header panels; the board's filters, each panel's
 * cross-filter opt-out and a default refresh interval. A view that was deleted shows "view removed" and blocks nothing.
 * Since 824 the board declares parameters (the six ready-made ones to start with): the strip in design mode
 * sets their defaults, the gear and "+ Parameter" open the parameter inspector (`./ParamInspector`), and each
 * parameter's bindings replace v1's filter opt-outs. Saving runs `validate`; a 411 lists every problem.
 * Saving goes through 776's shared path (`useItemSave({ kind: 'board' })`): create, in place or as my copy.
 */

/** 775's view editor, handed in by the page so this module never imports it (no import cycle). */
export type BuildView = (model: AnalyticsModel, onSaved: (item: AnalyticsItem) => void) => ReactNode

export function BoardEditorBody({ boardId, buildView }: { boardId: string | null; buildView: BuildView }) {
  const { t } = useTranslation('boards')
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })
  const board = useQuery({ queryKey: analyticsBoardKey(boardId ?? ''), queryFn: () => analyticsApi.board(boardId!), enabled: !!boardId, retry: false })
  // A 405 "reload" starts the editor over from the board as it is now (its `key`).
  const [start, setStart] = useState(0)

  if (board.error) return <Refused err={board.error} fallbackKey="board.loadFailed" what="board" />
  if (model.error) {
    const r = analyticsRefusal(model.error, t('editor.loadFailed'))
    return <ErrorBanner title={t('editor.loadFailed')} message={refusalWords(r, t)} />
  }
  if (!model.data || (boardId && !board.data)) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('editor.loading')}
      </div>
    )
  }
  return <BoardEditor key={`${boardId ?? 'new'}:${start}`} model={model.data} board={board.data ?? null} buildView={buildView} onReseed={() => setStart((n) => n + 1)} />
}

const EMPTY_LABEL: AnalyticsLabel = { en: '', ar: '' }
const newPanelId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

function BoardEditor({ model, board, buildView, onReseed }: { model: AnalyticsModel; board: AnalyticsBoard | null; buildView: BuildView; onReseed: () => void }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const navigate = useNavigate()
  const def = board?.definition

  const [title, setTitle] = useState<AnalyticsLabel>(board?.title ?? EMPTY_LABEL)
  const [subtitle, setSubtitle] = useState<AnalyticsLabel>(board?.subtitle ?? EMPTY_LABEL)
  const [layout, dispatch] = useReducer(layoutReducer, { panels: def?.panels ?? [], mins: {} } satisfies LayoutState)
  // 824: the board's parameters and bindings, in the order the author declared them. A new board starts with
  // the six ready-made parameters; a v1 board opens converted (its filters as defaults, v1's implicit rule as
  // bindings — computed again below once its views are known, as the server converts on read).
  const [decl, setDecl] = useState<Declarations>(() => (def ? boardParams(def) : { params: readyMadeParams(BASE_FILTERS), bindings: {} }))
  const v1 = useRef(!!def && !(def.params && def.bindings))
  const edit = (f: (d: Declarations) => Declarations) => {
    v1.current = false
    setDecl(f)
  }
  const [selected, setSelected] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [focus, setFocus] = useState<InspectorFocus | null>(null)
  const [problems, setProblems] = useState<DeclarationProblem[] | null>(null)
  const [dismissed, setDismissed] = useState<unknown>(null)
  const [refresh, setRefresh] = useState<number>(def?.refresh ?? 0)
  const [pick, setPick] = useState('')
  const [building, setBuilding] = useState(false)

  // The views I can link: every view the store lists for me, Certified first, then Shared, then mine.
  const list = useQuery({ queryKey: analyticsItemsKey({ kind: 'view' }), queryFn: () => analyticsApi.items({ kind: 'view' }), retry: false })

  // Each view panel's view: its title, its chart type (so its minimum size), or "view removed".
  const viewPanels = layout.panels.filter((p): p is Extract<AnalyticsBoardPanel, { kind: 'view' }> => p.kind === 'view')
  const items = useQueries({
    queries: viewPanels.map((p) => ({ queryKey: analyticsItemKey(p.viewId), queryFn: () => analyticsApi.item(p.viewId), staleTime: 60_000, retry: false })),
  })
  const views = new Map<string, PanelView>(
    viewPanels.map((p, i) => {
      const q = items[i]
      const v: PanelView = q.data
        ? { state: 'loaded', item: q.data }
        : q.error
          ? apiErrorCode(q.error) === 'ANALYTICS-404'
            ? { state: 'removed' }
            : { state: 'failed' }
          : { state: 'loading' }
      return [p.id, v]
    }),
  )
  const bindPanels: InspectorPanel[] = viewPanels.map((p) => {
    const v = views.get(p.id)
    return v?.state === 'loaded' ? { id: p.id, title: viewTitleOf(v.item, model, lang, t), definition: v.item.definition } : { id: p.id, title: t('boardEditor.kind.view'), definition: null }
  })
  const settled = viewPanels.every((p) => views.get(p.id)?.state !== 'loading')
  useEffect(() => {
    if (!v1.current || !settled || !def) return
    v1.current = false
    const reaches = (p: { id: string }, dimension: string) => {
      const v = views.get(p.id)
      const probe: Param = { name: 'probe', kind: 'members', label: EMPTY_LABEL, required: false, dimension, default: { kind: 'members', values: [] } }
      return v?.state !== 'loaded' || canBind(probe, v.item.definition, model).ok
    }
    setDecl((d) => ({ ...d, bindings: convertV1Board(def, reaches).bindings }))
    // Once, when a v1 board's views are first all known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled])
  const chartOf = viewPanels.map((p) => `${p.id}=${views.get(p.id)?.state === 'loaded' ? (views.get(p.id) as { item: AnalyticsItem }).item.definition.chart.type : ''}`).join(',')
  useEffect(() => {
    for (const p of viewPanels) {
      const v = views.get(p.id)
      if (v?.state !== 'loaded') continue
      const min = minSizeOf({ kind: 'view', chart: v.item.definition.chart.type })
      const known = layout.mins[p.id]
      if (!known || known.w !== min.w || known.h !== min.h) dispatch({ type: 'min', id: p.id, size: min })
    }
    // Keyed on each panel's chart type: a new view or a loaded one re-learns its minimum, nothing else does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartOf])

  const addView = (item: AnalyticsItem) => {
    const id = newPanelId()
    dispatch({
      type: 'add',
      panel: { id, kind: 'view', viewId: item.id, layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] },
      min: minSizeOf({ kind: 'view', chart: item.definition.chart.type }),
    })
    // A new panel binds every parameter that can take it, as v1's filters reached a new panel.
    edit((d) => bindPanel(d, { id, definition: item.definition }, model))
  }
  const addParamHere = () => {
    const param = blankParam('members', decl.params.map((p) => p.name), model)
    edit((d) => addParam(d, param, bindPanels, model))
    setSelected(param.name)
    setFresh(param.name)
    setFocus(null)
  }
  const openParam = (name: string) => {
    setSelected(name)
    setFresh((f) => (f === name ? f : null))
    setFocus(null)
  }
  const goTo = (p: DeclarationProblem) => {
    if (p.what === 'series' || p.what === 'figure' || p.what === 'summary') return
    openParam(p.param)
    setFocus({ field: p.what === 'name' ? 'name' : p.what === 'binding' ? 'binding' : 'default', panel: p.what === 'binding' ? p.panel : undefined, at: Date.now() })
  }
  const panelTitle = (id: string) => bindPanels.find((p) => p.id === id)?.title ?? id
  const addWords = (kind: 'text' | 'section') =>
    dispatch({
      type: 'add',
      panel:
        kind === 'text'
          ? { id: newPanelId(), kind, text: EMPTY_LABEL, layout: { x: 0, y: 0, w: 6, h: 1 } }
          : { id: newPanelId(), kind, title: EMPTY_LABEL, layout: { x: 0, y: 0, w: 12, h: 1 } },
      min: minSizeOf({ kind }),
    })

  const editing = board ? editingItemOf({ ...board, kind: 'board' }) : null
  const save = useItemSave({
    kind: 'board',
    editing,
    onSaved: (item, how) => {
      toast.success(t(how === 'copy' ? 'save.copied' : how === 'in-place' ? 'save.savedInPlace' : 'boardEditor.saved'))
      navigate(itemHref('board', item.id))
    },
  })
  const { actions } = save
  // The board saves its parameters and bindings (to panels still on it), and — so a v1 server still reads it —
  // the v1 shape they mean: the ready-made defaults as `filters`, each panel's unbound ones as its `optOut`.
  const bindings = keptBindings(decl.bindings, new Set(layout.panels.map((p) => p.id)))
  const compat = v1Of({ panels: layout.panels, params: decl.params, bindings })
  const definition: AnalyticsBoardDefinition = { panels: compat.panels, filters: compat.filters, params: decl.params, bindings, ...(refresh > 0 ? { refresh } : {}) }
  const onSave = (how: SaveHow) => {
    const found = validate(decl.params, bindings, bindPanels, model)
    setProblems(found.length > 0 ? found : null)
    if (found.length === 0) save.save(how, { title, subtitle, definition })
  }
  const server = save.error && save.error !== dismissed ? declarationRefusal(save.error) : null
  const listed = problems ?? (server && server.problems.length > 0 ? server.problems : null)
  const primary: SaveHow | null = actions.save === 'read-only' ? null : actions.save
  const reload = () => save.reloadInto(onReseed)

  return (
    <div className={'grid items-start gap-4 ' + (selected ? 'lg:grid-cols-[minmax(0,1fr)_26rem]' : '')} data-board-editor={board?.id ?? 'new'}>
    <div className="flex min-w-0 flex-col gap-4">
      <section className="grid gap-3 rounded-lg border border-border/60 bg-card p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_12rem]">
        <Field label={t('editor.titleEn')}>
          <Input value={title.en} dir="ltr" onChange={(e) => setTitle((x) => ({ ...x, en: e.target.value }))} data-board-title="en" />
        </Field>
        <Field label={t('editor.titleAr')}>
          <Input value={title.ar} dir="rtl" onChange={(e) => setTitle((x) => ({ ...x, ar: e.target.value }))} data-board-title="ar" />
        </Field>
        <Field label={t('editor.subtitleEn')}>
          <Input value={subtitle.en} dir="ltr" onChange={(e) => setSubtitle((x) => ({ ...x, en: e.target.value }))} data-board-subtitle="en" />
        </Field>
        <Field label={t('editor.subtitleAr')}>
          <Input value={subtitle.ar} dir="rtl" onChange={(e) => setSubtitle((x) => ({ ...x, ar: e.target.value }))} data-board-subtitle="ar" />
        </Field>
        <Field label={t('boardEditor.refresh')} hint={t('boardEditor.refreshHint')}>
          <Select value={String(refresh)} onChange={(e) => setRefresh(Number(e.target.value))} data-board-refresh>
            {BOARD_REFRESH_SECONDS.map((s) => (
              <option key={s} value={s}>
                {t(`boardEditor.refreshEvery.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{t('boardEditor.filters')}</p>
        <FilterStrip
          params={decl.params}
          values={defaultsOf(decl.params)}
          onChange={(v) => edit((d) => ({ ...d, params: d.params.map((p) => (v[p.name] ? { ...p, default: v[p.name] } : p)) }))}
          model={model}
          lang={lang}
          wave={NO_WAVE}
          design={{ selected, onEdit: openParam, onAdd: addParamHere }}
        />
      </div>

      <section className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3" aria-label={t('boardEditor.add')} data-board-editor-add>
        <Field label={t('boardEditor.addView')} className="min-w-64 flex-1">
          <ViewPicker items={list.data} value={pick} onChange={setPick} placeholder={t(list.isLoading ? 'boardEditor.viewsLoading' : 'boardEditor.pickView')} model={model} lang={lang} data-board-add-pick="" />
        </Field>
        <Button
          variant="secondary"
          disabled={!pick}
          onClick={() => {
            const item = list.data?.find((i) => i.id === pick)
            if (item) addView(item)
            setPick('')
          }}
          data-board-add-view
        >
          <Plus className="size-4" aria-hidden />
          {t('boardEditor.addThisView')}
        </Button>
        <Button variant="secondary" onClick={() => setBuilding(true)} data-board-build-view>
          <Sparkles className="size-4" aria-hidden />
          {t('boardEditor.buildView')}
        </Button>
        <Button variant="secondary" onClick={() => addWords('text')} data-board-add-text>
          <Type className="size-4" aria-hidden />
          {t('boardEditor.addText')}
        </Button>
        <Button variant="secondary" onClick={() => addWords('section')} data-board-add-section>
          <Heading className="size-4" aria-hidden />
          {t('boardEditor.addSection')}
        </Button>
      </section>

      {layout.panels.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-board-editor-empty>
          {t('boardEditor.empty')}
        </p>
      ) : (
        <BoardEditorGrid layout={layout} dispatch={dispatch} views={views} model={model} lang={lang} />
      )}

      <div className="flex flex-col gap-2">
        <SaveStanding editing={editing} actions={actions} />
        {listed ? (
          <DeclarationProblems
            problems={listed}
            params={decl.params}
            panelTitle={panelTitle}
            lang={lang}
            onGo={goTo}
            onClose={() => {
              setProblems(null)
              setDismissed(save.error)
            }}
          />
        ) : save.refusal ? (
          <SaveRefusalNote refusal={save.refusal} pending={save.pending} onCopy={() => onSave('copy')} onReload={reload} />
        ) : save.error ? (
          <ErrorBanner title={t('boardEditor.saveFailed')} message={refusalWords(analyticsRefusal(save.error, t('boardEditor.saveFailed')), t)} />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {primary === 'in-place' && actions.actions.includes('saveAsCopy') && (
            <Button variant="secondary" onClick={() => onSave('copy')} disabled={save.pending} data-editor-save-copy>
              {save.pending && save.how === 'copy' ? t('editor.saving') : t('save.asCopy')}
            </Button>
          )}
          <Button onClick={() => primary && onSave(primary)} disabled={!primary || save.pending || layout.panels.length === 0} data-editor-save data-editor-save-how={primary ?? 'none'}>
            {save.pending && save.how === primary ? t('editor.saving') : t(primary === 'copy' ? 'save.asMyCopy' : 'boardEditor.save')}
          </Button>
        </div>
      </div>

    </div>
      {selected && (
        <ParamInspector
          decl={decl}
          name={selected}
          fresh={fresh === selected}
          panels={bindPanels}
          model={model}
          lang={lang}
          focus={focus}
          onChange={(next, name) => {
            edit(() => next)
            if (name !== selected) {
              setSelected(name)
              setFresh((f) => (f === selected ? name : f))
            }
          }}
          onSelect={openParam}
          onRemove={() => {
            edit((d) => removeParam(d, selected))
            setSelected(null)
          }}
          onClose={() => {
            setSelected(null)
            setFocus(null)
          }}
        />
      )}

      <Modal open={building} onClose={() => setBuilding(false)} title={t('boardEditor.buildView')} width="76rem">
        {building &&
          buildView(model, (item) => {
            addView(item)
            setBuilding(false)
          })}
      </Modal>
    </div>
  )
}
