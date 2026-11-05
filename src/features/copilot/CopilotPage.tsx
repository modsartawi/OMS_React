import { useTranslation } from 'react-i18next'
import ScreenGate from '@/core/ui/ScreenGate'
import { canAskCopilot, copilotAccessQuery } from './access'
import CopilotPanel from './CopilotPanel'

/**
 * `/copilot` — the copilot as a full page (ticket 735, spec 734 D11): the same panel the top bar's
 * "Ask the OMS" opens, behind `canAskCopilot` on `GET Copilot/Access`, the predicate the button reads.
 *
 * 🚩 Fails closed (D7): pending shows the check, and anything but an explicit `canAsk` shows the denial,
 * because the panel sends the question to an external AI service.
 */
export default function CopilotPage() {
  const { t } = useTranslation('copilot')
  return (
    <ScreenGate query={copilotAccessQuery()} can={canAskCopilot} ns="copilot" title={t('title')} subtitle={t('subtitle')}>
      <div className="flex min-h-0 w-full max-w-6xl flex-1 flex-col">
        <CopilotPanel wide />
      </div>
    </ScreenGate>
  )
}
