import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Heading, Plus, Sparkles, Type } from 'lucide-react'
import { apiErrorCode } from '@/core/api'
import i18n from '@/core/i18n'
import type { AnalyticsBoard, AnalyticsBoardDefinition, AnalyticsBoardPanel, AnalyticsItem, AnalyticsLabel, AnalyticsModel, BoardFilters } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { ANALYTICS_ITEMS_KEY, ANALYTICS_MODEL_KEY, analyticsApi, analyticsBoardKey, analyticsItemKey } from './api'
import { BOARD_REFRESH_SECONDS, boardDefaults, NO_WAVE } from './board'
import BoardEditorGrid, { type PanelView } from './BoardEditorGrid'
import FilterStrip from './FilterStrip'
import { HOME_TIER_ORDER } from './home'
import { editingItemOf } from './item-save'
import { layoutReducer, minSizeOf, type LayoutState } from './layout'
import Refused from './Refused'
import { SaveRefusalNote, SaveStanding } from './SaveNotes'
import { useItemSave, type SaveHow } from './use-item-save'
import { analyticsRefusal, refusalWords } from './wire'
import { viewTitleOf } from './ViewChart'

/**
 * The board editor (spec 766 §F, 755 items 7–11, ticket 777) at `/analytics/board/:id/edit` and
 * `/analytics/new?kind=board`: lay panels out on the 12-column grid (`./BoardEditorGrid`, `./layout`); add a
 * panel from a view I can read (mine, Shared or Certified) linked by reference, or build a new view with 775's
 * editor (saved as a view, then linked); text and section-header panels; the board's filters, each panel's
 * opt-outs and a default refresh interval. A view that was deleted shows "view removed" and blocks nothing.
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
  const [filters, setFilters] = useState<BoardFilters>(() => boardDefaults(def ?? { panels: [] }))
  const [refresh, setRefresh] = useState<number>(def?.refresh ?? 0)
  const [pick, setPick] = useState('')
  const [building, setBuilding] = useState(false)

  // The views I can link: every view the store lists for me, Certified first, then Shared, then mine.
  const list = useQuery({ queryKey: ANALYTICS_ITEMS_KEY, queryFn: () => analyticsApi.items(), retry: false })
  const pickable = useMemo(() => {
    const views = (list.data ?? []).filter((i) => i.kind === 'view')
    return HOME_TIER_ORDER.map((tier) => ({ tier, views: views.filter((v) => v.tier === tier) })).filter((g) => g.views.length > 0)
  }, [list.data])

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

  const addView = (item: AnalyticsItem) =>
    dispatch({
      type: 'add',
      panel: { id: newPanelId(), kind: 'view', viewId: item.id, layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] },
      min: minSizeOf({ kind: 'view', chart: item.definition.chart.type }),
    })
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
      navigate(`/analytics/board/${encodeURIComponent(item.id)}`)
    },
  })
  const { actions } = save
  const definition: AnalyticsBoardDefinition = { panels: layout.panels, filters, ...(refresh > 0 ? { refresh } : {}) }
  const onSave = (how: SaveHow) => save.save(how, { title, subtitle, definition })
  const primary: SaveHow | null = actions.save === 'read-only' ? null : actions.save
  const reload = () => {
    save
      .reload()
      .then(onReseed)
      .catch(() => toast.error(t('save.reloadFailed')))
  }

  return (
    <div className="flex flex-col gap-4" data-board-editor={board?.id ?? 'new'}>
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
        <FilterStrip filters={filters} onChange={setFilters} model={model} lang={lang} wave={NO_WAVE} />
      </div>

      <section className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3" aria-label={t('boardEditor.add')} data-board-editor-add>
        <Field label={t('boardEditor.addView')} className="min-w-64 flex-1">
          <Select value={pick} onChange={(e) => setPick(e.target.value)} data-board-add-pick>
            <option value="">{t(list.isLoading ? 'boardEditor.viewsLoading' : 'boardEditor.pickView')}</option>
            {pickable.map((g) => (
              <optgroup key={g.tier} label={t(`home.tier.${g.tier}`)}>
                {g.views.map((v) => (
                  <option key={v.id} value={v.id}>
                    {fsi(viewTitleOf(v, model, lang, t))}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
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
        {save.refusal ? (
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
