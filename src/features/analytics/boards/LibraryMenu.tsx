import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { takesEscape } from '@/core/commands/key-layer'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import { POPOVER } from '@/core/ui/overlay'

export interface LibraryMenuItem {
  key: string
  /** Already translated; a data value in it is isolated by the caller. */
  label: ReactNode
  icon?: LucideIcon
  onSelect: () => void
  /** Shown but not chosen (the folder the item is already in). */
  current?: boolean
  danger?: boolean
}

/**
 * 837: the library's small ⋯ menus — a folder's Rename / Delete, a row's Move to folder. An icon button opens a
 * popover of menu items (shared Buttons, so the control ratchet holds); focus lands on the first item, ↓/↑ walk
 * them, Escape or a press outside closes it and Escape gives focus back to the button. This is the keyboard path
 * for everything the rows' drag and drop does.
 */
export default function LibraryMenu({
  label,
  icon: Icon,
  items,
  data,
  align = 'end',
}: {
  label: string
  icon: LucideIcon
  items: readonly LibraryMenuItem[]
  data?: string
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeRef.current(false)
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
  }, [open])

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const at = all.indexOf(document.activeElement as HTMLButtonElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    const next = at < 0 ? (step > 0 ? 0 : all.length - 1) : (at + step + all.length) % all.length
    all[next]?.focus()
  }

  return (
    <div ref={wrapRef} className="relative">
      <IconButton
        ref={buttonRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        data-analytics-library-menu={data ?? ''}
      >
        <Icon className="size-3.5" aria-hidden />
      </IconButton>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`absolute ${align === 'end' ? 'end-0' : 'start-0'} top-full z-50 mt-1 flex max-h-72 w-56 flex-col overflow-y-auto p-1 text-foreground ${POPOVER}`}
          data-analytics-library-menu-items={data ?? ''}
        >
          {items.map((it) => {
            const ItemIcon = it.icon
            return (
              <Button
                key={it.key}
                variant="text"
                role="menuitem"
                disabled={it.current}
                aria-current={it.current || undefined}
                className={`w-full justify-start rounded-md px-2 py-1 text-start ${it.danger ? 'text-danger-800' : 'text-foreground'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  close(false)
                  it.onSelect()
                }}
                data-analytics-library-menu-item={it.key}
              >
                {ItemIcon && <ItemIcon className="size-3.5 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
