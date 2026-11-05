import { lazy, Suspense, useEffect, useId, type KeyboardEvent, type PointerEvent } from 'react'
import { useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Maximize2, Minimize2, Sparkles } from 'lucide-react'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { useCopilotPanel } from '@/core/copilot-panel'
import { canAskCopilot, copilotAccessQuery } from '@/features/copilot/access'
import { clampSheetWidth, useCopilotSheetSize } from './copilot-sheet-size'

// The panel is lazy: a session that never opens it pays for the probe only (`access` is its own module).
const CopilotPanel = lazy(() => import('@/features/copilot/CopilotPanel'))

/**
 * "Ask the OMS" in the top bar (ticket 735, spec 734 D11), opening the copilot panel in a side sheet.
 *
 * 🚩 Fails closed (D7): the button exists only once `Copilot/Access` has answered `canAsk: true` —
 * pending, errored (404, unreachable, 403) or malformed draws nothing, because the panel sends the
 * question to an external AI service. The door's grant filter is the real boundary.
 *
 * Ticket 782: the open state lives in `@/core/copilot-panel`, not here, so a screen's ask box can open
 * this same sheet with a question the panel sends. The button publishes the probe's answer there as
 * `available`, which is what a screen gates its ask box on.
 */
export default function CopilotButton() {
  const { t } = useTranslation('copilot')
  const access = useQuery(copilotAccessQuery())
  const open = useCopilotPanel((s) => s.open)
  const openPanel = useCopilotPanel((s) => s.openPanel)
  const close = useCopilotPanel((s) => s.close)
  const setAvailable = useCopilotPanel((s) => s.setAvailable)
  const titleId = useId()
  const allowed = access.isSuccess && canAskCopilot(access.data)
  useEffect(() => setAvailable(allowed), [allowed, setAvailable])
  // An answer's order link navigates (ticket 736): the modal sheet closes so the document is seen.
  const { pathname } = useLocation()
  useEffect(() => close(), [pathname, close])
  if (!allowed) return null
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => openPanel()}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-copilot-button
        className="h-7"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="sr-only lg:not-sr-only">{t('button')}</span>
      </Button>
      {open && (
        <CopilotSheet titleId={titleId} onClose={close} />
      )}
    </>
  )
}

/**
 * The copilot's side sheet (CTO demo): resizable from its inline-start edge, and a full view that fills the screen. Both
 * are remembered (`./copilot-sheet-size`). Full view lays the panel out wide, with the past conversations beside it.
 */
function CopilotSheet({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  const { t } = useTranslation('copilot')
  const { width, full, toggleFull } = useCopilotSheetSize()
  const shown = full ? '100vw' : `${clampSheetWidth(width, window.innerWidth)}px`
  return (
    <SideSheet onClose={onClose} width="" style={{ width: shown, maxWidth: full ? '100vw' : '96vw' }} aria-labelledby={titleId} data-copilot-sheet>
      {!full && <ResizeEdge />}
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('eyebrow')}
        title={t('title')}
        hint={t('subtitle')}
        closeLabel={t('close')}
        onClose={onClose}
        actions={
          <IconButton label={full ? t('sheet.exitFull') : t('sheet.full')} aria-pressed={full} onClick={toggleFull} data-copilot-full>
            {full ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </IconButton>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}>
          <CopilotPanel wide={full} />
        </Suspense>
      </div>
    </SideSheet>
  )
}

/**
 * The sheet's drag edge: a vertical separator on its inline-start side (the side away from the screen's edge, so it
 * follows the text direction). Drag it, or focus it and use the arrow keys; a double click goes back to the default.
 */
function ResizeEdge() {
  const { t } = useTranslation('copilot')
  const { width, setWidth, commit, reset } = useCopilotSheetSize()
  const rtl = () => document.documentElement.dir === 'rtl'
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const sheet = e.currentTarget.closest('dialog')?.getBoundingClientRect()
    if (!sheet) return
    setWidth(clampSheetWidth(rtl() ? e.clientX - sheet.left : sheet.right - e.clientX, window.innerWidth))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    // The edge is on the inline-start side: the arrow pointing away from the sheet widens it.
    const wider = (e.key === 'ArrowLeft') !== rtl()
    setWidth(clampSheetWidth(width + (wider ? 32 : -32), window.innerWidth))
    commit()
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('sheet.resize')}
      aria-valuenow={width}
      title={t('sheet.resize')}
      tabIndex={0}
      className="absolute inset-y-0 start-0 z-20 w-1.5 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={drag}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        commit()
      }}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      data-copilot-resize
    />
  )
}
