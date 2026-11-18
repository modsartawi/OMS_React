import { useTranslation } from 'react-i18next'
import type { StoreDbJobKind } from '@/core/models/store-database'
import Button from '@/core/ui/Button'

/**
 * A panel's row of job buttons (oms 918). The caller mounts it only for the Act key (`jobActionsVisible`) and opens
 * `JobDialog` with the kind picked. Each button reads `storeDb.jobs.kinds.<Kind>.button`.
 */
export default function JobButtons({ kinds, onPick, hint }: { kinds: readonly StoreDbJobKind[]; onPick: (kind: StoreDbJobKind) => void; hint?: string }) {
  const { t } = useTranslation('sync-console')
  return (
    <section className="flex flex-col gap-2" data-job-buttons={kinds.join(' ')}>
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <Button key={kind} variant="secondary" onClick={() => onPick(kind)} data-job-button={kind}>
            {t(`storeDb.jobs.kinds.${kind}.button`)}
          </Button>
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  )
}
