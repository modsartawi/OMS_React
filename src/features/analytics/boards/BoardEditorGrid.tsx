import { useEffect, useRef, useState, type Dispatch, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpToLine, GripVertical, MoveDiagonal2, Trash2, Unlink } from 'lucide-react'
import type { AnalyticsBoardPanel, AnalyticsItem, AnalyticsLabel, AnalyticsModel, BoardFilterKey, BoardLayout } from '@/core/models/analytics'
import { bootDirection } from '@/core/theme/direction'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Textarea from '@/core/ui/Textarea'
import { useAutoScroll } from '@/core/ui/use-auto-scroll'
import { fsi } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import { cellAt, dropOutline, gridPlacement, keyAction, rowsShown, type Cell, type LayoutAction, type LayoutState, type Size } from './layout'
import { VIEW_DRAG_TYPE } from './palette'
import { viewTitleOf } from './ViewChart'

/**
 * The board editor's grid (ticket 777): the 12 logical columns on CSS grid with fixed row units, so the board
 * mirrors under Arabic by itself. Each panel has a move handle and a resize handle at its bottom-end corner:
 * drag them with a pointer, or focus them and use the arrows (Shift with an arrow resizes from the move handle;
 * every arrow resizes from the resize handle). Every change goes through `./layout`'s reducer, which keeps the
 * minimum sizes and lets no panel overlap another. A polite live region says where the panel now is.
 */

/**
 * The opt-outs a view panel may take: the cross-filter only (766 story 25). Since 824 the parameters reach a
 * panel through the board's bindings, set in the parameter inspector, not through opt-outs.
 */
export const OPT_OUTS: readonly BoardFilterKey[] = ['crossFilter']

/** What the editor knows of a view panel's view: loaded, still loading, or removed (`ANALYTICS-404`). */
export type PanelView = { state: 'loaded'; item: AnalyticsItem } | { state: 'loading' } | { state: 'removed' } | { state: 'failed' }

type Pointer = { clientX: number; clientY: number }
type Drag = { id: string; mode: 'move' | 'resize'; grab: { col: number; row: number }; origin: LayoutState; last: string; handle: HTMLButtonElement; pointerId: number }

/** Whether a key went to a text field (its own Delete, Escape and undo stay the field's). */
export const typingIn = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || (target.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((target as HTMLInputElement).type)))

export default function BoardEditorGrid({
  layout,
  dispatch,
  views,
  model,
  lang,
  dropping = null,
  onDropView,
  picked = [],
  onPick,
  onGesture,
  onDuplicate,
  onCloseGaps,
}: {
  layout: LayoutState
  dispatch: Dispatch<LayoutAction>
  views: ReadonlyMap<string, PanelView>
  model: AnalyticsModel
  lang: string
  /** 837: a palette view is being dragged — its asked size and minimum, for the drop outline; `null` when none is. */
  dropping?: { asked: Size; min: Size } | null
  /** 837: a palette view dropped on a cell (its id from the drag's data). */
  onDropView?: (viewId: string, at: Cell) => void
  /** 846: the selected panels (Ctrl or Shift-click adds one); the arrows on one of them move them all, Delete removes them all. */
  picked?: readonly string[]
  /** 846: a click picks one panel (`add`: Ctrl, Cmd or Shift held — toggle it in the selection); `null` clears. */
  onPick?: (id: string | null, add: boolean) => void
  /** 846: a pointer drag started (`true`) or ended (`false`): the history records one step per drag, at its end. */
  onGesture?: (active: boolean) => void
  /** 846: Ctrl+D on a panel. */
  onDuplicate?: (id: string) => void
  /** 846: a section header's "Close gaps in this section". */
  onCloseGaps?: (section: string) => void
}) {
  const { t } = useTranslation('boards')
  const grid = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const latest = useRef(layout)
  latest.current = layout
  const [said, setSaid] = useState<string | null>(null)
  const [over, setOver] = useState<Cell | null>(null)
  // 846: the panel a pointer drag holds (drawn as the ghost of where it lands).
  const [held, setHeld] = useState<string | null>(null)
  if (!dropping && over) setOver(null)
  const outline = dropping && over ? dropOutline(over, dropping.asked, dropping.min) : null
  const rows = Math.max(rowsShown(layout.panels), outline ? outline.y + outline.h : 0)

  const nameOf = (p: AnalyticsBoardPanel): string => {
    if (p.kind === 'section') return saysIn(p.title, lang) || t('boardEditor.kind.section')
    if (p.kind === 'text') return t('boardEditor.kind.text')
    const v = views.get(p.id)
    return v?.state === 'loaded' ? viewTitleOf(v.item, model, lang, t) : t('boardEditor.kind.view')
  }

  const cellOf = (e: Pointer) => {
    const g = grid.current!
    const rect = g.getBoundingClientRect()
    const gap = Number.parseFloat(getComputedStyle(g).rowGap) || 0
    // The rows the grid draws right now (the drop outline may have added some below).
    const drawn = Number(g.dataset.rows) || rowsShown(latest.current.panels)
    return cellAt({ x: e.clientX, y: e.clientY }, rect, (rect.height + gap) / drawn, bootDirection)
  }
  // 837: a palette view dragged over the grid shows where it lands; dropped, it is placed there.
  const carriesView = (e: DragEvent) => !!dropping && e.dataTransfer.types.includes(VIEW_DRAG_TYPE)
  const overCell = (p: Pointer) => {
    const c = cellOf(p)
    setOver((o) => (o && o.col === c.col && o.row === c.row ? o : c))
  }
  const at = (id: string) => latest.current.panels.find((p) => p.id === id)?.layout

  /** Where the held panel goes for a pointer here — worked out from the drag's start, so only where the pointer is now counts. */
  const place = (p: Pointer) => {
    const d = drag.current
    const l = d?.origin.panels.find((q) => q.id === d.id)?.layout
    if (!d || !l) return
    const c = cellOf(p)
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
  // 846 item 1: near the top or bottom of the window the page scrolls gently while a drag holds still there, and
  // the cell under the (still) pointer is worked out again after each scroll — a pointer drag and a palette drop alike.
  const scroll = useAutoScroll(grid, (p) => {
    if (drag.current) place(p)
    else if (dropping) overCell(p)
  })

  const dragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!carriesView(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    overCell(e)
    scroll.follow(e.clientX, e.clientY)
  }
  const dragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setOver(null)
    scroll.stop()
  }
  const drop = (e: DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData(VIEW_DRAG_TYPE)
    setOver(null)
    scroll.stop()
    if (!id || !onDropView) return
    e.preventDefault()
    onDropView(id, cellOf(e))
  }
  // The palette drag ended elsewhere (dropped outside, or Esc): nothing scrolls on.
  useEffect(() => {
    if (!dropping && !drag.current) scroll.stop()
  }, [dropping, scroll])

  const start = (e: PointerEvent<HTMLButtonElement>, id: string, mode: Drag['mode']) => {
    const l = at(id)
    if (!l || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const c = cellOf(e)
    drag.current = { id, mode, grab: { col: c.col - l.x, row: c.row - l.y }, origin: latest.current, last: '', handle: e.currentTarget, pointerId: e.pointerId }
    setHeld(id)
    onGesture?.(true)
  }
  const follow = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    place(e)
    scroll.follow(e.clientX, e.clientY)
  }
  const finish = (cancel: boolean) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    scroll.stop()
    if (cancel) dispatch({ type: 'reset', state: d.origin })
    if (d.handle.hasPointerCapture(d.pointerId)) d.handle.releasePointerCapture(d.pointerId)
    setHeld(null)
    setSaid(d.id)
    onGesture?.(false)
  }
  const end = () => finish(false)
  // 846 item 5: Esc during a drag puts every panel back where the drag found it.
  useEffect(() => {
    if (!held) return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      finish(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
    // `finish` reads refs only; re-bound per drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held])

  /** The panels a key on `id` acts on: the whole selection when `id` is in it, else just `id`. */
  const groupOf = (id: string) => (picked.length > 1 && picked.includes(id) ? [...picked] : [id])
  const onKey = (e: KeyboardEvent, id: string, resizeOnly: boolean) => {
    const action = keyAction(id, e.key, resizeOnly || e.shiftKey, bootDirection)
    if (!action) return
    e.preventDefault()
    e.stopPropagation()
    const group = groupOf(id)
    dispatch(action.type === 'nudge' && group.length > 1 ? { type: 'nudgeMany', ids: group, dx: action.dx, dy: action.dy } : action)
    setSaid(id)
  }
  // 846 item 6: on a focused panel, Delete removes it (or the selection it is in) and Ctrl+D duplicates it.
  const panelKey = (e: KeyboardEvent<HTMLElement>, id: string) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      onDuplicate?.(id)
      return
    }
    if (e.key !== 'Delete' || typingIn(e.target)) return
    e.preventDefault()
    const group = groupOf(id)
    dispatch(group.length > 1 ? { type: 'removeMany', ids: group } : { type: 'remove', id })
  }

  const saidPanel = said ? layout.panels.find((p) => p.id === said) : undefined
  const where = (l: BoardLayout) => ({ x: fsi(l.x + 1), y: fsi(l.y + 1), w: fsi(l.w), h: fsi(l.h) })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('boardEditor.gridHint')}</p>
      <div
        ref={grid}
        // 846: no scroll anchoring inside the grid — while panels reflow under a drag, the browser would otherwise
        // shift the page to keep some panel still, a jump on top of the auto-scroll.
        className="grid grid-cols-12 gap-3 rounded-lg border border-dashed border-border p-2 [overflow-anchor:none]"
        style={{ gridTemplateRows: `repeat(${rows}, 5rem)` }}
        data-board-editor-grid
        data-rows={rows}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
      >
        {outline && (
          <div
            className="pointer-events-none relative z-10 rounded-lg border-2 border-dashed border-primary bg-primary/5"
            style={gridPlacement(outline)}
            aria-hidden
            data-board-drop-outline={`${outline.x},${outline.y},${outline.w},${outline.h}`}
          />
        )}
        {layout.panels.map((p) => {
          const name = nameOf(p)
          const v = p.kind === 'view' ? views.get(p.id) : undefined
          const l = p.layout
          const ghost = held === p.id
          const on = picked.includes(p.id)
          return (
            <article
              key={p.id}
              className={
                'relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg p-2 ' +
                // 846 item 5: the held panel is drawn as a ghost where it will land; the others reflow around it.
                (ghost ? 'border-2 border-dashed border-primary bg-primary/5 ' : 'border bg-card ' + (on ? 'border-primary ring-2 ring-primary/40 ' : 'border-border/60 '))
              }
              style={gridPlacement(l)}
              onClick={(e) => onPick?.(p.id, e.ctrlKey || e.metaKey || e.shiftKey)}
              onKeyDown={(e) => panelKey(e, p.id)}
              data-editor-panel={p.id}
              data-editor-panel-kind={p.kind}
              data-editor-panel-state={v?.state}
              data-editor-picked={on ? '' : undefined}
              data-editor-ghost={ghost ? '' : undefined}
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
                {p.kind === 'section' && onCloseGaps && (
                  <IconButton label={t('boardEditor.gaps.closeSection', { panel: fsi(name) })} onClick={() => onCloseGaps(p.id)} data-editor-close-gaps={p.id}>
                    <ArrowUpToLine className="size-4" aria-hidden />
                  </IconButton>
                )}
                <IconButton label={t('boardEditor.remove', { panel: fsi(name) })} onClick={() => dispatch({ type: 'remove', id: p.id })} data-editor-remove={p.id}>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </header>
              <div className={'flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto' + (ghost ? ' opacity-40' : '')}>
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
