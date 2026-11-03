import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import { courierQuoteView } from '@/core/dispatch/courier-quote'
import type { DispatchCourierQuote } from '@/core/models/dispatch-board'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatParts, fsi } from '@/core/util/bidi'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'

/**
 * The courier quote (spec 3306, oms ticket 712) in the inspector: `NoCourier` / `Failed` as an attention flag with
 * when it was checked, `Quoted` as a quiet "Predicted: …" line, nothing when there is no quote yet. Always a
 * PREDICTION: neither flag means the order failed, the OTO order is created anyway.
 */
export default function CourierQuote({ quote }: { quote: DispatchCourierQuote | null | undefined }) {
  const { t } = useTranslation('dispatch-board')
  const view = courierQuoteView(quote)
  if (view.kind === 'none') return null
  // Each line is built as ONE string (`formatParts`) and isolated once; a value inside a sentence is `fsi`'d whole.
  // Led by words, so `<bdi>` (dir auto).
  const checked = t('quote.checkedAt', { at: fsi(formatDateTime(view.checkedAt)) })
  if (view.kind === 'flag') {
    return (
      <div className="flex flex-col gap-0.5 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" role="status" data-courier-flag={view.outcome}>
        <span className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <bdi>{formatParts([t(view.key), checked])}</bdi>
        </span>
        <span>{t('quote.flagHint')}</span>
      </div>
    )
  }
  if (view.kind === 'quoted') {
    const predicted = t('quote.predicted', { company: fsi(view.company), money: fsi(view.money), eta: fsi(view.eta) })
    return (
      <p className="text-xs text-muted-foreground" data-courier-quoted="">
        <bdi>{formatParts([predicted, checked])}</bdi>
      </p>
    )
  }
  return (
    <p className="text-xs text-muted-foreground" data-courier-other={view.raw}>
      <bdi>{formatParts([t('quote.other', { outcome: fsi(view.raw) }), checked])}</bdi>
    </p>
  )
}

/** The board row's flag: only `NoCourier` / `Failed`, with the check's time of day. Nothing otherwise. */
export function CourierFlag({ quote }: { quote: DispatchCourierQuote | null | undefined }) {
  const { t } = useTranslation('dispatch-board')
  const view = courierQuoteView(quote)
  if (view.kind !== 'flag') return null
  return (
    <span className="inline-flex items-center gap-1.5" data-courier-flag={view.outcome}>
      <StatusBadge sev="warn">
        <AlertTriangle className="me-1 h-3 w-3" aria-hidden />
        {t(view.key)}
      </StatusBadge>
      <span className="font-mono text-[12px] text-muted-foreground">
        <Ltr>{formatTimeOfDay(view.checkedAt)}</Ltr>
      </span>
    </span>
  )
}
