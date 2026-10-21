import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { PickSupportShapeMatch } from '@/core/models/pick-support'
import { omsAccessQuery } from '@/core/oms/api'
import { canFixPickSupport, canSeePickSupportSerial } from '@/core/oms/access'
import { pickSupportDiagnosisQuery } from './api'
import { PickSupportFailureBanner } from './bits'
import DiagnosisPanel from './DiagnosisPanel'
import FixDialog from './FixDialog'

/**
 * One delivery's diagnosis, read and drawn (ticket 496): `GET PickSupport/Delivery/{no}`, then the
 * panel. The console draws it under the search box; Document Details (499) draws it in its folded
 * section. A refusal (`PICK-00002` for a number that is not a delivery) shows the server's message
 * with its code; a bare 403 the UI's own sentence.
 *
 * Apply fix (ticket 497): the panel's buttons are drawn only with `canFixPickSupport`, read off the
 * ONE shared OMS probe. The fix dialog is held here, not in the shape card, so it stays open over
 * the panel the fix has just turned HEALTHY (no card left) to show the store's instructions.
 * `onFixed` tells a host whose own load the fix changed (Document Details' document, 499).
 */
export default function DeliveryDiagnosis({ deliveryNo, onFixed }: { deliveryNo: string; onFixed?: () => void }) {
  const { t } = useTranslation('pick-support')
  const diagnosis = useQuery(pickSupportDiagnosisQuery(deliveryNo))
  const access = useQuery(omsAccessQuery())
  const canFix = canFixPickSupport(access.data)
  // Advisory (ticket 540): the note only. Each serial cell reads the server's own `serialWithheld`.
  const serialsRestricted = !canSeePickSupportSerial(access.data)
  const [fixing, setFixing] = useState<PickSupportShapeMatch | null>(null)

  let body
  if (diagnosis.isPending)
    body = (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground" role="status" data-ps-loading="">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('panel.loading')}
      </div>
    )
  else if (diagnosis.isError)
    body = <PickSupportFailureBanner error={diagnosis.error} title={t('panel.failedTitle')} fallback={t('panel.failed')} />
  // Callers key this component by the delivery, so the panel's filters start fresh per delivery.
  else body = <DiagnosisPanel diagnosis={diagnosis.data} onApplyFix={canFix ? setFixing : undefined} serialsRestricted={serialsRestricted} />

  return (
    <>
      {body}
      {fixing && <FixDialog deliveryNo={deliveryNo} card={fixing} onClose={() => setFixing(null)} onFixed={onFixed} />}
    </>
  )
}
