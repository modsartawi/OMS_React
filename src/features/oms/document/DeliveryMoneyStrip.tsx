import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ApiError, apiErrorMessage } from '@/core/api'
import type { OmsAccessResult } from '@/core/models/oms-access'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { buttonClass } from '@/core/ui/control-classes'
import { documentApi } from './api'
import type { OpenedAs } from './actions'
import { asksDeliveryMoneyStrip, deliveryMoneyStrip, orderRowOf } from './delivery-money-strip'
import { HEADING } from './facts-heading'
import InsuranceCell from './InsuranceCell'

/** The query key of a delivery's order search row (ticket 789), by the order's document number. */
export const orderRowKey = (documentNo: string) => ['document', 'order-row', documentNo] as const

/**
 * **The delivery money strip** (ticket 789, BackOffice spec 3389 user stories 67–70): on Delivery
 * Details, for a delivery of an insurance order, whose money stands, the order's patient and insurer
 * totals and the delivery's own amount due, plus — with the insurance-view grant — a link to the
 * order's Insurance section. Full width above the two columns. Self-contained (it asks its own read)
 * so the page only places it.
 *
 * The money comes from the order's search row (`documentApi.getOrderRows`, door 3391, LIST grant) —
 * see `delivery-money-strip.ts` for why, and its gap. A 403 there draws nothing (the session lacks
 * the list grant after all); any other failure is said in place. Read-only.
 */
export default function DeliveryMoneyStrip({
  openedAs,
  document,
  access,
}: {
  openedAs: OpenedAs
  document: Pick<SdDocumentHeaderModel, 'refDocumentNo' | 'amountDue'>
  access: Partial<OmsAccessResult> | null | undefined
}) {
  const { t } = useTranslation('document')
  const refDocumentNo = (document.refDocumentNo ?? '').trim()
  const asked = asksDeliveryMoneyStrip({ openedAs, refDocumentNo, access })
  const rows = useQuery({
    queryKey: orderRowKey(refDocumentNo),
    queryFn: () => documentApi.getOrderRows(refDocumentNo),
    enabled: asked,
    retry: false,
  })
  if (!asked) return null
  if (rows.isError) {
    if (rows.error instanceof ApiError && rows.error.statusCode === 403) return null
    return <ErrorBanner message={apiErrorMessage(rows.error, t('moneyStrip.loadFailed'))} className="px-3 py-2" />
  }

  const strip = deliveryMoneyStrip(orderRowOf(rows.data, refDocumentNo), { refDocumentNo, amountDue: document.amountDue }, access)
  if (!strip) return null

  const figures = [
    ['patient', strip.patient],
    ['insurer', strip.insurer],
    ['amountDue', strip.amountDue],
  ] as const

  return (
    <section
      aria-labelledby="doc-money-strip-heading"
      className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-3 py-2 text-[0.8125rem]"
      data-delivery-money-strip=""
    >
      <h3 id="doc-money-strip-heading" className={`${HEADING} text-muted-foreground`}>
        {t('moneyStrip.heading')}
      </h3>
      <span data-money-source={strip.source.code}>
        <StatusBadge sev={strip.source.sev}>
          {strip.source.code === 'unknown' ? <Ltr>{strip.sourceCode}</Ltr> : t(strip.source.labelKey)}
        </StatusBadge>
      </span>
      <dl className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1">
        {figures.map(([figure, cell]) => (
          <div key={figure} className="flex items-baseline gap-1.5" data-strip-figure={figure}>
            <dt className="text-muted-foreground">{t(`moneyStrip.figures.${figure}`)}</dt>
            <dd className={figure === 'amountDue' ? 'font-semibold' : undefined}>
              <InsuranceCell cell={cell} />
            </dd>
          </div>
        ))}
      </dl>
      {strip.link && (
        <Link to={strip.link} className={buttonClass('link', 'ms-auto')} data-strip-link="">
          {t('moneyStrip.link')}
        </Link>
      )}
    </section>
  )
}
