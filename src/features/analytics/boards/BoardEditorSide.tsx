import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Heading, LayoutPanelTop, PanelLeftClose, PanelLeftOpen, Type } from 'lucide-react'
import type { AnalyticsBoardPanel } from '@/core/models/analytics'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'
import { fsi } from '@/core/util/bidi'
import ViewsPalette from './ViewsPalette'

/**
 * The board editor's side list (ticket 846 items 3 and 7): the views palette and the board's outline as two tabs.
 * The page sizes it (a `PaneSeparator` on its inline-end edge, the width remembered) and it folds to a thin rail.
 * The outline lists the panels in reading order, each section's panels under its header; a click scrolls to the
 * panel and focuses it, Ctrl or Shift-click adds it to the selection.
 */

const KIND_ICON = { view: LayoutPanelTop, text: Type, section: Heading } as const

export interface OutlineEntry {
  id: string
  kind: AnalyticsBoardPanel['kind']
  depth: 0 | 1
  name: string
}

const COLLAPSED_KEY = 'oms.boardEditor.sideCollapsed'
const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function useSideCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const set = (next: boolean) => {
    setCollapsed(next)
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(next))
    } catch {
      // Storage blocked: it lasts this visit.
    }
  }
  return [collapsed, set]
}

export default function BoardEditorSide({
  id,
  collapsed,
  onCollapse,
  palette,
  outline,
  picked,
  onJump,
}: {
  /** The pane's element id (the separator's `aria-controls`). */
  id: string
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
  palette: Omit<ComponentProps<typeof ViewsPalette>, 'heading'>
  outline: readonly OutlineEntry[]
  picked: readonly string[]
  onJump: (id: string, add: boolean) => void
}) {
  const { t } = useTranslation('boards')
  const [tab, setTab] = useState<'views' | 'outline'>('views')

  if (collapsed) {
    return (
      <div id={id} className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-card p-1" data-board-side="collapsed">
        <IconButton label={t('boardEditor.side.open')} onClick={() => onCollapse(false)} data-board-side-toggle>
          {/* The glyph points toward the inline end, so it mirrors with the writing direction. */}
          <PanelLeftOpen className="size-4 rtl:-scale-x-100" aria-hidden />
        </IconButton>
      </div>
    )
  }
  return (
    <div id={id} className="flex min-w-0 flex-col gap-2" data-board-side="open">
      <div className="flex items-center gap-1">
        <div className="flex flex-1 flex-wrap gap-1" role="tablist" aria-label={t('boardEditor.side.label')}>
          <Chip variant="tab" on={tab === 'views'} onClick={() => setTab('views')} data-board-side-tab="views">
            {t('boardEditor.palette.title')}
          </Chip>
          <Chip variant="tab" on={tab === 'outline'} onClick={() => setTab('outline')} data-board-side-tab="outline">
            {t('boardEditor.outline.title')}
          </Chip>
        </div>
        <IconButton label={t('boardEditor.side.close')} onClick={() => onCollapse(true)} data-board-side-toggle>
          <PanelLeftClose className="size-4 rtl:-scale-x-100" aria-hidden />
        </IconButton>
      </div>
      {tab === 'views' ? (
        <ViewsPalette {...palette} heading={false} />
      ) : (
        <nav className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card p-2" aria-label={t('boardEditor.outline.title')} data-board-outline>
          {outline.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('boardEditor.outline.empty')}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t('boardEditor.outline.hint')}</p>
              <ul className="flex max-h-[32rem] flex-col gap-0.5 overflow-auto">
                {outline.map((e) => {
                  const Icon = KIND_ICON[e.kind]
                  const on = picked.includes(e.id)
                  return (
                    <li key={e.id} className={e.depth ? 'ps-4' : ''}>
                      <Chip
                        on={on}
                        className={'w-full justify-start ' + (e.kind === 'section' ? 'font-semibold' : '')}
                        title={fsi(e.name)}
                        onClick={(ev) => onJump(e.id, ev.ctrlKey || ev.metaKey || ev.shiftKey)}
                        data-board-outline-entry={e.id}
                      >
                        <Icon className="size-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate">
                          <bdi>{e.name}</bdi>
                        </span>
                      </Chip>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </nav>
      )}
    </div>
  )
}
