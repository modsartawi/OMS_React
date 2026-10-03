import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, MoreHorizontal, Pencil, Plus, Star, StarOff, Trash2, type LucideIcon } from 'lucide-react'
import { takesEscape } from '@/core/commands/key-layer'
import { POPOVER } from '@/core/ui/overlay'
import { fsi } from '@/core/util/bidi'
import type { SavedView } from './saved-views'
import { CursorBar, RAIL_FOCUS, RAIL_HEADING, railRowTone } from './ViewsRail'

/** The ⋯ menu's five acts (366, 368 §1). */
export type ViewAction = 'update' | 'saveAs' | 'rename' | 'toggleDefault' | 'delete'

/**
 * The views rail's **My views** section (ticket 400, spec 380 L7; ruling 368 §1): the
 * operator's own saved views, under the lenses.
 *
 * Each row applies its view on a click. A **star** marks the default, a **`layout` tag** an
 * imported layout-only view, and the active view shows the **modified dot** once it has drifted.
 * The active row takes the lenses' `--primary-050` + `--cursor` pair. A **⋯ menu** shows on
 * hover or focus: Update (only once the active view has drifted — or, for an active layout-only
 * view, at once, because re-saving one is what makes it a full view), Save as new…, Rename…,
 * Make/Remove default, Delete. **+ Save current view** sits at the rail's foot.
 */
export default function MyViews({
  views,
  activeId,
  defaultId,
  modified,
  onApply,
  onAction,
  onSave,
}: {
  views: readonly SavedView[]
  activeId: string | null
  defaultId: string | null
  modified: boolean
  onApply: (view: SavedView) => void
  onAction: (action: ViewAction, view: SavedView) => void
  onSave: () => void
}) {
  const { t } = useTranslation('deliveries')
  return (
    <>
      <h2
        id="deliveries-my-views"
        className={'mt-3 ' + RAIL_HEADING}
      >
        {t('views.heading')}
      </h2>
      {views.length === 0 ? (
        <p className="px-2 text-[11px] text-muted-foreground" data-views-none="">
          {t('views.none')}
        </p>
      ) : (
        <ul aria-labelledby="deliveries-my-views" className="flex flex-col gap-px" data-my-views="">
          {views.map((view) => (
            <li key={view.id}>
              <ViewRow
                view={view}
                active={view.id === activeId}
                isDefault={view.id === defaultId}
                modified={view.id === activeId && modified}
                onApply={() => onApply(view)}
                onAction={(action) => onAction(action, view)}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-2">
        <button
          type="button"
          data-view-save=""
          onClick={onSave}
          className={
            'flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground ' +
            'hover:bg-accent hover:text-accent-foreground ' +
            RAIL_FOCUS
          }
        >
          <Plus className="size-3.5 shrink-0" aria-hidden />
          {t('views.saveCurrent')}
        </button>
      </div>
    </>
  )
}

/** The modified dot: amber, as the bar's unapplied edits are (368 §3). Shared with the grid bar. */
export function ModifiedDot() {
  const { t } = useTranslation('deliveries')
  return (
    <span
      role="img"
      aria-label={t('views.modified')}
      title={t('views.modified')}
      data-view-modified=""
      className="inline-block size-2 shrink-0 rounded-full bg-attention"
    />
  )
}

function ViewRow({
  view,
  active,
  isDefault,
  modified,
  onApply,
  onAction,
}: {
  view: SavedView
  active: boolean
  isDefault: boolean
  modified: boolean
  onApply: () => void
  onAction: (action: ViewAction) => void
}) {
  const { t } = useTranslation('deliveries')
  const [menuOpen, setMenuOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const layoutOnly = view.query === null

  return (
    <div
      ref={rowRef}
      data-view-row={view.id}
      data-view-name={view.name}
      className={'group relative flex h-7 items-center rounded-md text-xs ' + railRowTone(active)}
    >
      {active && <CursorBar />}
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        data-view-apply=""
        onClick={onApply}
        className={'flex h-full min-w-0 flex-1 items-center gap-2 rounded-md ps-2.5 pe-1 text-start ' + RAIL_FOCUS}
      >
        <bdi className="min-w-0 flex-1 truncate">{view.name}</bdi>
        {layoutOnly && (
          <span
            title={t('views.layoutOnlyHint')}
            data-view-layout=""
            className="shrink-0 rounded border border-border px-1 text-[10px] font-normal uppercase leading-4 tracking-wide text-muted-foreground"
          >
            {t('views.layoutOnly')}
          </span>
        )}
        {isDefault && (
          <Star
            className="size-3 shrink-0 fill-current text-primary"
            role="img"
            aria-label={t('views.default')}
            data-view-default=""
          />
        )}
        {modified && <ModifiedDot />}
      </button>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('views.menu.label', { name: fsi(view.name) })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-view-menu-trigger=""
        onClick={() => setMenuOpen((open) => !open)}
        className={
          'me-1 grid size-5 shrink-0 place-items-center rounded hover:bg-card ' +
          'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring ' +
          (menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')
        }
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </button>
      {menuOpen && (
        <ViewMenu
          rowRef={rowRef}
          canUpdate={active && (modified || layoutOnly)}
          isDefault={isDefault}
          onClose={(refocus) => {
            setMenuOpen(false)
            if (refocus) triggerRef.current?.focus()
          }}
          onAction={(action) => {
            setMenuOpen(false)
            onAction(action)
          }}
        />
      )}
    </div>
  )
}

function ViewMenu({
  rowRef,
  canUpdate,
  isDefault,
  onClose,
  onAction,
}: {
  rowRef: RefObject<HTMLDivElement | null>
  canUpdate: boolean
  isDefault: boolean
  onClose: (refocus: boolean) => void
  onAction: (action: ViewAction) => void
}) {
  const { t } = useTranslation('deliveries')
  const menuRef = useRef<HTMLDivElement>(null)
  // Read through a ref, so the page re-rendering under the open menu never re-runs the effect.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Opens on its first enabled act; a click outside the row or Escape closes it.
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const onDown = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) closeRef.current(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!takesEscape(e, menuRef.current)) return
      e.preventDefault()
      closeRef.current(true)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [rowRef])

  /** ↓/↑ walk the enabled acts, wrapping, as a menu's arrows do. */
  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('views.menu.title')}
      data-view-menu=""
      onKeyDown={onKeyDown}
      className={'absolute start-full top-0 z-50 ms-1 flex w-56 flex-col p-1 font-normal text-foreground ' + POPOVER}
    >
      <MenuItem icon={Check} action="update" disabled={!canUpdate} onAction={onAction}>
        {t('views.menu.update')}
      </MenuItem>
      <MenuItem icon={Plus} action="saveAs" onAction={onAction}>
        {t('views.menu.saveAs')}
      </MenuItem>
      <MenuItem icon={Pencil} action="rename" onAction={onAction}>
        {t('views.menu.rename')}
      </MenuItem>
      <MenuItem icon={isDefault ? StarOff : Star} action="toggleDefault" onAction={onAction}>
        {t(isDefault ? 'views.menu.removeDefault' : 'views.menu.makeDefault')}
      </MenuItem>
      <div className="my-0.5 border-t border-border" role="separator" />
      <MenuItem icon={Trash2} action="delete" danger onAction={onAction}>
        {t('views.menu.delete')}
      </MenuItem>
    </div>
  )
}

function MenuItem({
  icon: Icon,
  action,
  danger = false,
  disabled = false,
  onAction,
  children,
}: {
  icon: LucideIcon
  action: ViewAction
  danger?: boolean
  disabled?: boolean
  onAction: (action: ViewAction) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      data-view-action={action}
      onClick={() => onAction(action)}
      className={
        'flex h-7 w-full items-center gap-2 rounded px-2 text-start text-xs hover:bg-accent ' +
        'focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50 disabled:hover:bg-transparent ' +
        (danger ? 'text-danger-800' : '')
      }
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}
