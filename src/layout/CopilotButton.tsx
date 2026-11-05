import { lazy, Suspense, useEffect, useId } from 'react'
import { useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles } from 'lucide-react'
import Button from '@/core/ui/Button'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { useCopilotPanel } from '@/core/copilot-panel'
import { canAskCopilot, copilotAccessQuery } from '@/features/copilot/access'

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
        <SideSheet onClose={close} width="w-[32rem]" aria-labelledby={titleId} data-copilot-sheet>
          <SideSheetHeader
            titleId={titleId}
            eyebrow={t('eyebrow')}
            title={t('title')}
            hint={t('subtitle')}
            closeLabel={t('close')}
            onClose={close}
          />
          <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
            <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}>
              <CopilotPanel />
            </Suspense>
          </div>
        </SideSheet>
      )}
    </>
  )
}
