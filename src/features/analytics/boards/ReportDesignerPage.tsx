import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, Eye, GraduationCap, Plus, Redo2, Save, Undo2 } from 'lucide-react'
import { reportEditHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsItem, AnalyticsLabel, AnalyticsModel, AnalyticsReport, AnalyticsReportDefinition, AnalyticsReportWords } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import type { PaneBounds } from '@/core/ui/inspector-pane'
import PaneSeparator, { useRememberedPaneWidth, useViewportWidth } from '@/core/ui/PaneSeparator'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { analyticsAccessQuery, canAuthorAnalytics } from './access'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsItemKey, analyticsItemsKey, analyticsReportKey } from './api'
import { BASE_FILTERS, NO_WAVE } from './board'
import { addParam, bind, blankParam, removeParam, type Declarations } from './bindings'
import DeclarationProblems from './DeclarationProblems'
import { historyReducer, startHistory, unsaved, type History } from './designer-history'
import { declarationRefusal, type DeclarationProblem } from './editor-refusal'
import type { BoardContext } from './effective-query'
import FilterStrip from './FilterStrip'
import { editingItemOf, type EditingItem } from './item-save'
import ParamInspector, { type InspectorFocus, type InspectorPanel } from './ParamInspector'
import { defaultsOf, readyMadeParams, type ParamValues } from './params'
import ItemHistory from './ItemHistory'
import Refused from './Refused'
import { blankPanelDefinition, copiedPanel, panelBlock } from './panel-edit'
import { reportPanels, validateReport } from './report'
import ReportDocument, { ReportBlock, type ReportWordsView } from './ReportDocument'
import ReportTutorial from './ReportTutorial'
import { sampleReport } from './sample-report'
import { AiStepNotice, EditWithCopilot, useReportInContext } from './ReportDesignerCopilot'
import { AddBlock, BlockInspector, DropLine, Grip, MoveTools, Outline, SectionInspector, useNames, useReportDnd, type DesignerOps, type ReportDnd } from './ReportDesignerParts'
import ViewsPalette from './ViewsPalette'
import * as ops from './report-ops'
import { DesignerText } from './ReportTextEditor'
import { SaveRefusalNote, SaveStanding } from './SaveNotes'
import { useItemSave, type SaveHow } from './use-item-save'
import { useReportRun } from './use-report-run'
import { analyticsErrorWords, analyticsRefusal, refusalWords } from './wire'

/**
 * The report designer (spec 819 §E, ticket 828; 798's variant D) at `/analytics/new?kind=report` and
 * `/analytics/report/:id/edit`, behind the author grant (822):
 * - **the outline** on the start side (sticky): the parameters, then the section tree — every row selectable,
 *   sections and blocks draggable by their grip;
 * - **the page** in the middle: the editable title and the strip (in design mode), each section heading and
 *   block with its tools (grip, edit, up, down, remove) and "Add to this section";
 * - **the inspector** on the end side: sticky, never a modal — the section editor, a block, or 824's parameter
 *   inspector.
 *
 * Every edit is one step of `./designer-history` (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z outside a text field, and the
 * buttons); typing in one field is one step; every removal says "Removed … · Undo" and asks nothing. Moves are
 * `./report-ops`, the same by drag and drop or by up and down.
 *
 * Save creates the report as Personal, or saves it by its tier (403 → copy, 405 → who and when) through 776's
 * shared path; `validate` and the server's `ANALYTICS-411` list every declaration problem. A save clears the
 * unsaved marker, not the history: a new report's history rides to its designer's route. Preview is the runner's
 * page: the saved report itself when nothing is unsaved, else the draft. The draft's panels run inline (`BoardContext.inline`): it is not the saved revision.
 */
export default function ReportDesignerPage() {
  const { t } = useTranslation('boards')
  const { id } = useParams()
  return (
    <ScreenGate
      query={analyticsAccessQuery()}
      can={canAuthorAnalytics}
      ns="boards"
      keyPrefix="authorAccess"
      title={t(id ? 'designer.editTitle' : 'designer.newTitle')}
      subtitle={t('designer.subtitle')}
    >
      <DesignerBody reportId={id ?? null} />
    </ScreenGate>
  )
}

/** What the designer edits: the report's words and its definition. One history step is one of these. */
export interface ReportDraft {
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  definition: AnalyticsReportDefinition
}

/**
 * What an undo would take back, when it is worth saying: a removal ("Removed … · Undo"), or (832) the copilot's
 * edit, applied as one step labelled with the request.
 */
export type DraftStep =
  | { kind: 'removed'; what: 'section' | 'param' | 'panel' | 'text' | 'summary'; name: AnalyticsLabel | null }
  | { kind: 'ai'; request: string }

export type DraftHistory = History<ReportDraft, DraftStep>

/** A new report's history and item ride in route state to its designer's route, so the save keeps the history. */
interface DesignerHandOff {
  designer: { id: string; history: DraftHistory; editing: EditingItem }
}
const handOffOf = (state: unknown, id: string | null): DesignerHandOff['designer'] | null => {
  const d = (state as Partial<DesignerHandOff> | null)?.designer
  return d && id && d.id === id && d.history?.present ? d : null
}

const EMPTY: AnalyticsLabel = { en: '', ar: '' }
// Story 19: a new report starts with the six ready-made parameters (period, city, region, store, channel, country), as a
// new board does; each panel added binds the ones that can take it (`report-ops` `addBlock`).
const BLANK: ReportDraft = { title: EMPTY, subtitle: EMPTY, definition: { params: readyMadeParams(BASE_FILTERS), bindings: {}, sections: [] } }
const draftOf = (r: AnalyticsReport): ReportDraft => ({ title: r.title, subtitle: r.subtitle, definition: r.definition })

function DesignerBody({ reportId }: { reportId: string | null }) {
  const { t } = useTranslation('boards')
  const location = useLocation()
  const [handOff] = useState(() => handOffOf(location.state, reportId))
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })
  const report = useQuery({ queryKey: analyticsReportKey(reportId ?? ''), queryFn: () => analyticsApi.report(reportId ?? ''), enabled: !!reportId && !handOff, retry: false })
  const failure = model.error ?? report.error
  if (failure) return <Refused err={failure} fallbackKey="designer.loadFailed" what="report" />
  if (!model.data || (reportId && !handOff && !report.data)) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('designer.loading')}
      </div>
    )
  }
  const start = handOff?.history ?? startHistory<ReportDraft, DraftStep>(report.data ? draftOf(report.data) : BLANK)
  const editing = handOff?.editing ?? (report.data ? editingItemOf({ ...report.data, kind: 'report' }) : null)
  return <Designer key={reportId ?? 'new'} model={model.data} start={start} startEditing={editing} />
}

/** The designer never asks the Words door (a draft has no revision to ask it with): figures and the summary say so. */
const designWords = (reason: string): ReportWordsView => ({ data: { figures: {}, summary: { unavailable: reason } } satisfies AnalyticsReportWords, failed: false })

// 846 item 3: the side panes are resizable, their widths remembered in this browser.
const OUTLINE_PANE: PaneBounds = { default: 256, min: 208, max: 480, step: 16, viewportShare: 0.3 }
const INSPECTOR_PANE: PaneBounds = { default: 416, min: 320, max: 640, step: 16, viewportShare: 0.4 }
const OUTLINE_WIDTH_KEY = 'oms.analytics.reportDesigner.outlineWidth'
const INSPECTOR_WIDTH_KEY = 'oms.analytics.reportDesigner.inspectorWidth'

const isTextField = (el: EventTarget | null) => {
  const e = el as HTMLElement | null
  return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable)
}

function Designer({ model, start, startEditing }: { model: AnalyticsModel; start: DraftHistory; startEditing: EditingItem | null }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const navigate = useNavigate()
  const names = useNames(model, lang)
  const [h, dispatch] = useReducer(historyReducer<ReportDraft, DraftStep>, start)
  const latest = useRef(h)
  latest.current = h
  const draft = h.present
  const def = draft.definition

  const [selected, setSelected] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [focus, setFocus] = useState<InspectorFocus | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [closedNotice, setClosedNotice] = useState<ReportDraft | null>(null)
  const [problems, setProblems] = useState<DeclarationProblem[] | null>(null)
  const [dismissed, setDismissed] = useState<unknown>(null)
  const [editing, setEditing] = useState(startEditing)
  const [tutorial, setTutorial] = useState(false)
  // 846 item 4: the outline column shows the outline or the views list; the list is read once it is first opened.
  const [side, setSide] = useState<'outline' | 'views'>('outline')
  const [viewsOpened, setViewsOpened] = useState(false)
  const viewport = useViewportWidth()
  const [outlineWidth, setOutlineWidth] = useRememberedPaneWidth(OUTLINE_WIDTH_KEY, OUTLINE_PANE)
  const [inspectorWidth, setInspectorWidth] = useRememberedPaneWidth(INSPECTOR_WIDTH_KEY, INSPECTOR_PANE)
  const pageRef = useRef<HTMLElement | null>(null)
  const outlineRef = useRef<HTMLDivElement | null>(null)
  const queryClient = useQueryClient()
  const views = useQuery({ queryKey: analyticsItemsKey({ kind: 'view' }), queryFn: () => analyticsApi.items({ kind: 'view' }), retry: false, enabled: viewsOpened })

  const edit = useCallback(
    (f: (d: ReportDraft) => ReportDraft, key: string | null = null, label: DraftStep | null = null) => dispatch({ type: 'apply', next: f, key, label, at: Date.now() }),
    [],
  )
  const editDef = useCallback(
    (f: (d: AnalyticsReportDefinition) => AnalyticsReportDefinition, key: string | null = null, label: DraftStep | null = null) =>
      edit(
        (d) => {
          const next = f(d.definition)
          return next === d.definition ? d : { ...d, definition: next }
        },
        key,
        label,
      ),
    [edit],
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  // 832: the copilot sees this report as the report in context; its edit lands as ONE step, "AI: <the request>".
  useReportInContext(editing?.id ?? null, editing?.revision ?? 0, draft, (definition, request) => editDef(() => definition, null, { kind: 'ai', request }))

  // Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z). Inside a text field the browser's own text undo wins. 846 item 5: on a
  // selected block, Delete removes it and Ctrl+D duplicates it (each one step); Esc clears the selection.
  const keys = useRef<{ block: string | null; remove: (id: string) => void; duplicate: (id: string) => void; clear: () => void } | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextField(e.target) || e.defaultPrevented) return
      const on = keys.current
      // A dialog open over the designer owns its own keys.
      const dialog = !!document.querySelector('[role="dialog"], [role="alertdialog"]')
      if (on && !dialog && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'Escape') {
          on.clear()
          return
        }
        if (e.key === 'Delete' && on.block) {
          e.preventDefault()
          on.remove(on.block)
          return
        }
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'd' && !e.shiftKey && !e.altKey && on?.block && !dialog) {
        e.preventDefault()
        on.duplicate(on.block)
        return
      }
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const panels: InspectorPanel[] = useMemo(() => reportPanels(def).map((b) => ({ id: b.id, title: names.block(b), definition: b.definition })), [def, names])
  const decl: Declarations = { params: def.params, bindings: def.bindings }
  const openParam = (name: string) => {
    setSelected(`param:${name}`)
    setFresh((f) => (f === name ? f : null))
    setFocus(null)
  }

  const designerOps: DesignerOps = {
    select: (key) => {
      setSelected(key)
      setFresh(null)
      setFocus(null)
    },
    moveSection: (id, by) => editDef((d) => ops.moveSection(d, id, by)),
    moveBlock: (id, by) => editDef((d) => ops.moveBlock(d, id, by)),
    removeSection: (id) => {
      const s = def.sections.find((x) => x.id === id)
      editDef((d) => ops.removeSection(d, id), null, { kind: 'removed', what: 'section', name: s?.heading ?? null })
      if (selected === `section:${id}` || s?.blocks.some((b) => selected === `block:${b.id}`)) setSelected(null)
    },
    removeBlock: (id) => {
      const b = def.sections.flatMap((s) => s.blocks).find((x) => x.id === id)
      if (!b) return
      editDef((d) => ops.removeBlock(d, id), null, { kind: 'removed', what: b.kind, name: b.kind === 'panel' ? b.title : null })
      if (selected === `block:${id}`) setSelected(null)
    },
    duplicateBlock: (id) => {
      const b = def.sections.flatMap((s) => s.blocks).find((x) => x.id === id)
      if (!b || b.kind === 'summary') return
      const copy = ops.freshId(def, b.kind === 'panel' ? 'p' : 't')
      editDef((d) => ops.duplicateBlock(d, id, copy))
      setSelected(`block:${copy}`)
      setFresh(null)
      setFocus(null)
    },
    addSection: () => {
      const id = ops.freshId(def, 's')
      editDef((d) => ops.addSection(d, id))
      setSelected(`section:${id}`)
    },
    addBlock: (section, kind) => {
      const id = kind === 'summary' ? 'sum' : ops.freshId(def, kind === 'panel' ? 'p' : 't')
      const block = kind === 'summary' ? { id, kind } : kind === 'panel' ? panelBlock(id, blankPanelDefinition(model)) : { id, kind, text: EMPTY }
      editDef((d) => ops.addBlock(d, section, block, model))
      setAdding(null)
      setSelected(`block:${id}`)
    },
    copyView: (section, view) => {
      const id = ops.freshId(def, 'p')
      editDef((d) => ops.addBlock(d, section, copiedPanel(id, view), model))
      setAdding(null)
      setSelected(`block:${id}`)
    },
    updateBlock: (id, f, key = null) => editDef((d) => ops.updateBlock(d, id, f, model), key),
    bind: (param, panel, target) => editDef((d) => ({ ...d, ...bind({ params: d.params, bindings: d.bindings }, param, panel, target) })),
    addParam: () => {
      const param = blankParam('members', def.params.map((p) => p.name), model)
      editDef((d) => {
        const next = addParam({ params: d.params, bindings: d.bindings }, param, panels, model)
        return { ...d, ...next }
      })
      setSelected(`param:${param.name}`)
      setFresh(param.name)
      setFocus(null)
    },
  }
  /**
   * 846 item 4: a view from the views list copied in as a panel (as "Copy a saved view" does: read whole, so its
   * definition and revision are copied) — at a dropped gap, or by "+" at the end of the selected section (the
   * selected block's, else the last; a report with no section gets one). One step.
   */
  const addView = (listed: AnalyticsItem, at?: { section: string; index: number }) => {
    queryClient
      .fetchQuery({ queryKey: analyticsItemKey(listed.id), queryFn: () => analyticsApi.item(listed.id), staleTime: 0 })
      .then((item) => {
        const now = latest.current.present.definition
        const id = ops.freshId(now, 'p')
        const pickedSection = selected?.startsWith('section:') ? selected.slice('section:'.length) : selected?.startsWith('block:') ? ops.locateBlock(now, selected.slice('block:'.length))?.section : undefined
        editDef((d) => {
          let into = at?.section ?? (pickedSection && d.sections.some((s) => s.id === pickedSection) ? pickedSection : d.sections.at(-1)?.id)
          let base = d
          if (!into) {
            into = ops.freshId(d, 's')
            base = ops.addSection(d, into)
          }
          return ops.addBlock(base, into, copiedPanel(id, item), model, at?.index)
        })
        setSelected(`block:${id}`)
        setFresh(null)
        setFocus(null)
      })
      .catch((err: unknown) => toast.error(analyticsErrorWords(err, t('designer.copyView.failed'), t)))
  }
  const dnd = useReportDnd({
    def,
    onBlock: (id, section, index) => editDef((d) => ops.moveBlockTo(d, id, section, index)),
    onSection: (id, index) => editDef((d) => ops.moveSectionTo(d, id, index)),
    onView: (view, section, index) => addView(view, { section, index }),
    page: pageRef,
    outline: outlineRef,
  })
  keys.current = {
    block: selected?.startsWith('block:') ? selected.slice('block:'.length) : null,
    remove: designerOps.removeBlock,
    duplicate: designerOps.duplicateBlock,
    clear: () => {
      setSelected(null)
      setFocus(null)
    },
  }

  // ── Save ──
  const save = useItemSave({
    kind: 'report',
    editing,
    onSaved: (item, how) => {
      toast.success(t(how === 'copy' ? 'save.copied' : how === 'in-place' ? 'save.savedInPlace' : 'designer.created'))
      dispatch({ type: 'saved' })
      const saved = editingItemOf({ ...item, kind: 'report' })
      if (how === 'in-place') {
        setEditing(saved)
        return
      }
      // A new report (or my copy) opens in its own designer, the history kept.
      const history: DraftHistory = { ...latest.current, saved: latest.current.present }
      navigate(reportEditHref(item.id), { replace: how === 'create', state: { designer: { id: item.id, history, editing: saved } } satisfies DesignerHandOff })
    },
  })
  const { actions } = save
  const primary: SaveHow | null = actions.save === 'read-only' ? null : actions.save
  const onSave = (how: SaveHow) => {
    const found = validateReport(def, model)
    setProblems(found.length > 0 ? found : null)
    if (found.length === 0) save.save(how, { title: draft.title, subtitle: draft.subtitle, definition: def })
  }
  const server = save.error && save.error !== dismissed ? declarationRefusal(save.error) : null
  const listed = problems ?? (server && server.problems.length > 0 ? server.problems : null)
  const reload = () =>
    save.reloadInto((item) => {
      const r = item as AnalyticsReport
      dispatch({ type: 'load', present: draftOf(r) })
      setEditing(editingItemOf({ ...r, kind: 'report' }))
      save.reset()
    })
  // A revert writes a new revision on the server: the designer re-reads it and lands it as ONE step (undo goes back to
  // the draft as it was), saved at the new revision.
  const afterRevert = () =>
    save.reloadInto((item) => {
      const r = item as AnalyticsReport
      edit(() => draftOf(r))
      dispatch({ type: 'saved' })
      setEditing(editingItemOf({ ...r, kind: 'report' }))
    })
  const goTo = (p: DeclarationProblem) => {
    if (p.what === 'summary') return
    if (p.what === 'figure' || p.what === 'series') {
      if (p.what === 'figure' || p.panel) designerOps.select(`block:${p.what === 'figure' ? p.block : p.panel}`)
      return
    }
    openParam(p.param)
    setFocus({ field: p.what === 'name' ? 'name' : p.what === 'binding' ? 'binding' : 'default', panel: p.what === 'binding' ? p.panel : undefined, at: Date.now() })
  }

  // ── The run the page draws: the draft, inline, at its defaults ──
  const defaults = useMemo(() => defaultsOf(def.params), [def.params])
  const context: BoardContext = useMemo(() => ({ params: def.params, bindings: def.bindings, values: defaults, crossFilter: null, item: null, inline: true }), [def.params, def.bindings, defaults])
  const words = useMemo(() => designWords(t('designer.summaryOnRun')), [t])
  const runItem = useMemo(() => ({ id: editing?.id ?? 'new', revision: editing?.revision ?? 0 }), [editing?.id, editing?.revision])
  const run = { model, lang, context, onFetching: noop, onParamNotice: noop, words, item: runItem }

  // 831: the tutorial at the top of the inspector; "Load the finished report" is one undoable step.
  const lead = tutorial ? (
    <ReportTutorial draft={draft} model={model} onLoad={() => {
        edit((d) => ({ ...d, ...sampleReport() }))
        setSelected(null)
      }} onClose={() => setTutorial(false)} />
  ) : null
  const notice = h.fresh?.kind === 'removed' && closedNotice !== h.present ? h.fresh : null
  const selectedParam = selected?.startsWith('param:') ? selected.slice('param:'.length) : null
  const selectedBlock = selected?.startsWith('block:') ? def.sections.flatMap((s) => s.blocks).find((b) => `block:${b.id}` === selected) : undefined

  if (preview) return <Preview draft={draft} editing={editing} saved={!!editing && !unsaved(h)} model={model} onBack={() => setPreview(false)} />

  return (
    <div className="flex flex-col gap-3" data-report-designer={editing?.id ?? 'new'} data-designer-unsaved={unsaved(h) ? 'yes' : 'no'}>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-050 px-2 py-0.5 text-[11px] font-medium text-primary-800">{t('designer.badge')}</span>
          <h2 className="text-base font-semibold tracking-tight" data-designer-title>
            <bdi>{saysIn(draft.title, lang) || t('designer.untitled')}</bdi>
          </h2>
          {unsaved(h) && (
            <span className="text-xs text-muted-foreground" data-designer-unsaved-marker>
              {t('designer.unsaved')}
            </span>
          )}
          <div className="ms-auto flex items-center gap-2">
            <IconButton label={t('designer.history.undo')} title={t('designer.history.undoHint')} variant="outlined" disabled={h.past.length === 0} onClick={undo} data-designer-undo>
              <Undo2 className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton label={t('designer.history.redo')} title={t('designer.history.redoHint')} variant="outlined" disabled={h.future.length === 0} onClick={redo} data-designer-redo>
              <Redo2 className="size-3.5" aria-hidden />
            </IconButton>
            <EditWithCopilot editing={editing} />
            <Button variant={tutorial ? 'secondary' : 'outlined'} title={t('designer.tutorial.actionHint')} aria-pressed={tutorial} onClick={() => setTutorial(!tutorial)} data-designer-tutorial-action>
              <GraduationCap className="size-3.5" aria-hidden />
              {t('designer.tutorial.action')}
            </Button>
            {/* Stories 15 and 91: past a save, the revisions and revert (and the audience events) take over from undo. */}
            {editing && <ItemHistory item={{ ...editing, title: draft.title }} kind="report" onReverted={afterRevert} />}
            <Button variant="outlined" onClick={() => setPreview(true)} data-designer-preview>
              <Eye className="size-3.5" aria-hidden />
              {t('designer.preview')}
            </Button>
            {primary === 'in-place' && actions.actions.includes('saveAsCopy') && (
              <Button variant="secondary" onClick={() => onSave('copy')} disabled={save.pending} data-editor-save-copy>
                {save.pending && save.how === 'copy' ? t('designer.saving') : t('save.asCopy')}
              </Button>
            )}
            <Button onClick={() => primary && onSave(primary)} disabled={!primary || save.pending} data-editor-save data-editor-save-how={primary ?? 'none'}>
              <Save className="size-3.5" aria-hidden />
              {save.pending && save.how === primary ? t('designer.saving') : t(primary === 'copy' ? 'save.asMyCopy' : 'designer.save')}
            </Button>
          </div>
        </div>
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs" data-designer-notice={notice.what}>
            <span>{t(`designer.history.removed.${notice.what}`, { name: fsi(saysIn(notice.name ?? undefined, lang) || t(notice.what === 'panel' ? 'designer.block.untitledPanel' : 'designer.section.untitled')) })}</span>
            <Button variant="link" onClick={undo} data-designer-notice-undo>
              {t('designer.history.undo')}
            </Button>
            <Button variant="text" className="ms-auto" onClick={() => setClosedNotice(h.present)}>
              {t('designer.history.dismiss')}
            </Button>
          </div>
        )}
        <AiStepNotice step={h.fresh} onUndo={undo} />
        <SaveStanding editing={editing} actions={actions} />
        {listed ? (
          <DeclarationProblems
            problems={listed}
            params={def.params}
            panelTitle={(id) => panels.find((p) => p.id === id)?.title ?? id}
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
          <ErrorBanner title={t('designer.saveFailed')} message={refusalWords(analyticsRefusal(save.error, t('designer.saveFailed')), t)} />
        ) : null}
      </header>

      <div className="grid items-start gap-3" style={{ gridTemplateColumns: `${outlineWidth}px minmax(0,1fr) ${inspectorWidth}px` }}>
        <div id="designer-outline-pane" className="sticky top-2 flex max-h-[calc(100vh-1rem)] min-w-0 flex-col gap-2" data-designer-outline-pane={outlineWidth}>
          <PaneSeparator controls="designer-outline-pane" label={t('designer.panes.outline')} width={outlineWidth} viewport={viewport} onWidth={setOutlineWidth} bounds={OUTLINE_PANE} edge="end" />
          <div className="flex gap-1 rounded-lg border border-border/60 bg-card p-1" role="tablist" aria-label={t('designer.side.label')}>
            {(['outline', 'views'] as const).map((s) => (
              <Button
                key={s}
                variant={side === s ? 'secondary' : 'ghost'}
                className="flex-1"
                role="tab"
                aria-selected={side === s}
                aria-controls="designer-side-panel"
                onClick={() => {
                  setSide(s)
                  if (s === 'views') setViewsOpened(true)
                }}
                data-designer-side={s}
              >
                {t(`designer.side.${s}`)}
              </Button>
            ))}
          </div>
          <div id="designer-side-panel" role="tabpanel" className="min-h-0 overflow-y-auto">
            <div ref={outlineRef} className="flex flex-col gap-2">
              {side === 'outline' ? (
                <Outline def={def} selected={selected} ops={designerOps} dnd={dnd} model={model} lang={lang} />
              ) : (
                <div className="flex flex-col gap-2" data-designer-views>
                  <ViewsPalette
                    items={views.data}
                    loading={views.isLoading}
                    failed={!!views.error}
                    model={model}
                    lang={lang}
                    onAdd={(item) => addView(item)}
                    onDragStart={dnd.startView}
                    onDragEnd={dnd.end}
                    hint={t('designer.side.viewsHint')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <main ref={pageRef} className="flex min-w-0 flex-col gap-3" data-designer-page>
          <section className="grid gap-3 rounded-lg border border-border/60 bg-card p-3 md:grid-cols-2">
            <Field label={t('designer.titleEn')}>
              <Input value={draft.title.en} dir="ltr" onChange={(e) => edit((d) => ({ ...d, title: { ...d.title, en: e.target.value } }), 'title:en')} data-designer-title-input="en" />
            </Field>
            <Field label={t('designer.titleAr')}>
              <Input value={draft.title.ar} dir="rtl" onChange={(e) => edit((d) => ({ ...d, title: { ...d.title, ar: e.target.value } }), 'title:ar')} data-designer-title-input="ar" />
            </Field>
          </section>
          <FilterStrip
            params={def.params}
            values={defaults}
            onChange={(v) => editDef((d) => ({ ...d, params: d.params.map((p) => (v[p.name] && v[p.name] !== defaults[p.name] ? { ...p, default: v[p.name] } : p)) }))}
            model={model}
            lang={lang}
            wave={NO_WAVE}
            design={{ selected: selectedParam, onEdit: openParam, onAdd: designerOps.addParam }}
          />
          <article {...dnd.sectionList()} className="flex flex-col gap-4 rounded-lg bg-card p-5 shadow-sm" data-designer-sections>
            {def.sections.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-designer-empty>
                {t('designer.empty')}
              </p>
            )}
            {def.sections.map((s, si) => (
              <section
                key={s.id}
                {...dnd.slot('section')}
                {...dnd.blockList(s.id)}
                className={`relative flex flex-col gap-3 ${dnd.dragging('section', s.id) ? 'opacity-40' : ''}`}
                data-designer-section={s.id}
              >
                <DropLine edge={dnd.sectionLine(si, def.sections.length)} gap="gap4" />
                <div className={`relative flex items-center gap-2 border-b border-border/60 pb-1 ${selected === `section:${s.id}` ? 'text-primary-800' : ''}`}>
                  <DropLine edge={dnd.emptyLine(s.id) && 'after'} gap="gap3" />
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
                    <bdi>{names.section(s.heading)}</bdi>
                  </h2>
                  <Grip dnd={dnd} kind="section" id={s.id} what={names.section(s.heading)} />
                  <MoveTools
                    what={names.section(s.heading)}
                    id={`section:${s.id}`}
                    onEdit={() => designerOps.select(`section:${s.id}`)}
                    onUp={() => designerOps.moveSection(s.id, -1)}
                    onDown={() => designerOps.moveSection(s.id, 1)}
                    onRemove={() => designerOps.removeSection(s.id)}
                  />
                </div>
                {s.blocks.map((b, bi) => (
                  <BlockFrame key={b.id} dnd={dnd} line={dnd.blockLine(s.id, bi, s.blocks.length)} selected={selected === `block:${b.id}`} name={names.block(b)} id={b.id} ops={designerOps}>
                    {b.kind === 'text' ? <DesignerText block={b} def={def} model={model} lang={lang} /> : <ReportBlock block={b} role="author" {...run} />}
                  </BlockFrame>
                ))}
                {adding === s.id ? (
                  <AddBlock def={def} section={s.id} ops={designerOps} model={model} lang={lang} onClose={() => setAdding(null)} />
                ) : (
                  <div>
                    <Button variant="text" onClick={() => setAdding(s.id)} data-designer-open-add={s.id}>
                      <Plus className="size-3.5" aria-hidden />
                      {t('designer.add.toSection')}
                    </Button>
                  </div>
                )}
              </section>
            ))}
            <div>
              <Button variant="outlined" onClick={designerOps.addSection} data-designer-add-section>
                <Plus className="size-3.5" aria-hidden />
                {t('designer.add.section')}
              </Button>
            </div>
          </article>
        </main>

        <div id="designer-inspector-pane" className="sticky top-2 min-w-0" data-designer-inspector-pane={inspectorWidth}>
        <PaneSeparator controls="designer-inspector-pane" label={t('designer.panes.inspector')} width={inspectorWidth} viewport={viewport} onWidth={setInspectorWidth} bounds={INSPECTOR_PANE} />
        {selectedParam && def.params.some((p) => p.name === selectedParam) ? (
          <ParamInspector
            decl={decl}
            name={selectedParam}
            fresh={fresh === selectedParam}
            panels={panels}
            model={model}
            lang={lang}
            focus={focus}
            onChange={(next, name) => {
              editDef((d) => ({ ...d, params: next.params, bindings: next.bindings }), `param:${selectedParam}`)
              if (name !== selectedParam) {
                setSelected(`param:${name}`)
                setFresh((f) => (f === selectedParam ? name : f))
              }
            }}
            onSelect={openParam}
            onRemove={() => {
              const p = def.params.find((x) => x.name === selectedParam)
              editDef((d) => ({ ...d, ...removeParam({ params: d.params, bindings: d.bindings }, selectedParam) }), null, {
                kind: 'removed',
                what: 'param',
                name: p && (p.label.en || p.label.ar) ? p.label : { en: selectedParam, ar: selectedParam },
              })
              setSelected(null)
            }}
            onClose={() => {
              setSelected(null)
              setFocus(null)
            }}
            lead={lead}
          />
        ) : (
          <aside className="max-h-[calc(100vh-1rem)] overflow-y-auto rounded-lg border border-border/60 bg-card p-4" aria-label={t('designer.inspector.label')} data-designer-inspector>
            {lead && <div className="mb-4">{lead}</div>}
            {selected?.startsWith('section:') ? (
              <SectionInspector
                def={def}
                id={selected.slice('section:'.length)}
                ops={designerOps}
                model={model}
                lang={lang}
                onHeading={(heading, which) => editDef((d) => ops.renameSection(d, selected.slice('section:'.length), heading), `${selected}:${which}`)}
              />
            ) : selectedBlock ? (
              <BlockInspector block={selectedBlock} name={names.block(selectedBlock)} ops={designerOps} def={def} model={model} lang={lang} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('designer.inspector.empty')}</p>
            )}
          </aside>
        )}
        </div>
      </div>
    </div>
  )
}

const noop = () => {}

/** A block on the page: one of its section's drop slots (846: the line on its nearest edge), its tools on hover or focus, ringed when selected. */
function BlockFrame({
  dnd,
  line,
  id,
  name,
  selected,
  ops: o,
  children,
}: {
  dnd: ReportDnd
  line: 'before' | 'after' | null
  id: string
  name: string
  selected: boolean
  ops: DesignerOps
  children: ReactNode
}) {
  const dragging = dnd.dragging('block', id)
  return (
    <div {...dnd.slot('block')} className="relative flex flex-col" data-designer-block={id}>
      <DropLine edge={line} gap="gap3" />
      <div
        className={`group relative rounded-lg ${dragging ? 'opacity-40 ' : ''}${selected ? 'ring-2 ring-primary ring-offset-4 ring-offset-card' : 'hover:ring-1 hover:ring-border hover:ring-offset-4 hover:ring-offset-card'}`}
      >
        <div className={`absolute -top-3 end-2 z-10 items-center rounded-md border border-border bg-card px-1 shadow-sm ${dragging ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'}`}>
          <Grip dnd={dnd} kind="block" id={id} what={name} />
          <MoveTools what={name} id={`block:${id}`} onEdit={() => o.select(`block:${id}`)} onUp={() => o.moveBlock(id, -1)} onDown={() => o.moveBlock(id, 1)} onRemove={() => o.removeBlock(id)} />
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Preview (story 95): exactly the runner's page. A saved report with no unsaved change is the runner's page itself — its
 * panels run by item and revision and its Words (live figures and the summary) are asked as the runner's are
 * (`useReportRun`). A draft not saved, or changed since, has no revision to ask the Words door with: its panels run
 * inline and its figures and summary say they are written when the report runs.
 */
function Preview({ draft, editing, saved, model, onBack }: { draft: ReportDraft; editing: EditingItem | null; saved: boolean; model: AnalyticsModel; onBack: () => void }) {
  const report: AnalyticsReport = {
    id: editing?.id ?? 'new',
    kind: 'report',
    title: draft.title,
    subtitle: draft.subtitle,
    owner: editing?.owner ?? '',
    tier: editing?.tier ?? 'personal',
    sourceChangedSinceCopy: false,
    revision: editing?.revision ?? 0,
    updatedAt: '',
    updatedBy: '',
    definition: draft.definition,
  }
  return saved ? <SavedPreview report={report} model={model} onBack={onBack} /> : <DraftPreview report={report} model={model} onBack={onBack} />
}

function PreviewFrame({ report, model, values, onValues, note, onBack, children, strip }: { report: AnalyticsReport; model: AnalyticsModel; values: ParamValues; onValues: (v: ParamValues) => void; note: string; onBack: () => void; children: ReactNode; strip?: Partial<Parameters<typeof FilterStrip>[0]> }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const def = report.definition
  const title = saysIn(report.title, lang)
  return (
    <div className="flex flex-col gap-3" data-designer-preview-page={report.revision > 0 ? 'saved' : 'draft'}>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outlined" onClick={onBack} data-designer-back>
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
          {t('designer.backToDesigner')}
        </Button>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      {title && (
        <h2 className="text-base font-semibold tracking-tight">
          <bdi>{title}</bdi>
        </h2>
      )}
      <FilterStrip params={def.params} values={values} onChange={onValues} onReset={() => onValues(defaultsOf(def.params))} model={model} lang={lang} wave={NO_WAVE} {...strip} />
      {children}
    </div>
  )
}

/** The saved report, as its runner opens it: by item and revision, with its Words. */
function SavedPreview({ report, model, onBack }: { report: AnalyticsReport; model: AnalyticsModel; onBack: () => void }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const [values, setValues] = useState<ParamValues>(() => defaultsOf(report.definition.params))
  const run = useReportRun(report, values)
  return (
    <PreviewFrame report={report} model={model} values={values} onValues={setValues} note={t('designer.previewNoteSaved')} onBack={onBack} strip={{ fellBack: run.fellBack, invalid: run.invalid, wave: run.wave }}>
      <ReportDocument
        report={report}
        model={model}
        lang={lang}
        context={run.context}
        role="runner"
        words={{ data: run.words.data, failed: !!run.words.error }}
        onFetching={run.onFetching}
        onParamNotice={run.onParamNotice}
      />
    </PreviewFrame>
  )
}

/** A draft not saved (or changed since): its panels inline; its figures and summary are written when it runs. */
function DraftPreview({ report, model, onBack }: { report: AnalyticsReport; model: AnalyticsModel; onBack: () => void }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const def = report.definition
  const [values, setValues] = useState<ParamValues>(() => defaultsOf(def.params))
  const context: BoardContext = useMemo(() => ({ params: def.params, bindings: def.bindings, values, crossFilter: null, item: null, inline: true }), [def.params, def.bindings, values])
  const words = useMemo(() => designWords(t('designer.summaryOnRun')), [t])
  return (
    <PreviewFrame report={{ ...report, revision: 0 }} model={model} values={values} onValues={setValues} note={t('designer.previewNote')} onBack={onBack}>
      <ReportDocument report={report} model={model} lang={lang} context={context} role="runner" words={words} onFetching={noop} onParamNotice={noop} />
    </PreviewFrame>
  )
}
