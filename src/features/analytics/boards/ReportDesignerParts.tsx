import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, BarChart3, GripVertical, LayoutList, Plus, Settings2, Sparkles, Trash2, Type } from 'lucide-react'
import type { AnalyticsItem, AnalyticsLabel, AnalyticsModel, AnalyticsReportBlock, AnalyticsReportDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import { useAutoScroll } from '@/core/ui/use-auto-scroll'
import { fsi } from '@/core/util/bidi'
import type { PanelBlock } from './panel-edit'
import { paramLabel } from './params'
import ReportCopyView from './ReportCopyView'
import ReportPanelEditor from './ReportPanelEditor'
import ReportTextEditor from './ReportTextEditor'
import { blockDrop, lineEdge, sectionDrop, slotAmong, type DragWhat, type DropAt } from './report-drop'
import { hasSummary } from './report-ops'
import { generatedTitle } from './title'

/**
 * The report designer's pieces (spec 819 §E, ticket 828; the 798 prototype's variant D): the outline, the block and
 * section tools, "Add to this section", the section inspector, and native HTML5 drag and drop. The page and its
 * history are `./ReportDesignerPage`; the moves themselves are `./report-ops`.
 */

// ── Drag and drop ─────────────────────────────────────────────────────────────────────────────────────────────
//
// The GRIP is what is dragged (so the fields inside a block stay selectable); the whole item (`data-dnd-item`) is
// the drag image. 846: a drag is over the GAP nearest the pointer among a list's items (`./report-drop`): a section's
// blocks (`blockList`, on the page's section and the outline's) or the report's sections (`sectionList`). A thin
// primary line on the nearest edge of one item shows exactly where it lands; a drop that is not allowed (the wrong
// kind, or the item's own place) shows none. A view dragged from the views list lands at a block gap too. A drop is
// one history step. While dragging, the page (or the outline) scrolls gently near its top and bottom edges
// (`useAutoScroll`). Up and down (`MoveTools`) are the keyboard's way to the same moves.

export type { DragWhat } from './report-drop'

const sameDrop = (a: DropAt | null, b: DropAt | null) =>
  a === b || (!!a && !!b && a.kind === b.kind && a.index === b.index && (a.kind === 'section' || (b.kind === 'block' && a.section === b.section)))

/** The boxes of a list's own items (`data-dnd-slot`), not those of a list nested inside it. */
const boxesOf = (list: HTMLElement, slot: 'block' | 'section', owner: string) =>
  Array.from(list.querySelectorAll<HTMLElement>(`[data-dnd-slot="${slot}"]`))
    .filter((el) => el.closest(owner) === list)
    .map((el) => el.getBoundingClientRect())

export function useReportDnd({
  def,
  onBlock,
  onSection,
  onView,
  page,
  outline,
}: {
  def: AnalyticsReportDefinition
  onBlock: (id: string, section: string, index: number) => void
  onSection: (id: string, index: number) => void
  /** 846: a view from the views list dropped at a block gap. */
  onView: (view: AnalyticsItem, section: string, index: number) => void
  /** 846: what auto-scrolls during a drag: the page, or the outline when the pointer is in it. */
  page: RefObject<HTMLElement | null>
  outline: RefObject<HTMLElement | null>
}) {
  const [drag, setDrag] = useState<DragWhat | null>(null)
  const [over, setOver] = useState<DropAt | null>(null)
  // The drag as the event handlers read it: set at once on dragstart, before the state re-renders them.
  const held = useRef<DragWhat | null>(null)
  const view = useRef<AnalyticsItem | null>(null)
  const pageScroll = useAutoScroll(page)
  const outlineScroll = useAutoScroll(outline)
  const begin = (item: DragWhat) => {
    held.current = item
    setDrag(item)
  }
  const end = useCallback(() => {
    held.current = null
    setDrag(null)
    setOver(null)
    view.current = null
  }, [])

  // While dragging, the pointer anywhere (a target or not) drives the edge auto-scroll of the pane it is in.
  useEffect(() => {
    if (!drag) return
    const onOver = (e: globalThis.DragEvent) => {
      const inOutline = !!outline.current && e.target instanceof Node && outline.current.contains(e.target)
      ;(inOutline ? pageScroll : outlineScroll).stop()
      ;(inOutline ? outlineScroll : pageScroll).follow(e.clientX, e.clientY)
    }
    const onStop = () => {
      pageScroll.stop()
      outlineScroll.stop()
    }
    window.addEventListener('dragover', onOver, true)
    window.addEventListener('drop', onStop, true)
    window.addEventListener('dragend', onStop, true)
    return () => {
      window.removeEventListener('dragover', onOver, true)
      window.removeEventListener('drop', onStop, true)
      window.removeEventListener('dragend', onStop, true)
      onStop()
    }
  }, [drag, outline, pageScroll, outlineScroll])

  const hover = (next: DropAt | null) => setOver((was) => (sameDrop(was, next) ? was : next))
  const land = (at: DropAt) => {
    if (held.current?.kind === 'block' && at.kind === 'block') onBlock(held.current.id, at.section, at.index)
    if (held.current?.kind === 'section' && at.kind === 'section') onSection(held.current.id, at.index)
    if (held.current?.kind === 'view' && at.kind === 'block' && view.current) onView(view.current, at.section, at.index)
    end()
  }
  const accept = (e: DragEvent<HTMLElement>, at: DropAt | null) => {
    if (!at) return
    e.preventDefault()
    e.dataTransfer.dropEffect = held.current?.kind === 'view' ? 'copy' : 'move'
  }
  // Leaving for another list's element is that list's `dragenter` (sent first): only leaving every list clears the line.
  const leave = (e: DragEvent<HTMLElement>) => {
    const to = e.relatedTarget
    if (!(to instanceof Element) || !to.closest('[data-dnd-blocks], [data-dnd-sections]')) hover(null)
  }
  return {
    drag,
    start: begin,
    /** 846: a view from the views list starts its drag. */
    startView: (item: AnalyticsItem) => {
      view.current = item
      begin({ kind: 'view', viewId: item.id })
    },
    end,
    dragging: (kind: 'section' | 'block', id: string) => drag?.kind === kind && drag.id === id,
    /** An item of a list (`data-dnd-slot`): the drag image, and one of the boxes the nearest gap is measured among. */
    slot: (kind: 'block' | 'section') => ({ 'data-dnd-item': '', 'data-dnd-slot': kind }),
    /** A section's blocks as a target: the gap nearest the pointer among them. A section drag passes through. */
    blockList: (section: string) => {
      const at = (e: DragEvent<HTMLElement>) => blockDrop(def, held.current, section, slotAmong(e.clientY, boxesOf(e.currentTarget, 'block', '[data-dnd-blocks]')))
      const over = (e: DragEvent<HTMLElement>) => {
        if (!held.current || held.current.kind === 'section') return
        e.stopPropagation()
        const next = at(e)
        accept(e, next)
        hover(next)
      }
      return {
        'data-dnd-blocks': section,
        // Entering a child is an `over` too: a browser may send only `dragenter` for a short move.
        onDragEnter: over,
        onDragOver: over,
        onDragLeave: leave,
        onDrop: (e: DragEvent<HTMLElement>) => {
          if (!held.current || held.current.kind === 'section') return
          e.stopPropagation()
          const next = at(e)
          if (!next) return
          e.preventDefault()
          land(next)
        },
      }
    },
    /** The report's sections as a target: the gap nearest the pointer among them, for a section drag only. */
    sectionList: () => {
      const at = (e: DragEvent<HTMLElement>) => sectionDrop(def, held.current, slotAmong(e.clientY, boxesOf(e.currentTarget, 'section', '[data-dnd-sections]')))
      const over = (e: DragEvent<HTMLElement>) => {
        if (!held.current) return
        // A block or a view between two sections has no gap to land in.
        const next = held.current.kind === 'section' ? at(e) : null
        accept(e, next)
        hover(next)
      }
      return {
        'data-dnd-sections': '',
        onDragEnter: over,
        onDragOver: over,
        onDragLeave: leave,
        onDrop: (e: DragEvent<HTMLElement>) => {
          const next = held.current?.kind === 'section' ? at(e) : null
          if (!next) return
          e.preventDefault()
          land(next)
        },
      }
    },
    /** Which edge of block `index` (of `count` in `section`) draws the line, if any. */
    blockLine: (section: string, index: number, count: number) => lineEdge(over?.kind === 'block' && over.section === section ? over.index : null, index, count),
    /** Whether an EMPTY section's heading draws the line (the only gap, 0). */
    emptyLine: (section: string) => over?.kind === 'block' && over.section === section && def.sections.find((s) => s.id === section)?.blocks.length === 0,
    /** Which edge of section `index` (of `count`) draws the line, if any. */
    sectionLine: (index: number, count: number) => lineEdge(over?.kind === 'section' ? over.index : null, index, count),
  }
}
export type ReportDnd = ReturnType<typeof useReportDnd>

// Literal classes (Tailwind sees whole names): the line sits in the middle of the gap its list leaves between items.
const LINE_AT = {
  tight: { before: '-top-px', after: '-bottom-px' },
  gap3: { before: '-top-[7px]', after: '-bottom-[7px]' },
  gap4: { before: '-top-[9px]', after: '-bottom-[9px]' },
} as const

/**
 * Where a dragged item will land (846): a thin primary line on one edge of the item it lands next to. The item is
 * `relative`; `gap` is its list's spacing, so the line sits in the gap's middle.
 */
export function DropLine({ edge, gap = 'tight' }: { edge: 'before' | 'after' | null | false; gap?: keyof typeof LINE_AT }) {
  if (!edge) return null
  return <span className={`pointer-events-none absolute inset-x-0 z-20 h-0.5 rounded-full bg-primary ${LINE_AT[gap][edge]}`} aria-hidden data-designer-drop-line={edge} />
}

export function Grip({ dnd, kind, id, what }: { dnd: ReportDnd; kind: 'section' | 'block'; id: string; what: string }) {
  const { t } = useTranslation('boards')
  return (
    <IconButton
      label={t('designer.tools.drag', { what: fsi(what) })}
      size="compact"
      className="cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
        const item = e.currentTarget.closest('[data-dnd-item]')
        if (item) e.dataTransfer.setDragImage(item, 24, 16)
        dnd.start({ kind, id })
      }}
      onDragEnd={dnd.end}
      data-designer-grip={`${kind}:${id}`}
    >
      <GripVertical className="size-3.5" aria-hidden />
    </IconButton>
  )
}

/** A section's or a block's tools: edit, up, down, remove — the keyboard's drag. */
export function MoveTools({ what, id, onEdit, onUp, onDown, onRemove }: { what: string; id: string; onEdit?: () => void; onUp: () => void; onDown: () => void; onRemove?: () => void }) {
  const { t } = useTranslation('boards')
  const w = fsi(what)
  return (
    <span className="flex items-center gap-0.5">
      {onEdit && (
        <IconButton label={t('designer.tools.edit', { what: w })} size="compact" onClick={onEdit} data-designer-edit={id}>
          <Settings2 className="size-3.5" aria-hidden />
        </IconButton>
      )}
      <IconButton label={t('designer.tools.up', { what: w })} size="compact" onClick={onUp} data-designer-up={id}>
        <ArrowUp className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton label={t('designer.tools.down', { what: w })} size="compact" onClick={onDown} data-designer-down={id}>
        <ArrowDown className="size-3.5" aria-hidden />
      </IconButton>
      {onRemove && (
        <IconButton label={t('designer.tools.remove', { what: w })} size="compact" variant="danger" onClick={onRemove} data-designer-remove={id}>
          <Trash2 className="size-3.5" aria-hidden />
        </IconButton>
      )}
    </span>
  )
}

/** What the designer calls a section or a block, in the screen's language. */
export function useNames(model: AnalyticsModel, lang: string) {
  const { t } = useTranslation('boards')
  return {
    section: (heading: AnalyticsLabel) => saysIn(heading, lang) || t('designer.section.untitled'),
    block: (b: AnalyticsReportBlock) =>
      b.kind === 'panel' ? saysIn(b.title, lang) || generatedTitle(b.definition, model, lang, t) || t('designer.block.untitledPanel') : t(`designer.block.${b.kind}`),
  }
}

export interface DesignerOps {
  select: (key: string) => void
  moveSection: (id: string, by: -1 | 1) => void
  moveBlock: (id: string, by: -1 | 1) => void
  removeSection: (id: string) => void
  removeBlock: (id: string) => void
  /** 846: Ctrl+D — a copy just after it, selected. */
  duplicateBlock: (id: string) => void
  addSection: () => void
  addBlock: (section: string, kind: 'panel' | 'text' | 'summary') => void
  /** 829: a saved view copied into a section, its provenance recorded. */
  copyView: (section: string, view: AnalyticsItem) => void
  /** 829: a block changed in place; `key` makes typing in one field one step. */
  updateBlock: (id: string, f: (b: AnalyticsReportBlock) => AnalyticsReportBlock, key?: string | null) => void
  /** 829: a parameter bound to a panel (`true` or a dimension), or unbound (`null`). */
  bind: (param: string, panel: string, target: string | true | null) => void
  addParam: () => void
}

/** Parameters, then the section tree: every row selectable, sections and blocks draggable. */
export function Outline({
  def,
  selected,
  ops,
  dnd,
  model,
  lang,
}: {
  def: AnalyticsReportDefinition
  selected: string | null
  ops: DesignerOps
  dnd: ReportDnd
  model: AnalyticsModel
  lang: string
}) {
  const { t } = useTranslation('boards')
  const names = useNames(model, lang)
  const rowClass = (key: string, dragging = false) =>
    `flex items-center gap-1 rounded-md ${dragging ? 'opacity-40 ' : ''}${selected === key ? 'bg-primary-050 text-primary-800' : 'hover:bg-muted'}`
  // 846: a name cut short shows in full on hover.
  const pick = (key: string, icon: ReactNode, name: string) => (
    <Button variant="ghost" className="min-w-0 flex-1 justify-start" onClick={() => ops.select(key)} aria-current={selected === key || undefined} title={fsi(name)} data-designer-outline={key}>
      {icon}
      <span className="truncate">
        <bdi>{name}</bdi>
      </span>
    </Button>
  )
  const heading = 'px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'
  return (
    <nav className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-2" aria-label={t('designer.outline.label')} data-designer-outline-nav>
      <div>
        <p className={heading}>{t('designer.outline.params')}</p>
        {def.params.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">{t('designer.outline.noParams')}</p>}
        {def.params.map((p) => (
          <div key={p.name} className={rowClass(`param:${p.name}`)}>
            {pick(`param:${p.name}`, <Settings2 className="size-3.5 shrink-0" aria-hidden />, paramLabel(p, lang, t))}
          </div>
        ))}
        <Button variant="text" onClick={ops.addParam} data-designer-outline-add-param>
          <Plus className="size-3.5" aria-hidden />
          {t('params.strip.add')}
        </Button>
      </div>
      <div {...dnd.sectionList()}>
        <p className={heading}>{t('designer.outline.sections')}</p>
        {def.sections.map((s, si) => (
          <div key={s.id} {...dnd.slot('section')} {...dnd.blockList(s.id)} className="relative">
            <DropLine edge={dnd.sectionLine(si, def.sections.length)} />
            <div className={rowClass(`section:${s.id}`, dnd.dragging('section', s.id)) + ' relative'}>
              <Grip dnd={dnd} kind="section" id={s.id} what={names.section(s.heading)} />
              {pick(`section:${s.id}`, <LayoutList className="size-3.5 shrink-0" aria-hidden />, names.section(s.heading))}
              <MoveTools
                what={names.section(s.heading)}
                id={`outline-section:${s.id}`}
                onUp={() => ops.moveSection(s.id, -1)}
                onDown={() => ops.moveSection(s.id, 1)}
                onRemove={() => ops.removeSection(s.id)}
              />
              <DropLine edge={dnd.emptyLine(s.id) && 'after'} />
            </div>
            {s.blocks.map((b, bi) => (
              <div key={b.id} {...dnd.slot('block')} className={rowClass(`block:${b.id}`, dnd.dragging('block', b.id)) + ' relative ps-3'}>
                <DropLine edge={dnd.blockLine(s.id, bi, s.blocks.length)} />
                <Grip dnd={dnd} kind="block" id={b.id} what={names.block(b)} />
                {pick(`block:${b.id}`, <BlockIcon block={b} />, names.block(b))}
                <MoveTools what={names.block(b)} id={`outline-block:${b.id}`} onUp={() => ops.moveBlock(b.id, -1)} onDown={() => ops.moveBlock(b.id, 1)} />
              </div>
            ))}
          </div>
        ))}
        <Button variant="text" onClick={ops.addSection} data-designer-outline-add-section>
          <Plus className="size-3.5" aria-hidden />
          {t('designer.add.section')}
        </Button>
      </div>
    </nav>
  )
}

function BlockIcon({ block }: { block: AnalyticsReportBlock }) {
  const Icon = block.kind === 'panel' ? BarChart3 : block.kind === 'text' ? Type : Sparkles
  return <Icon className="size-3.5 shrink-0" aria-hidden />
}

/**
 * "Add to this section": a chart or table, a text block, the AI summary (one per report: a second is not
 * offered), or a copy of a saved view (829).
 */
export function AddBlock({
  def,
  section,
  ops,
  model,
  lang,
  onClose,
}: {
  def: AnalyticsReportDefinition
  section: string
  ops: DesignerOps
  model: AnalyticsModel
  lang: string
  onClose?: () => void
}) {
  const { t } = useTranslation('boards')
  const one = hasSummary(def)
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2" data-designer-add-block={section}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outlined" onClick={() => ops.addBlock(section, 'panel')} data-designer-add-panel={section}>
          <BarChart3 className="size-3.5" aria-hidden />
          {t('designer.add.panel')}
        </Button>
        <Button variant="outlined" onClick={() => ops.addBlock(section, 'text')} data-designer-add-text={section}>
          <Type className="size-3.5" aria-hidden />
          {t('designer.add.text')}
        </Button>
        <Button
          variant="outlined"
          aria-disabled={one || undefined}
          title={one ? t('designer.add.summaryOne') : undefined}
          onClick={() => !one && ops.addBlock(section, 'summary')}
          data-designer-add-summary={section}
        >
          <Sparkles className="size-3.5" aria-hidden />
          {t('designer.add.summary')}
        </Button>
        {onClose && (
          <Button variant="text" className="ms-auto" onClick={onClose}>
            {t('designer.add.close')}
          </Button>
        )}
      </div>
      <ReportCopyView model={model} lang={lang} section={section} onCopy={(view) => ops.copyView(section, view)} />
    </div>
  )
}

/** The section editor: its heading in English and Arabic, adding to it, and removing it (no confirm: Undo). */
export function SectionInspector({
  def,
  id,
  ops,
  model,
  lang,
  onHeading,
}: {
  def: AnalyticsReportDefinition
  id: string
  ops: DesignerOps
  model: AnalyticsModel
  lang: string
  onHeading: (heading: AnalyticsLabel, lang: 'en' | 'ar') => void
}) {
  const { t } = useTranslation('boards')
  const s = def.sections.find((x) => x.id === id)
  if (!s) return null
  return (
    <div className="flex flex-col gap-3" data-designer-section-inspector={id}>
      <h2 className="text-base font-semibold">{t('designer.inspector.section')}</h2>
      <Field label={t('designer.section.headingEn')}>
        <Input value={s.heading.en} dir="ltr" onChange={(e) => onHeading({ ...s.heading, en: e.target.value }, 'en')} data-designer-heading="en" />
      </Field>
      <Field label={t('designer.section.headingAr')}>
        <Input value={s.heading.ar} dir="rtl" onChange={(e) => onHeading({ ...s.heading, ar: e.target.value }, 'ar')} data-designer-heading="ar" />
      </Field>
      <AddBlock def={def} section={id} ops={ops} model={model} lang={lang} />
      <div>
        <Button variant="danger-outlined" onClick={() => ops.removeSection(id)} data-designer-remove-section={id}>
          <Trash2 className="size-3.5" aria-hidden />
          {t('designer.section.remove')}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">{t('designer.section.removeHint')}</p>
      </div>
    </div>
  )
}

/**
 * A block in the inspector (829): its editor — the panel editor, the text editor, or what the summary is — and
 * removing it (no confirm: Undo).
 */
export function BlockInspector({
  block,
  name,
  ops,
  def,
  model,
  lang,
}: {
  block: AnalyticsReportBlock
  name: string
  ops: DesignerOps
  def: AnalyticsReportDefinition
  model: AnalyticsModel
  lang: string
}) {
  const { t } = useTranslation('boards')
  return (
    <div className="flex flex-col gap-3" data-designer-block-inspector={block.id}>
      <h2 className="text-base font-semibold">
        {t(`designer.inspector.${block.kind}`)}
        {block.kind === 'panel' && (
          <span className="ms-2 text-sm font-normal text-muted-foreground">
            <bdi>{name}</bdi>
          </span>
        )}
      </h2>
      {block.kind === 'panel' ? (
        <ReportPanelEditor
          block={block}
          def={def}
          model={model}
          lang={lang}
          onBlock={(f, key) => ops.updateBlock(block.id, (b) => (b.kind === 'panel' ? f(b as PanelBlock) : b), key)}
          onBind={(param, target) => ops.bind(param, block.id, target)}
        />
      ) : block.kind === 'text' ? (
        <ReportTextEditor block={block} def={def} model={model} lang={lang} onText={(text, key) => ops.updateBlock(block.id, (b) => (b.kind === 'text' ? { ...b, text } : b), key)} />
      ) : (
        <div className="flex flex-col gap-1 text-sm" data-designer-summary-explain>
          <p>{t('designer.summary.explain')}</p>
          <p className="text-xs text-muted-foreground">{t('designer.summary.design')}</p>
        </div>
      )}
      <div>
        <Button variant="danger-outlined" onClick={() => ops.removeBlock(block.id)} data-designer-remove-block={block.id}>
          <Trash2 className="size-3.5" aria-hidden />
          {t('designer.block.remove')}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">{t('designer.block.removeHint')}</p>
        <p className="mt-1 text-xs text-muted-foreground" data-designer-keys-hint>
          {t(block.kind === 'summary' ? 'designer.keys.summary' : 'designer.keys.block')}
        </p>
      </div>
    </div>
  )
}
