import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { pickSupportDiagnosisQuery } from './api'
import { PickSupportFailureBanner } from './bits'
import DiagnosisPanel from './DiagnosisPanel'

/**
 * One delivery's diagnosis, read and drawn (ticket 496): `GET PickSupport/Delivery/{no}`, then the
 * panel. The console draws it under the search box; Document Details (499) draws it in its folded
 * section. A refusal (`PICK-00002` for a number that is not a delivery) shows the server's message
 * with its code; a bare 403 the UI's own sentence.
 */
export default function DeliveryDiagnosis({ deliveryNo }: { deliveryNo: string }) {
  const { t } = useTranslation('pick-support')
  const diagnosis = useQuery(pickSupportDiagnosisQuery(deliveryNo))

  if (diagnosis.isPending)
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground" role="status" data-ps-loading="">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('panel.loading')}
      </div>
    )
  if (diagnosis.isError)
    return <PickSupportFailureBanner error={diagnosis.error} title={t('panel.failedTitle')} fallback={t('panel.failed')} />
  // Callers key this component by the delivery, so the panel's filters start fresh per delivery.
  return <DiagnosisPanel diagnosis={diagnosis.data} />
}
