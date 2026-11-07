import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlignHorizontalJustifyStart, AlignVerticalJustifyStart, ArrowUpToLine, Copy, Eye, Heading, Keyboard, MoveHorizontal, Redo2, Sparkles, Trash2, Type, Undo2 } from 'lucide-react'
import { itemHref } from '@/core/analytics-routes'
import { apiErrorCode } from '@/core/api'
import i18n from '@/core/i18n'
import type { AnalyticsBoard, AnalyticsBoardDefinition, AnalyticsBoardPanel, AnalyticsItem, AnalyticsLabel, AnalyticsModel, Param } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import PaneSeparator, { useRememberedPaneWidth, useViewportWidth } from '@/core/ui/PaneSeparator'
import Select from '@/core/ui/Select'
import type { PaneBounds } from '@/core/ui/inspector-pane'
import { saysIn } from '@/core/rules/sentence'
import { fsi } from '@/core/util/bidi'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey, analyticsItemsKey } from './api'
import { BOARD_REFRESH_SECONDS, BASE_FILTERS, NO_WAVE } from './board'
import { addParam, bindPanel, blankParam, canBind, keptBindings, removeParam, validate, type Declarations } from './bindings'
import DeclarationProblems from './DeclarationProblems'
import { declarationRefusal, type DeclarationProblem } from './editor-refusal'
import BoardEditorGrid, { typingIn, type PanelView } from './BoardEditorGrid'
import BoardEditorSide, { useSideCollapsed, type OutlineEntry } from './BoardEditorSide'
import BoardShortcuts from './BoardShortcuts'
import { canRedo, canUndo, copyBindings, outlineOf, record, redo, startHistory, undo } from './board-history'
import FilterStrip from './FilterStrip'
import { editingItemOf } from './item-save'
import { layoutReducer, minSizeOf, type Cell, type LayoutAction, type LayoutState, type Size } from './layout'
import { boardParams, convertV1Board, defaultsOf, readyMadeParams, v1Of } from './params'
import ParamInspector, { type InspectorFocus, type InspectorPanel } from './ParamInspector'
import Refused from './Refused'
import { SaveRefusalNote, SaveStanding } from './SaveNotes'
import { useItemSave, type SaveHow } from './use-item-save'
import { AiStepNotice, EditWithCopilot, useBoardInContext } from './ReportDesignerCopilot'
import { analyticsRefusal, refusalWords } from './wire'
import { viewTitleOf } from './ViewChart'
import BoardPreview from './BoardPreview'
import { definitionKnown } from './palette'

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
/** The size a new view panel asks for (at least its chart's minimum). */
const VIEW_ASK: Size = { w: 6, h: 3 }
const newPanelId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
/** 846 item 3: the side list's width (px): 17rem to open, the separator between 200 and 520. */
const SIDE_BOUNDS: PaneBounds = { default: 272, min: 200, max: 520, step: 16, viewportShare: 0.4 }
const SIDE_ID = 'board-editor-side'

/** 846 item 4: what one undo step puts back — the layout and the fields. */
interface Snap {
  panels: AnalyticsBoardPanel[]
  decl: Declarations
  refresh: number
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
}
const sameSnap = (a: Snap, b: Snap) =>
  a.decl === b.decl && a.refresh === b.refresh && a.title === b.title && a.subtitle === b.subtitle && (a.panels === b.panels || JSON.stringify(a.panels) === JSON.stringify(b.panels))

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
  const [building, setBuilding] = useState(false)
  // 837: Preview shows the working copy as a viewer sees it. The editor stays mounted (hidden) behind it, so every
  // piece of its state — layout, parameters, selection, the AI step, its children's own — is there on the way back.
  const [previewing, setPreviewing] = useState(false)
  // 837: the palette view being dragged, for the grid's drop outline.
  const [dragging, setDragging] = useState<AnalyticsItem | null>(null)
  const queryClient = useQueryClient()

  // 846 item 4: undo and redo. The live state is recorded after each change; a running pointer drag records nothing
  // (`gesturing`), so a whole drag is one step. `hint` says what the change just made was: a typing run (`key`, one
  // step while it runs) or something the editor learned by itself (`rebase`, no step).
  const live: Snap = { panels: layout.panels, decl, refresh, title, subtitle }
  const [history, setHistory] = useState(() => startHistory<Snap>(live))
  const [gesturing, setGesturing] = useState(false)
  const hint = useRef<{ key?: string; rebase?: boolean }>({})
  const typed = (key: string) => (hint.current = { key })
  useEffect(() => {
    const h = hint.current
    if (!gesturing) hint.current = {}
    setHistory((past) => record(past, live, sameSnap, { time: Date.now(), gesture: gesturing, ...h }))
    // Keyed on the parts of the live state, and on a gesture ending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.panels, decl, refresh, title, subtitle, gesturing])
  const restore = (s: Snap) => {
    dispatch({ type: 'reset', state: { panels: s.panels, mins: layout.mins } })
    setDecl(s.decl)
    setRefresh(s.refresh)
    setTitle(s.title)
    setSubtitle(s.subtitle)
  }
  const stepBack = () => {
    if (!canUndo(history)) return
    const h = undo(history)
    setHistory(h)
    restore(h.at)
  }
  const stepOn = () => {
    if (!canRedo(history)) return
    const h = redo(history)
    setHistory(h)
    restore(h.at)
  }

  // 846 item 7: the selected panels (only those still on the board count).
  const [picked, setPicked] = useState<string[]>([])
  const onBoard = new Set(layout.panels.map((p) => p.id))
  const chosen = picked.filter((id) => onBoard.has(id))
  const pick = (id: string | null, add: boolean) => setPicked(id === null ? [] : add ? (chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]) : [id])
  const [sheet, setSheet] = useState(false)
  // What the editor last did, for the live region (and the drive): Close gaps' outcome.
  const [status, setStatus] = useState('')
  const [sideWidth, setSideWidth] = useRememberedPaneWidth('oms.boardEditor.sideWidth', SIDE_BOUNDS)
  const viewport = useViewportWidth()
  const [sideCollapsed, setSideCollapsed] = useSideCollapsed()
  const root = useRef<HTMLDivElement>(null)

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
    hint.current = { rebase: true }
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
      if (!known || known.w !== min.w || known.h !== min.h) {
        // Learned, not authored: no undo step (846).
        if (!hint.current.key) hint.current = { rebase: true }
        dispatch({ type: 'min', id: p.id, size: min })
      }
    }
    // Keyed on each panel's chart type: a new view or a loaded one re-learns its minimum, nothing else does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartOf])

  /** A view panel at the end of the board, or (837) dropped on a grid cell. */
  const addView = (item: AnalyticsItem, at?: Cell) => {
    const id = newPanelId()
    const panel: AnalyticsBoardPanel = { id, kind: 'view', viewId: item.id, layout: { ...VIEW_ASK, x: 0, y: 0 }, optOut: [] }
    const min = minSizeOf({ kind: 'view', chart: item.definition.chart.type })
    dispatch(at ? { type: 'drop', panel, min, at } : { type: 'add', panel, min })
    // A new panel binds every parameter that can take it, as v1's filters reached a new panel.
    edit((d) => bindPanel(d, { id, definition: item.definition }, model))
  }
  // 837: a palette view may be listed without its definition; it is read first (the same cache entry its panel uses).
  const addListed = (listed: AnalyticsItem, at?: Cell) => {
    const full = definitionKnown(listed)
      ? Promise.resolve(listed)
      : queryClient.fetchQuery({ queryKey: analyticsItemKey(listed.id), queryFn: () => analyticsApi.item(listed.id), staleTime: 60_000, retry: false })
    full.then(
      (item) => addView(item, at),
      (err) => toast.error(t('boardEditor.palette.addFailed'), { description: refusalWords(analyticsRefusal(err, t('boardEditor.palette.addFailed')), t) }),
    )
  }
  const dropView = (viewId: string, at: Cell) => {
    const listed = list.data?.find((i) => i.id === viewId) ?? (dragging?.id === viewId ? dragging : null)
    setDragging(null)
    if (listed) addListed(listed, at)
  }
  const dropping: { asked: Size; min: Size } | null = dragging
    ? { asked: VIEW_ASK, min: minSizeOf({ kind: 'view', chart: definitionKnown(dragging) ? dragging.definition.chart.type : null }) }
    : null
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

  // 836: the board in context for the copilot (a saved board), and its `boardEdit` applied as ONE undo step. The editor
  // keeps no history of its own, so the step is a snapshot of what the AI replaced; Undo puts it back. Any change of
  // the user's after it ends the step (its Undo would take that change back too).
  const [aiStep, setAiStep] = useState<{ request: string; before: { layout: LayoutState; decl: Declarations; refresh: number }; after: string | null } | null>(null)
  const sent = { params: decl.params, bindings, panels: layout.panels, ...(refresh > 0 ? { refresh } : {}) }
  const said = JSON.stringify(sent)
  useBoardInContext(board?.id ?? null, board?.revision ?? 0, sent, title, (next, request) => {
    setAiStep({ request, before: { layout, decl, refresh }, after: null })
    v1.current = false
    dispatch({ type: 'reset', state: { panels: next.panels, mins: layout.mins } })
    setDecl({ params: next.params ?? [], bindings: next.bindings ?? {} })
    setRefresh(next.refresh ?? 0)
    setSelected(null)
    setProblems(null)
  })
  useEffect(() => {
    if (!aiStep) return
    if (aiStep.after === null) setAiStep({ ...aiStep, after: said })
    else if (aiStep.after !== said) setAiStep(null)
    // Keyed on what the board says: the step's own render records it, the next change ends it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said])
  // 846: the AI's edit is one step of the editor's history, so its Undo is the history's (the step's notice goes
  // when the board changes again, as an undo does).
  const undoAi = () => {
    if (!aiStep) return
    stepBack()
    setAiStep(null)
  }

  /** 846 item 6: a copy of a panel in the first free slot below it, bound as the original is; it becomes the selection. */
  const duplicate = (id: string) => {
    const newId = newPanelId()
    dispatch({ type: 'duplicate', id, newId })
    edit((d) => ({ ...d, bindings: copyBindings(d.bindings, id, newId) }))
    setPicked([newId])
  }
  /** 846 item 2: Close gaps, on the whole board or one section; when there is no gap it says so. */
  const closeGapsIn = (section?: string) => {
    const action: LayoutAction = { type: 'closeGaps', section }
    const none = layoutReducer(layout, action) === layout
    const said = t(none ? (section ? 'boardEditor.gaps.noneSection' : 'boardEditor.gaps.none') : section ? 'boardEditor.gaps.closedSection' : 'boardEditor.gaps.closed')
    if (none) toast.info(said)
    else {
      dispatch(action)
      toast.success(said)
    }
    setStatus(said)
  }
  const removePicked = () => {
    if (chosen.length === 0) return
    dispatch({ type: 'removeMany', ids: chosen })
    setPicked([])
  }
  const jump = (id: string, add: boolean) => {
    pick(id, add)
    const sel = (attr: string) => `[${attr}="${CSS.escape(id)}"]`
    document.querySelector(sel('data-editor-panel'))?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    document.querySelector<HTMLElement>(sel('data-editor-move'))?.focus({ preventScroll: true })
  }
  // The grid's changes; a panel's words typed are one step while the typing runs.
  const gridDispatch = (a: LayoutAction) => {
    if (a.type === 'patch' && !a.patch.optOut) typed(`patch:${a.id}`)
    dispatch(a)
  }

  // 846 items 4 and 6: the editor's keys, wherever the focus is in it (or nowhere), but not in a text field (its own
  // undo stays the field's), not under a dialog, and not in Preview.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  keys.current = (e: KeyboardEvent) => {
    const at = document.activeElement
    if (previewing || building || sheet || !root.current || (at && at !== document.body && !root.current.contains(at))) return
    if (typingIn(e.target) || at?.closest('dialog')) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 'z' && !e.shiftKey) {
      e.preventDefault()
      stepBack()
    } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
      e.preventDefault()
      stepOn()
    } else if (e.key === '?' && !mod) {
      e.preventDefault()
      setSheet(true)
    } else if (e.key === 'Escape' && chosen.length > 0) {
      setPicked([])
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const nameOf = (p: AnalyticsBoardPanel): string => {
    if (p.kind === 'section') return saysIn(p.title, lang) || t('boardEditor.kind.section')
    if (p.kind === 'text') return saysIn(p.text, lang).slice(0, 60) || t('boardEditor.kind.text')
    return bindPanels.find((b) => b.id === p.id)?.title ?? t('boardEditor.kind.view')
  }
  const outline: OutlineEntry[] = outlineOf(layout.panels).map((e) => ({ ...e, name: nameOf(layout.panels.find((p) => p.id === e.id)!) }))
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
    <>
    {previewing && <BoardPreview title={title} tier={board?.tier ?? null} definition={definition} model={model} lang={lang} onBack={() => setPreviewing(false)} />}
    <div ref={root} hidden={previewing} className={'grid items-start gap-4 ' + (selected ? 'lg:grid-cols-[minmax(0,1fr)_26rem]' : '')} data-board-editor={board?.id ?? 'new'}>
    <div className="flex min-w-0 flex-col gap-4">
      <section className="grid gap-3 rounded-lg border border-border/60 bg-card p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_12rem]">
        <Field label={t('editor.titleEn')}>
          <Input value={title.en} dir="ltr" onChange={(e) => { typed('title.en'); setTitle((x) => ({ ...x, en: e.target.value })) }} data-board-title="en" />
        </Field>
        <Field label={t('editor.titleAr')}>
          <Input value={title.ar} dir="rtl" onChange={(e) => { typed('title.ar'); setTitle((x) => ({ ...x, ar: e.target.value })) }} data-board-title="ar" />
        </Field>
        <Field label={t('editor.subtitleEn')}>
          <Input value={subtitle.en} dir="ltr" onChange={(e) => { typed('subtitle.en'); setSubtitle((x) => ({ ...x, en: e.target.value })) }} data-board-subtitle="en" />
        </Field>
        <Field label={t('editor.subtitleAr')}>
          <Input value={subtitle.ar} dir="rtl" onChange={(e) => { typed('subtitle.ar'); setSubtitle((x) => ({ ...x, ar: e.target.value })) }} data-board-subtitle="ar" />
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
          onChange={(v) => { typed('defaults'); edit((d) => ({ ...d, params: d.params.map((p) => (v[p.name] ? { ...p, default: v[p.name] } : p)) })) }}
          model={model}
          lang={lang}
          wave={NO_WAVE}
          design={{ selected, onEdit: openParam, onAdd: addParamHere }}
        />
      </div>

      <section className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3" aria-label={t('boardEditor.add')} data-board-editor-add>
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
        <EditWithCopilot editing={editing} />
        <Button variant="secondary" className="ms-auto" onClick={() => setPreviewing(true)} data-board-preview-open>
          <Eye className="size-4" aria-hidden />
          {t('boardEditor.preview')}
        </Button>
      </section>

      <AiStepNotice step={aiStep ? { kind: 'ai', request: aiStep.request } : null} onUndo={undoAi} />

      {/* 846 item 3: the side list's width is the separator's (remembered); folded, it is a thin rail. */}
      <div
        className="grid items-start gap-3 md:grid-cols-[var(--board-side)_minmax(0,1fr)]"
        style={{ '--board-side': sideCollapsed ? '2.75rem' : `${sideWidth}px` } as CSSProperties}
        data-board-side-width={sideCollapsed ? 0 : sideWidth}
      >
        <div className="relative min-w-0 md:sticky md:top-2">
          <BoardEditorSide
            id={SIDE_ID}
            collapsed={sideCollapsed}
            onCollapse={setSideCollapsed}
            palette={{
              items: list.data,
              loading: list.isLoading,
              failed: !!list.error,
              model,
              lang,
              onAdd: (item) => addListed(item),
              onDragStart: setDragging,
              onDragEnd: () => setDragging(null),
            }}
            outline={outline}
            picked={chosen}
            onJump={jump}
          />
          {!sideCollapsed && <PaneSeparator controls={SIDE_ID} label={t('boardEditor.side.resize')} width={sideWidth} viewport={viewport} onWidth={setSideWidth} bounds={SIDE_BOUNDS} edge="end" />}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-card p-1.5" role="toolbar" aria-label={t('boardEditor.tools.label')} data-board-editor-tools>
            <IconButton label={t('boardEditor.tools.undo')} disabled={!canUndo(history)} onClick={stepBack} data-board-undo>
              <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
            </IconButton>
            <IconButton label={t('boardEditor.tools.redo')} disabled={!canRedo(history)} onClick={stepOn} data-board-redo>
              <Redo2 className="size-4 rtl:-scale-x-100" aria-hidden />
            </IconButton>
            <Button variant="ghost" onClick={() => closeGapsIn()} disabled={layout.panels.length === 0} data-board-close-gaps>
              <ArrowUpToLine className="size-4" aria-hidden />
              {t('boardEditor.gaps.close')}
            </Button>
            {chosen.length > 0 && (
              <span className="ms-2 flex flex-wrap items-center gap-1 border-s border-border ps-2" data-board-selection={chosen.length}>
                <span className="text-xs text-muted-foreground">{t('boardEditor.tools.selected', { n: fsi(chosen.length) })}</span>
                {chosen.length === 1 && (
                  <IconButton label={t('boardEditor.tools.duplicate')} onClick={() => duplicate(chosen[0])} data-board-duplicate>
                    <Copy className="size-4" aria-hidden />
                  </IconButton>
                )}
                <IconButton label={t('boardEditor.tools.remove')} onClick={removePicked} data-board-remove-picked>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
                {chosen.length > 1 && (
                  <>
                    {/* "Start" is the inline start: the left in en, the right in ar — the glyphs mirror with it. */}
                    <IconButton label={t('boardEditor.tools.alignStart')} onClick={() => dispatch({ type: 'align', ids: chosen, how: 'start' })} data-board-align="start">
                      <AlignHorizontalJustifyStart className="size-4 rtl:-scale-x-100" aria-hidden />
                    </IconButton>
                    <IconButton label={t('boardEditor.tools.alignTop')} onClick={() => dispatch({ type: 'align', ids: chosen, how: 'top' })} data-board-align="top">
                      <AlignVerticalJustifyStart className="size-4" aria-hidden />
                    </IconButton>
                    <IconButton label={t('boardEditor.tools.sameWidth')} onClick={() => dispatch({ type: 'align', ids: chosen, how: 'width' })} data-board-align="width">
                      <MoveHorizontal className="size-4" aria-hidden />
                    </IconButton>
                  </>
                )}
              </span>
            )}
            <IconButton label={t('boardEditor.keys.open')} className="ms-auto" onClick={() => setSheet(true)} data-board-shortcuts-open>
              <Keyboard className="size-4" aria-hidden />
            </IconButton>
          </div>
          <p className="sr-only" aria-live="polite" data-board-editor-status>
            {status}
          </p>
          {layout.panels.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-board-editor-empty>
              {t('boardEditor.empty')}
            </p>
          )}
          {/* Always drawn, so a view can be dropped on an empty board too. */}
          <BoardEditorGrid
            layout={layout}
            dispatch={gridDispatch}
            views={views}
            model={model}
            lang={lang}
            dropping={dropping}
            onDropView={dropView}
            picked={chosen}
            onPick={pick}
            onGesture={setGesturing}
            onDuplicate={duplicate}
            onCloseGaps={closeGapsIn}
          />
        </div>
      </div>
      <BoardShortcuts open={sheet} onClose={() => setSheet(false)} />

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
            typed(`param:${selected}`)
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
    </>
  )
}
