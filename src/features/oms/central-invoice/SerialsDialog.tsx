import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import type { CentralInvoiceListRow } from '@/core/models/central-invoice'

/**
 * One central invoice's consumed packs (ticket 333) — the row detail regulatory reports
 * from. The serials come from the picking documents the invoice consumed, never the
 * invoice, which carries none (ADR 0048). An empty list is said, not left blank: a GS1 row
 * with a consumed document and no serialised unit is itself a fact regulatory needs.
 */
export default function SerialsDialog({ row, onClose }: { row: CentralInvoiceListRow | null; onClose: () => void }) {
  const { t } = useTranslation('central-invoice')
  const th = 'py-1.5 pe-3 text-start font-medium'
  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      width="52rem"
      title={row ? t('list.serials.title', { deliveryNo: row.deliveryNo }) : ''}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {t('list.serials.close')}
        </Button>
      }
    >
      {row && (
        <div className="flex flex-col gap-3" data-central-invoice-serial-detail>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t('list.columns.invoiceNo')}</dt>
            <dd className="font-mono">{row.trxNumber}</dd>
            <dt className="text-muted-foreground">{t('list.columns.store')}</dt>
            <dd>{row.storeCode}</dd>
            <dt className="text-muted-foreground">{t('list.columns.country')}</dt>
            <dd>{row.country}</dd>
          </dl>
          {row.serials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('list.serials.none')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className={th}>{t('list.serials.columns.pickDocument')}</th>
                    <th className={th}>{t('list.serials.columns.gtin')}</th>
                    <th className={th}>{t('list.serials.columns.serial')}</th>
                    <th className={th}>{t('list.serials.columns.batch')}</th>
                    <th className={th}>{t('list.serials.columns.expiry')}</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[12px]">
                  {row.serials.map((s, i) => (
                    <tr key={`${s.pickDocumentNo}-${s.serialNumber}-${i}`} className="border-b border-border/30">
                      <td className="py-1 pe-3">{s.pickDocumentNo}</td>
                      <td className="py-1 pe-3">{s.gtin}</td>
                      <td className="py-1 pe-3">{s.serialNumber}</td>
                      <td className="py-1 pe-3">{s.batchLot}</td>
                      <td className="py-1 pe-3">{s.expiryDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
