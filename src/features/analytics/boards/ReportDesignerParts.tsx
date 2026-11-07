import { useCallback, useState, type DragEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, BarChart3, GripVertical, LayoutList, Plus, Settings2, Sparkles, Trash2, Type } from 'lucide-react'
import type { AnalyticsItem, AnalyticsLabel, AnalyticsModel, AnalyticsReportBlock, AnalyticsReportDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import { fsi } from '@/core/util/bidi'
import type { PanelBlock } from './panel-edit'
import { paramLabel } from './params'
import ReportCopyView from './ReportCopyView'
import ReportPanelEditor from './ReportPanelEditor'
import ReportTextEditor from './ReportTextEditor'
import { dropIndex, dropSide, hasSummary } from './report-ops'
import { generatedTitle } from './title'

/**
 * The report designer's pieces (spec 819 §E, ticket 828; the 798 prototype's variant D): the outline, the block and
 * section tools, "Add to this section", the section inspector, and native HTML5 drag and drop. The page and its
 * history are `./ReportDesignerPage`; the moves themselves are `./report-ops`.
 */

// ── Drag and drop ─────────────────────────────────────────────────────────────────────────────────────────────
//
// The GRIP is what is dragged (so the fields inside a block stay selectable); the whole item (`data-dnd-item`) is
// the drag image and the drop target. The top half of a target lands before it, the bottom half after it; a block
// dropped on a section (not on one of its blocks) goes to the section's end. A drop is one history step. Up and
// down (`MoveTools`) are the keyboard's way to the same moves.

export type DragItem = { kind: 'section' | 'block'; id: string }
type DropAt = { kind: 'section'; index: number } | { kind: 'block'; section: string; index: number }

const sideOf = (e: DragEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  return dropSide(e.clientY, r.top, r.height)
}
const same = (a: DropAt | null, b: DropAt) =>
  !!a && a.kind === b.kind && a.index === b.index && (a.kind === 'section' || (b.kind === 'block' && a.section === b.section))

export function useReportDnd({
  onBlock,
  onSection,
}: {
  onBlock: (id: string, section: string, index: number) => void
  onSection: (id: string, index: number) => void
}) {
  const [drag, setDrag] = useState<DragItem | null>(null)
  const [over, setOver] = useState<DropAt | null>(null)
  const end = useCallback(() => {
    setDrag(null)
    setOver(null)
  }, [])
  const hover = (next: DropAt) => setOver((was) => (same(was, next) ? was : next))
  const land = (at: DropAt) => {
    if (drag?.kind === 'block' && at.kind === 'block') onBlock(drag.id, at.section, at.index)
    if (drag?.kind === 'section' && at.kind === 'section') onSection(drag.id, at.index)
    end()
  }
  return {
    drag,
    start: (item: DragItem) => setDrag(item),
    end,
    dragging: (kind: DragItem['kind'], id: string) => drag?.kind === kind && drag.id === id,
    /** A block as a target: before or after it, in its own section. */
    blockTarget: (section: string, index: number) => ({
      'data-dnd-item': '',
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (drag?.kind !== 'block') return
        e.preventDefault()
        e.stopPropagation()
        hover({ kind: 'block', section, index: dropIndex(index, sideOf(e)) })
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        if (drag?.kind !== 'block') return
        e.preventDefault()
        e.stopPropagation()
        land({ kind: 'block', section, index: dropIndex(index, sideOf(e)) })
      },
    }),
    /** A section as a target: a section lands before or after it; a block dropped on it goes to its end. */
    sectionTarget: (index: number, section: string, blocks: number) => {
      const at = (e: DragEvent<HTMLElement>): DropAt | null =>
        drag?.kind === 'section' ? { kind: 'section', index: dropIndex(index, sideOf(e)) } : drag?.kind === 'block' ? { kind: 'block', section, index: blocks } : null
      return {
        'data-dnd-item': '',
        onDragOver: (e: DragEvent<HTMLElement>) => {
          const next = at(e)
          if (!next) return
          e.preventDefault()
          hover(next)
        },
        onDrop: (e: DragEvent<HTMLElement>) => {
          const next = at(e)
          if (!next) return
          e.preventDefault()
          land(next)
        },
      }
    },
    lineAtBlock: (section: string, index: number) => drag?.kind === 'block' && over?.kind === 'block' && over.section === section && over.index === index,
    lineAtSection: (index: number) => drag?.kind === 'section' && over?.kind === 'section' && over.index === index,
  }
}
export type ReportDnd = ReturnType<typeof useReportDnd>

/** Where a dragged item will land: a line, shown only there. */
export function DropLine({ show }: { show: boolean }) {
  return <div className={`h-0.5 rounded-full ${show ? 'bg-primary' : 'bg-transparent'}`} aria-hidden data-designer-drop-line={show ? 'on' : 'off'} />
}

export function Grip({ dnd, kind, id, what }: { dnd: ReportDnd; kind: DragItem['kind']; id: string; what: string }) {
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
  const pick = (key: string, icon: ReactNode, label: ReactNode) => (
    <Button variant="ghost" className="min-w-0 flex-1 justify-start" onClick={() => ops.select(key)} aria-current={selected === key || undefined} data-designer-outline={key}>
      {icon}
      <span className="truncate">{label}</span>
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
            {pick(`param:${p.name}`, <Settings2 className="size-3.5 shrink-0" aria-hidden />, <bdi>{paramLabel(p, lang, t)}</bdi>)}
          </div>
        ))}
        <Button variant="text" onClick={ops.addParam} data-designer-outline-add-param>
          <Plus className="size-3.5" aria-hidden />
          {t('params.strip.add')}
        </Button>
      </div>
      <div>
        <p className={heading}>{t('designer.outline.sections')}</p>
        {def.sections.map((s, si) => (
          <div key={s.id}>
            <DropLine show={dnd.lineAtSection(si)} />
            <div {...dnd.sectionTarget(si, s.id, s.blocks.length)} className={rowClass(`section:${s.id}`, dnd.dragging('section', s.id))}>
              <Grip dnd={dnd} kind="section" id={s.id} what={names.section(s.heading)} />
              {pick(`section:${s.id}`, <LayoutList className="size-3.5 shrink-0" aria-hidden />, <bdi>{names.section(s.heading)}</bdi>)}
              <MoveTools
                what={names.section(s.heading)}
                id={`outline-section:${s.id}`}
                onUp={() => ops.moveSection(s.id, -1)}
                onDown={() => ops.moveSection(s.id, 1)}
                onRemove={() => ops.removeSection(s.id)}
              />
            </div>
            {s.blocks.map((b, bi) => (
              <div key={b.id}>
                <DropLine show={dnd.lineAtBlock(s.id, bi)} />
                <div {...dnd.blockTarget(s.id, bi)} className={rowClass(`block:${b.id}`, dnd.dragging('block', b.id)) + ' ps-3'}>
                  <Grip dnd={dnd} kind="block" id={b.id} what={names.block(b)} />
                  {pick(`block:${b.id}`, <BlockIcon block={b} />, <bdi>{names.block(b)}</bdi>)}
                  <MoveTools what={names.block(b)} id={`outline-block:${b.id}`} onUp={() => ops.moveBlock(b.id, -1)} onDown={() => ops.moveBlock(b.id, 1)} />
                </div>
              </div>
            ))}
            <DropLine show={dnd.lineAtBlock(s.id, s.blocks.length)} />
          </div>
        ))}
        <DropLine show={dnd.lineAtSection(def.sections.length)} />
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
      </div>
    </div>
  )
}
