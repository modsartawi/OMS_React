import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { exportBadge } from './document-graph'

/**
 * Where one document stands on its way to SAP — **the three-way badge**
 * (ticket 297).
 *
 * Drawn in two places, the rail card and the document's attribute strip, and it
 * is one component for that reason: the raw-code fallback for an unrecognised
 * state is the branch that would rot if the second site were a copy of the
 * first, and it is the branch nobody exercises by hand.
 *
 * 🔑 `exported` · `batched-not-exported` · `not-batched`, each with its own
 * severity and its own sentence. A boolean would lose the middle one, which is
 * the state a consultant most needs: sealed into a batch that has not left yet.
 */
export default function ExportStateBadge({ state }: { state: string | null | undefined }) {
  const { t } = useTranslation('reports')
  const badge = exportBadge(state)
  return (
    <StatusBadge sev={badge.sev}>
      {/* ⚠️ An unrecognised value prints ITSELF, muted, rather than joining one of
          the three. A fourth state invented server-side must look wrong here,
          not quietly claim to be exported. */}
      {badge.key ? t(`idocInspector.exportState.${badge.key}`) : badge.raw}
    </StatusBadge>
  )
}
