import { useMemo, useState, type ComponentType, type DragEvent, type KeyboardEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ChartArea, ChartColumn, ChartLine, ChartNoAxesCombined, ChartPie, GripVertical, Grid3x3, Hash, Plus, Table2 } from 'lucide-react'
import type { AnalyticsChartType, AnalyticsItem, AnalyticsModel } from '@/core/models/analytics'
import { useSession } from '@/core/session'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { fsi, stripIsolates } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import { LIBRARY_WHO, type LibraryFolder, type LibraryWho } from './library'
import { useLibraryFolders } from './use-library'
import { definitionKnown, paletteViews, VIEW_DRAG_TYPE } from './palette'
import TierBadge from './TierBadge'
import { viewTitleOf } from './ViewChart'

/**
 * The board editor's views palette (ticket 837 item 2): every view I can read, with the title search and the
 * library's who-chips (All · Mine · Certified · Shared with me), each row with its chart type's icon and its
 * owner. A row drags onto the grid (`VIEW_DRAG_TYPE`, the grid places it at the drop cell), or "+" — or Enter on
 * the focused row — adds it at the end of the board.
 */

const CHART_ICON: Record<AnalyticsChartType, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  kpi: Hash,
  line: ChartLine,
  area: ChartArea,
  bar: ChartColumn,
  donut: ChartPie,
  table: Table2,
  heatmap: Grid3x3,
  combo: ChartNoAxesCombined,
}

export default function ViewsPalette({
  items,
  loading,
  failed,
  model,
  lang,
  onAdd,
  onDragStart,
  onDragEnd,
  heading = true,
  hint,
  target = 'board',
}: {
  items: readonly AnalyticsItem[] | undefined
  loading: boolean
  failed: boolean
  model: AnalyticsModel
  lang: string
  onAdd: (item: AnalyticsItem) => void
  onDragStart: (item: AnalyticsItem) => void
  onDragEnd: () => void
  /** 846: false when the caller titles the list itself (the board editor's Views · Outline tabs). */
  heading?: boolean
  /** 846: the caller's own how-to line (the report designer drops into sections, not a grid); default the grid's. */
  hint?: string
  /** What a view is added to, for the add button's words: the board editor's grid, or the report designer's section. */
  target?: 'board' | 'report'
}) {
  const { t } = useTranslation('boards')
  const me = useSession((s) => s.userId) ?? ''
  const [who, setWho] = useState<LibraryWho>('all')
  const [search, setSearch] = useState('')
  // 837: my folders narrow the palette too (hidden until the server has them, 3432).
  const { folders, available } = useLibraryFolders()
  const [folder, setFolder] = useState<LibraryFolder>('all')
  const titleOf = useMemo(() => (it: AnalyticsItem) => stripIsolates(viewTitleOf(it, model, lang, t)), [model, lang, t])
  const shown = useMemo(
    () => paletteViews(items ?? [], who, search, me, toIsoDate(new Date()), (it) => ({ en: titleOf(it), ar: titleOf(it) }), folder),
    [items, who, search, me, titleOf, folder],
  )

  return (
    <aside className="flex min-h-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-label={t('boardEditor.palette.title')} data-board-palette>
      {heading && <h3 className="text-sm font-semibold tracking-tight">{t('boardEditor.palette.title')}</h3>}
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('boardEditor.palette.search')}
        aria-label={t('boardEditor.palette.search')}
        wrapperClassName="w-full"
        data-board-palette-search
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label={t('boardEditor.palette.whoLabel')}>
        {LIBRARY_WHO.map((w) => (
          <Chip key={w} on={who === w} onClick={() => setWho(w)} data-board-palette-who={w}>
            {t(`boardEditor.palette.who.${w}`)}
          </Chip>
        ))}
      </div>
      {available && folders.length > 0 && (
        <Select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label={t('boardEditor.palette.folder')} data-board-palette-folder>
          <option value="all">{t('boardEditor.palette.folderAll')}</option>
          <option value="none">{t('boardEditor.palette.folderNone')}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {fsi(f.name)}
            </option>
          ))}
        </Select>
      )}
      <p className="text-xs text-muted-foreground">{hint ?? t('boardEditor.palette.hint')}</p>
      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('boardEditor.viewsLoading')}
        </p>
      ) : failed ? (
        <p className="text-sm text-muted-foreground" data-board-palette-failed>
          {t('boardEditor.palette.failed')}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-board-palette-empty>
          {t('boardEditor.palette.none')}
        </p>
      ) : (
        <ul className="-mx-1 flex max-h-[32rem] flex-col gap-1 overflow-auto px-1" data-board-palette-list>
          {shown.map((it) => (
            <PaletteRow key={it.id} item={it} title={titleOf(it)} onAdd={onAdd} onDragStart={onDragStart} onDragEnd={onDragEnd} target={target} />
          ))}
        </ul>
      )}
    </aside>
  )
}

function PaletteRow({
  item,
  title,
  onAdd,
  onDragStart,
  onDragEnd,
  target,
}: {
  item: AnalyticsItem
  title: string
  onAdd: (item: AnalyticsItem) => void
  onDragStart: (item: AnalyticsItem) => void
  onDragEnd: () => void
  target: 'board' | 'report'
}) {
  const { t } = useTranslation('boards')
  const known = definitionKnown(item)
  const chart = item.definition.chart.type
  const Icon = known ? (CHART_ICON[chart] ?? ChartColumn) : ChartColumn
  const start = (e: DragEvent<HTMLLIElement>) => {
    e.dataTransfer.setData(VIEW_DRAG_TYPE, item.id)
    e.dataTransfer.setData('text/plain', title)
    e.dataTransfer.effectAllowed = 'copy'
    onDragStart(item)
  }
  const key = (e: KeyboardEvent<HTMLLIElement>) => {
    // Enter on the row itself; the "+" inside it is its own button.
    if (e.key !== 'Enter' || e.target !== e.currentTarget) return
    e.preventDefault()
    onAdd(item)
  }
  return (
    <li
      draggable
      tabIndex={0}
      onDragStart={start}
      onDragEnd={onDragEnd}
      onKeyDown={key}
      aria-label={t(target === 'report' ? 'boardEditor.palette.rowToReport' : 'boardEditor.palette.row', { view: fsi(title), owner: fsi(item.owner) })}
      // 846 item 3: the full name on hover, for a name the row cuts short.
      title={fsi(title || t('home.untitled'))}
      className="group flex cursor-grab items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 hover:bg-muted/50 focus-visible:bg-muted/50 active:cursor-grabbing"
      data-board-palette-view={item.id}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span role="img" aria-label={known ? t(`boardEditor.palette.chart.${chart}`) : t('boardEditor.kind.view')} className="shrink-0 text-muted-foreground" data-board-palette-chart={known ? chart : ''}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {/* 846 item 3: a long name wraps to two lines before it is cut. */}
        <span className="line-clamp-2 break-words text-sm font-medium leading-snug" data-board-palette-name>
          <bdi>{title || t('home.untitled')}</bdi>
        </span>
        <span className="truncate text-xs text-muted-foreground" data-board-palette-owner>
          <Trans t={t} i18nKey="boardEditor.palette.owner" values={{ owner: item.owner }} components={{ owner: <bdi /> }} />
        </span>
      </span>
      {item.tier === 'certified' && <TierBadge tier={item.tier} />}
      <IconButton label={t(target === 'report' ? 'boardEditor.palette.addToReport' : 'boardEditor.palette.add', { view: fsi(title) })} size="compact" onClick={() => onAdd(item)} data-board-palette-add={item.id}>
        <Plus className="size-3.5" aria-hidden />
      </IconButton>
    </li>
  )
}
