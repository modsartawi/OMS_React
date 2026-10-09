import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import type { ControlOutcome } from './ControlDialog'

/**
 * The failures of the last control (ticket 447), listed with their codes until
 * dismissed — the toast says how many, this says which and why. A code the bundle
 * has words for shows them beside the code; any other shows the raw code alone.
 */
export default function ControlResults({ outcome, onDismiss }: { outcome: ControlOutcome | null; onDismiss: () => void }) {
  const { t } = useTranslation('sync-console')
  if (!outcome || outcome.summary.failures.length === 0) return null
  return (
    <div
      className="flex flex-col gap-1.5 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800"
      role="status"
      data-control-failures={outcome.action}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{t('results.refusedTitle', { action: t(`controls.${outcome.action}`) })}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-0.5 hover:opacity-70"
          aria-label={t('results.dismiss')}
          title={t('results.dismiss')}
          data-control-failures-dismiss=""
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {outcome.summary.failures.map((f, i) => (
          <li key={`${i}-${f.id}`} className="flex flex-wrap items-center gap-x-2" data-failure={f.id} data-failure-code={f.code}>
            <span className="font-mono font-medium">
              <Ltr>{f.id}</Ltr>
            </span>
            {f.labelKey && <span>{t(f.labelKey)}</span>}
            {f.code && (
              <span className="font-mono opacity-80">
                <Ltr>{f.code}</Ltr>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
