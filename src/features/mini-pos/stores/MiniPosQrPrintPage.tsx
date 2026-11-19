import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Loader2, Printer, ShieldAlert } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canManageMiniPos } from '@/core/mini-pos/access'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { usePermissions } from '@/core/permissions'
import { miniPosStoresApi } from './api'
import { QrSheet } from './StoreViews'

const NS = 'mini-pos-stores'

/**
 * A pharmacy's printed Mini POS QR (oms 927, BackOffice 4074) — `/mini-pos/print/:storeCode`, outside the shell so the
 * paper is the code alone (the route keeps the session guard through `chromeless`). The QR is drawn here from the signed
 * code `GET MiniPosAdmin/Stores/{store}/PrintedCode` answers; no image service sees it.
 *
 * Behind `canManageMiniPos` (`MiniPosAdmin:06`): a print unlocks the pharmacy, so the door is a manage door. The gate is
 * `ScreenGate`'s rule (pending checks, anything but a grant denies) without its page header, which would print.
 */
export default function MiniPosQrPrintPage() {
  const { t } = useTranslation(NS)
  const permissions = usePermissions()
  if (!permissions.settled)
    return (
      <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('printAccess.checking')}
      </p>
    )
  if (!canManageMiniPos(permissions))
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert">
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold">
          {permissions.failed ? t('printAccess.unreachableTitle') : t('printAccess.deniedTitle')}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {permissions.failed ? t('printAccess.unreachableHint') : t('printAccess.deniedHint')}
        </p>
      </div>
    )
  return <Sheet />
}

function Sheet() {
  const { t } = useTranslation(NS)
  const { storeCode = '' } = useParams()
  const read = useQuery({
    queryKey: ['mini-pos', 'stores', 'printed-code', storeCode],
    queryFn: () => miniPosStoresApi.printedCode(storeCode),
    enabled: !!storeCode,
    retry: false,
    // A print is a moment: no refetch while the print dialog is open.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  if (read.isPending)
    return (
      <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('print.loading')}
      </p>
    )
  if (read.isError)
    return <ErrorBanner center className="m-6 p-3" title={t('print.failedTitle')} message={apiErrorMessage(read.error, t('failed'))} />

  return (
    <div className="flex flex-col items-center gap-2">
      <QrSheet storeCode={read.data.storeCode} version={read.data.version} code={read.data.code} />
      <Button variant="primary" className="print:hidden" onClick={() => window.print()} data-minipos-print-now="">
        <Printer className="h-3.5 w-3.5" aria-hidden />
        {t('print.now')}
      </Button>
    </div>
  )
}
