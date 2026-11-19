import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Barcode from './Barcode'

/**
 * Submitted (spec 4032 story 22): the order number as a large barcode, for the cashier to scan off the phone with
 * "Find in Orders" at any till of the pharmacy, and in digits beneath it. The number is the server's, as minted.
 */
export default function SubmittedScreen({ documentNo, onNewBasket }: { documentNo: string; onNewBasket: () => void }) {
  const { t } = useTranslation('minipos')
  return (
    <div className="flex flex-col items-stretch gap-4">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-success">
        <CheckCircle2 className="size-5" aria-hidden />
        {t('submitted.title')}
      </h1>
      <Barcode value={documentNo} label={t('submitted.barcode')} />
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm text-muted-foreground">{t('submitted.orderNo')}</span>
        <span data-order-no={documentNo} className="font-mono text-3xl font-bold tracking-widest">
          <Ltr>{documentNo}</Ltr>
        </span>
      </div>
      <p className="text-center text-sm text-muted-foreground">{t('submitted.hint')}</p>
      <Button className="h-12 w-full text-base justify-center" onClick={onNewBasket}>
        {t('submitted.newBasket')}
      </Button>
    </div>
  )
}
