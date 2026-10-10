import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'

/**
 * A time stamped by the store's till (spec 2563: `tillBacklogOldestAt`,
 * `oldestDeferredAt`), with the small "till clock" hint: a till whose clock drifts
 * shows its own time, as is, and the hint says whose clock it is. Formatted like
 * every other server time — never shifted. `null` draws nothing.
 */
export default function TillClockTime({ value }: { value: string | null }) {
  const { t } = useTranslation('sync-console')
  if (!value) return null
  return (
    <span className="inline-flex items-baseline gap-1.5" data-till-time="">
      <Ltr>{formatDateTime(value)}</Ltr>
      <span className="text-[10px] text-muted-foreground" data-till-clock="">
        {t('mirror.tillClock')}
      </span>
    </span>
  )
}
