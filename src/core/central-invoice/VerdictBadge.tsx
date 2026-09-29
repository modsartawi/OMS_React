import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { VERDICT_SEVERITY, verdictOf } from './verdicts'

/**
 * One central-invoice verdict as a pill (ticket 332) — the delivery page's dialog and the
 * bulk screen's grid draw the same one. A verdict this client does not recognise is shown
 * as the server spelled it, in the muted pill, never relabelled as one of the three.
 */
export default function VerdictBadge({ verdict }: { verdict: string }) {
  const { t } = useTranslation('central-invoice')
  const known = verdictOf(verdict)
  return (
    <StatusBadge sev={VERDICT_SEVERITY[known]}>
      {known === 'unknown' ? verdict : t(`verdict.${known}`)}
    </StatusBadge>
  )
}
