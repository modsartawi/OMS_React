import { useTranslation } from 'react-i18next'
import type { PromotionEngine } from '@/core/models/rule-campaign'
import StatusBadge from '@/core/ui/StatusBadge'

/** A store's engine as a badge: the list's cell and the history's "now". */
export default function EngineBadge({ engine }: { engine: PromotionEngine }) {
  const { t } = useTranslation('engine-switch')
  return (
    <span data-engine={engine}>
      <StatusBadge sev={engine === 'Rule' ? 'ok' : 'mute'}>{t(`engine.${engine}`)}</StatusBadge>
    </span>
  )
}
