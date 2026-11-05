import { useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, MoveDiagonal2, Trash2, Unlink } from 'lucide-react'
import type { AnalyticsBoardPanel, AnalyticsItem, AnalyticsLabel, AnalyticsModel, BoardFilterKey, BoardLayout } from '@/core/models/analytics'
import { bootDirection } from '@/core/theme/direction'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { cellAt, gridPlacement, keyAction, rowsShown, type LayoutAction, type LayoutState } from './layout'
import { labelIn } from './view-model'
import { viewTitleOf } from './ViewChart'

/**
 * The board editor's grid (ticket 777): the 12 logical columns on CSS grid with fixed row units, so the board
 * mirrors under Arabic by itself. Each panel has a move handle and a resize handle at its bottom-end corner:
 * drag them with a pointer, or focus them and use the arrows (Shift with an arrow resizes from the move handle;
 * every arrow resizes from the resize handle). Every change goes through `./layout`'s reducer, which keeps the
 * minimum sizes and lets no panel overlap another. A polite live region says where the panel now is.
 */

/** The opt-outs a view panel may take: the six board filters and the cross-filter (766 story 25). */
export const OPT_OUTS: readonly BoardFilterKey[] = ['period', 'city', 'region', 'store', 'channel', 'country', 'crossFilter']

/** What the editor knows of a view panel's view: loaded, still loading, or removed (`ANALYTICS-404`). */
export type PanelView = { state: 'loaded'; item: AnalyticsItem } | { state: 'loading' } | { state: 'removed' } | { state: 'failed' }

type Drag = { id: string; mode: 'move' | 'resize'; grab: { col: number; row: number }; origin: LayoutState; last: string }

export default function BoardEditorGrid({
  layout,
  dispatch,
  views,
  model,
  lang,
}: {
  layout: LayoutState
  dispatch: Dispatch<LayoutAction>
  views: ReadonlyMap<string, PanelView>
  model: AnalyticsModel
  lang: string
}) {
  const { t } = useTranslation('boards')
  const grid = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const latest = useRef(layout)
  latest.current = layout
  const [said, setSaid] = useState<string | null>(null)
  const rows = rowsShown(layout.panels)

  const nameOf = (p: AnalyticsBoardPanel): string => {
    if (p.kind === 'section') return labelIn(p.title, lang) || t('boardEditor.kind.section')
    if (p.kind === 'text') return t('boardEditor.kind.text')
    const v = views.get(p.id)
    return v?.state === 'loaded' ? viewTitleOf(v.item, model, lang, t) : t('boardEditor.kind.view')
  }

  const cellOf = (e: PointerEvent) => {
    const g = grid.current!
    const rect = g.getBoundingClientRect()
    const gap = Number.parseFloat(getComputedStyle(g).rowGap) || 0
    return cellAt({ x: e.clientX, y: e.clientY }, rect, (rect.height + gap) / rowsShown(latest.current.panels), bootDirection)
  }
  const at = (id: string) => latest.current.panels.find((p) => p.id === id)?.layout

  const start = (e: PointerEvent<HTMLButtonElement>, id: string, mode: Drag['mode']) => {
    const l = at(id)
    if (!l || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const c = cellOf(e)
    drag.current = { id, mode, grab: { col: c.col - l.x, row: c.row - l.y }, origin: latest.current, last: '' }
  }
  const follow = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    const l = d?.origin.panels.find((p) => p.id === d.id)?.layout
    if (!d || !l) return
    const c = cellOf(e)
    // Every step from the drag's start: only where the pointer is now counts, not the cells it passed over.
    const action: LayoutAction =
      d.mode === 'move'
        ? { type: 'move', id: d.id, x: c.col - d.grab.col, y: Math.max(0, c.row - d.grab.row) }
        : { type: 'resize', id: d.id, w: c.col - l.x + 1, h: c.row - l.y + 1 }
    const key = JSON.stringify(action)
    if (key === d.last) return
    d.last = key
    dispatch({ type: 'reset', state: d.origin })
    dispatch(action)
  }
  const end = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setSaid(d.id)
  }
  const onKey = (e: KeyboardEvent, id: string, resizeOnly: boolean) => {
    const action = keyAction(id, e.key, resizeOnly || e.shiftKey, bootDirection)
    if (!action) return
    e.preventDefault()
    dispatch(action)
    setSaid(id)
  }

  const saidPanel = said ? layout.panels.find((p) => p.id === said) : undefined
  const where = (l: BoardLayout) => ({ x: fsi(l.x + 1), y: fsi(l.y + 1), w: fsi(l.w), h: fsi(l.h) })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('boardEditor.gridHint')}</p>
      <div
        ref={grid}
        className="grid grid-cols-12 gap-3 rounded-lg border border-dashed border-border p-2"
        style={{ gridTemplateRows: `repeat(${rows}, 5rem)` }}
        data-board-editor-grid
        data-rows={rows}
      >
        {layout.panels.map((p) => {
          const name = nameOf(p)
          const v = p.kind === 'view' ? views.get(p.id) : undefined
          const l = p.layout
          return (
            <article
              key={p.id}
              className="relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg border border-border/60 bg-card p-2"
              style={gridPlacement(l)}
              data-editor-panel={p.id}
              data-editor-panel-kind={p.kind}
              data-editor-panel-state={v?.state}
              data-layout={`${l.x},${l.y},${l.w},${l.h}`}
            >
              <header className="flex items-center gap-1">
                <IconButton
                  label={t('boardEditor.move', { panel: fsi(name) })}
                  className="cursor-grab touch-none"
                  onPointerDown={(e) => start(e, p.id, 'move')}
                  onPointerMove={follow}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onKeyDown={(e) => onKey(e, p.id, false)}
                  data-editor-move={p.id}
                >
                  <GripVertical className="size-4" aria-hidden />
                </IconButton>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight" data-editor-panel-name>
                  <bdi>{name}</bdi>
                </span>
                <IconButton label={t('boardEditor.remove', { panel: fsi(name) })} onClick={() => dispatch({ type: 'remove', id: p.id })} data-editor-remove={p.id}>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto">
                {p.kind === 'view' ? (
                  v?.state === 'removed' ? (
                    <p className="flex items-start gap-1 text-xs text-muted-foreground" data-editor-view-removed>
                      <Unlink className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {t('board.viewRemoved')}
                    </p>
                  ) : (
                    <OptOuts optOut={p.optOut} onChange={(optOut) => dispatch({ type: 'patch', id: p.id, patch: { optOut } })} />
                  )
                ) : p.kind === 'text' ? (
                  <Bilingual value={p.text} multiline onChange={(text) => dispatch({ type: 'patch', id: p.id, patch: { text } })} attr="data-editor-text" />
                ) : (
                  <Bilingual value={p.title} onChange={(title) => dispatch({ type: 'patch', id: p.id, patch: { title } })} attr="data-editor-section" />
                )}
              </div>
              <IconButton
                label={t('boardEditor.resize', { panel: fsi(name) })}
                size="compact"
                className="absolute bottom-0.5 end-0.5 cursor-nwse-resize touch-none rtl:cursor-nesw-resize"
                onPointerDown={(e) => start(e, p.id, 'resize')}
                onPointerMove={follow}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={(e) => onKey(e, p.id, true)}
                data-editor-resize={p.id}
              >
                {/* The glyph points to the bottom-end corner, so it mirrors with the writing direction. */}
                <MoveDiagonal2 className="size-3.5 rtl:-scale-x-100" aria-hidden />
              </IconButton>
            </article>
          )
        })}
      </div>
      <p className="sr-only" aria-live="polite" data-board-editor-said>
        {saidPanel ? t('boardEditor.placed', { panel: fsi(nameOf(saidPanel)), ...where(saidPanel.layout) }) : ''}
      </p>
    </div>
  )
}

function OptOuts({ optOut, onChange }: { optOut: readonly BoardFilterKey[]; onChange: (next: BoardFilterKey[]) => void }) {
  const { t } = useTranslation('boards')
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={t('boardEditor.optOut.label')}>
      <span className="text-xs text-muted-foreground">{t('boardEditor.optOut.label')}</span>
      <div className="flex flex-wrap gap-1">
        {OPT_OUTS.map((k) => {
          const on = optOut.includes(k)
          return (
            <Chip key={k} on={on} onClick={() => onChange(on ? optOut.filter((x) => x !== k) : [...optOut, k])} data-editor-opt-out={k}>
              {t(`boardEditor.optOut.${k}`)}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

function Bilingual({ value, onChange, multiline = false, attr }: { value: AnalyticsLabel; onChange: (next: AnalyticsLabel) => void; multiline?: boolean; attr: string }) {
  const { t } = useTranslation('boards')
  const field = (lang: 'en' | 'ar') => {
    const props = {
      value: value[lang],
      dir: lang === 'en' ? ('ltr' as const) : ('rtl' as const),
      'aria-label': t(`boardEditor.words.${lang}`),
      placeholder: t(`boardEditor.words.${lang}`),
      [attr]: lang,
    }
    return multiline ? (
      <Textarea key={lang} rows={2} className="min-w-0 flex-1 resize-none" {...props} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} />
    ) : (
      <Input key={lang} className="min-w-0 flex-1" {...props} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} />
    )
  }
  return <div className="flex gap-1.5">{field('en')}{field('ar')}</div>
}
