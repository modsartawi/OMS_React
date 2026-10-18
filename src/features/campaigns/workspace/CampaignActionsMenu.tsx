import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Copy, FlaskConical, MoreHorizontal, type LucideIcon } from 'lucide-react'
import type { RuleDraft } from '@/core/models/rule-campaign'
import { simulatorPath } from '@/core/rules/campaign-state'
import { takesEscape } from '@/core/commands/key-layer'
import { POPOVER } from '@/core/ui/overlay'
import CopyCampaignDialog from './CopyCampaignDialog'

/**
 * The dashboard's **⋯** menu (the prototype's State-cell menu). Ticket 502 gives it **Copy
 * campaign** (ticket 524: the author picks the copy's id and name, `CopyCampaignDialog`): HQ makes
 * an independent draft, and the copy opens on its own dashboard; the campaign it was copied from is
 * untouched. Ticket 514 adds **Simulate the working
 * copy**: the simulator opens with this campaign's draft chosen. Later slices add their acts here.
 */
export default function CampaignActionsMenu({ draft }: { draft: RuleDraft }) {
  const { t } = useTranslation('campaign-workspace')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [copying, setCopying] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('actions.label')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-campaign-actions=""
        className="inline-flex h-7 items-center justify-center rounded-md border border-border-strong px-2 text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </button>
      {open && (
        <ActionsPopover wrapRef={wrapRef} onClose={close}>
          <MenuItem
            icon={Copy}
            data="copy"
            onClick={() => {
              close(false)
              setCopying(true)
            }}
          >
            {t('actions.copy')}
          </MenuItem>
          <MenuItem
            icon={FlaskConical}
            data="simulate"
            onClick={() => {
              close(false)
              navigate(simulatorPath(draft.code))
            }}
          >
            {t('actions.simulate')}
          </MenuItem>
        </ActionsPopover>
      )}
      {copying && <CopyCampaignDialog source={draft} onClose={() => setCopying(false)} />}
    </div>
  )
}

/** The open menu: focus on its first act; a click outside or Escape closes it; ↓/↑ walk it. */
function ActionsPopover({
  wrapRef,
  onClose,
  children,
}: {
  wrapRef: RefObject<HTMLDivElement | null>
  onClose: (refocus: boolean) => void
  children: ReactNode
}) {
  const { t } = useTranslation('campaign-workspace')
  const menuRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
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
  }, [wrapRef])

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const step = e.key === 'ArrowDown' ? 1 : -1
    // From outside the items, down lands on the first and up on the last.
    const next = at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('actions.label')}
      onKeyDown={onKeyDown}
      data-campaign-actions-menu=""
      className={'absolute start-0 top-full z-50 mt-1 flex w-56 flex-col p-1 text-foreground ' + POPOVER}
    >
      {children}
    </div>
  )
}

function MenuItem({ icon: Icon, data, onClick, children }: { icon: LucideIcon; data: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      data-campaign-action={data}
      className="flex h-7 w-full items-center gap-2 rounded px-2 text-start text-xs hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}
