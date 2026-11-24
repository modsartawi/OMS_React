import { useId, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn, formatMoneyOfUnknownCurrency } from '@/core/money'
import type { ParkedReturnDetail, ParkedReturnGrain, ParkedReturnRow } from '@/core/models/parked-returns'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { usePermissions } from '@/core/permissions'
import { canSettleParkedReturns } from './access'
import { detailKey, parkedReturnsApi } from './api'
import { grainBadges, needsHqReasonLabel, parkReasonLabel, rowBadges } from './labels'
import { canResolveRowless } from './settle'
import { GrainSettleActions, RowlessResolve } from './SettleControls'

/**
 * **One parked return** (BackOffice ticket 4224, spec 4212 stories 4-11; door BackOffice 4218
 * `GET RefundLedgerWeb/ParkedReturns/{transactionId}`): the mirrored header and lines, the customer, the original invoice,
 * why and where it parked, the slip's refund reference, and every ledger grain with its status, deadline, escalation,
 * who settled it and when, and any cash ruling. A return the store never mirrored says so and shows its grains alone.
 * With the settle right (`ParkedReturns:06`, ticket 4225) each grain offers its settle actions and a row-less park offers
 * "Resolve row-less"; without it, no button at all (story 23).
 */
export default function ParkedReturnDrawer({ row, onClose }: { row: ParkedReturnRow; onClose: () => void }) {
  const { t } = useTranslation('parked-returns')
  const titleId = useId()
  const detail = useQuery({
    queryKey: detailKey(row.transactionId),
    queryFn: () => parkedReturnsApi.detail(row.transactionId),
    retry: false,
  })
  const d = detail.data
  const badges = rowBadges(d ?? row)
  const canSettle = canSettleParkedReturns(usePermissions())

  return (
    <SideSheet onClose={onClose} width="w-[64rem]" aria-labelledby={titleId} data-parked-drawer={row.transactionId}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('detail.eyebrow')}
        title={<Ltr>{row.transactionId}</Ltr>}
        hint={
          <span className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <StatusBadge key={b.key} sev={b.sev}>
                {t(b.key)}
              </StatusBadge>
            ))}
          </span>
        }
        closeLabel={t('detail.close')}
        onClose={onClose}
        titleData={{ 'data-parked-title': '' }}
        closeData={{ 'data-parked-close': '' }}
      />
      <div className={SHEET_BODY}>
        {detail.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-parked-loading="">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('detail.loading')}
          </p>
        ) : detail.isError ? (
          <ErrorBanner className="p-3" title={t('detail.failed')} message={apiErrorMessage(detail.error, t('detail.failed'))} />
        ) : (
          <DetailBody d={detail.data} canSettle={canSettle} />
        )}
      </div>
    </SideSheet>
  )
}

function Section({ title, children, data }: { title: string; children: ReactNode; data: string }) {
  return (
    <section className="flex flex-col gap-2" data-parked-section={data}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Fields({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">{children}</dl>
}

function F({ label, children, data }: { label: string; children: ReactNode; data: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-parked-field={data}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

function DetailBody({ d, canSettle }: { d: ParkedReturnDetail; canSettle: boolean }) {
  const { t } = useTranslation('parked-returns')
  const h = d.header
  const currency = h?.currency ?? ''
  const money = (v: number) => (currency ? formatMoneyIn(v, currency) : formatMoneyOfUnknownCurrency(v))

  return (
    <>
      {d.needsHqReasons.length > 0 && (
        <div
          role="note"
          className="rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-[0.8125rem] text-attention-800"
          data-parked-needs-hq=""
        >
          <p className="font-semibold">{t('detail.needsHq')}</p>
          <ul className="mt-1 list-disc ps-5">
            {d.needsHqReasons.map((r) => (
              <li key={r}>{t(needsHqReasonLabel(r))}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title={t('detail.section.return')} data="return">
        {h ? (
          <Fields>
            <F label={t('detail.field.storeTill')} data="store">
              <Ltr>{formatPair(h.storeCode, h.registerId)}</Ltr>
            </F>
            <F label={t('detail.field.cashier')} data="cashier">
              <Ltr>{h.operatorId}</Ltr>
            </F>
            <F label={t('detail.field.parkedAt')} data="parkedAt">
              <Ltr>{formatDateTime(h.parkedAt)}</Ltr>
            </F>
            <F label={t('detail.field.parkReason')} data="parkReason">
              {t(parkReasonLabel(h.parkReason))}
            </F>
            <F label={t('detail.field.originalReceipt')} data="originalReceipt">
              <Ltr>{h.originalReceiptNumber}</Ltr>
            </F>
            <F label={t('detail.field.originalTransaction')} data="originalTransaction">
              <Ltr>{h.originalTransactionId}</Ltr>
            </F>
            <F label={t('detail.field.customer')} data="customer">
              <Ltr>{h.customerId}</Ltr>
            </F>
            <F label={t('detail.field.loyalty')} data="loyalty">
              <Ltr>{h.loyaltyId}</Ltr>
            </F>
            <F label={t('detail.field.mobile')} data="mobile">
              <Ltr>{h.loyaltyMobile}</Ltr>
            </F>
            <F label={t('detail.field.total')} data="total">
              <Ltr>{formatPair(money(h.grandTotal), h.currency)}</Ltr>
            </F>
            <F label={t('detail.field.mirrorStatus')} data="mirrorStatus">
              <Ltr>{h.mirrorStatus}</Ltr>
            </F>
          </Fields>
        ) : (
          <p className="text-sm text-muted-foreground" data-parked-no-header="">
            {t('detail.noHeader')}
          </p>
        )}
      </Section>

      {h && (
        <Section title={t('detail.section.lines')} data="lines">
          {d.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('detail.noLines')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t('detail.line.line')}</th>
                  <th className={TH}>{t('detail.line.material')}</th>
                  <th className={TH}>{t('detail.line.description')}</th>
                  <th className={`${TH} text-end`}>{t('detail.line.quantity')}</th>
                  <th className={`${TH} text-end`}>{t('detail.line.total')}</th>
                  <th className={TH}>{t('detail.line.reason')}</th>
                  <th className={TH}>{t('detail.line.originalLine')}</th>
                </tr>
              </thead>
              <tbody>
                {d.lines.map((l) => (
                  <tr key={l.lineNumber} className={`border-t border-border/60 ${l.isVoided ? 'text-muted-foreground line-through' : ''}`} data-parked-line={l.lineNumber}>
                    <td className={TD}>
                      <Ltr>{l.lineNumber}</Ltr>
                    </td>
                    <td className={TD}>
                      <Ltr>{l.materialNumber}</Ltr>
                    </td>
                    <td className={`${TD} whitespace-normal`}>
                      <bdi>{l.description}</bdi>
                      {l.isVoided && (
                        <span className="ms-2">
                          <StatusBadge sev="mute">{t('detail.line.voided')}</StatusBadge>
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-end tabular-nums`}>
                      <Ltr>{formatPair(formatNumber(l.quantity), l.unitOfMeasure)}</Ltr>
                    </td>
                    <td className={`${TD} text-end tabular-nums`}>
                      <Ltr>{money(l.grandTotal)}</Ltr>
                    </td>
                    <td className={TD}>
                      <Ltr>{l.returnReasonCode}</Ltr>
                    </td>
                    <td className={TD}>{l.originalLineNumber > 0 && <Ltr>{l.originalLineNumber}</Ltr>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {d.tenders.length > 0 && (
        <Section title={t('detail.section.tenders')} data="tenders">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className={TH}>{t('detail.tender.type')}</th>
                <th className={`${TH} text-end`}>{t('detail.tender.amount')}</th>
                <th className={TH}>{t('detail.tender.slipReference')}</th>
                <th className={TH}>{t('detail.tender.parked')}</th>
                <th className={TH}>{t('detail.tender.settlement')}</th>
              </tr>
            </thead>
            <tbody>
              {d.tenders.map((x) => (
                <tr key={x.tenderNumber} className="border-t border-border/60" data-parked-tender={x.tenderNumber}>
                  <td className={TD}>
                    <Ltr>{x.tenderType}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`}>
                    <Ltr>{money(x.amount)}</Ltr>
                  </td>
                  <td className={TD} data-parked-slip-reference="">
                    <Ltr>{x.refundReference}</Ltr>
                  </td>
                  <td className={TD}>{x.isParked ? t('yes') : t('no')}</td>
                  <td className={TD}>
                    <Ltr>{x.settlementState}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title={t('detail.section.grains')} data="grains">
        {d.grains.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">{t('detail.noGrains')}</p>
            {canResolveRowless(d, canSettle) && <RowlessResolve detail={d} />}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {d.grains.map((g) => (
              <Grain key={g.refundId} g={g} money={money} returnState={d.state} canSettle={canSettle} />
            ))}
          </div>
        )}
      </Section>
    </>
  )
}

function Grain({
  g,
  money,
  returnState,
  canSettle,
}: {
  g: ParkedReturnGrain
  money: (v: number) => string
  returnState: string
  canSettle: boolean
}) {
  const { t } = useTranslation('parked-returns')
  return (
    <div className="rounded-lg border border-border/60 p-3" data-parked-grain={g.refundId} data-status={g.status}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          <Ltr>{formatPair(g.partner, money(g.amount))}</Ltr>
        </span>
        {grainBadges(g).map((b) => (
          <StatusBadge key={b.key} sev={b.sev}>
            {t(b.key)}
          </StatusBadge>
        ))}
      </div>
      <Fields>
        <F label={t('detail.grain.tenderType')} data="tenderType">
          <Ltr>{g.tenderType}</Ltr>
        </F>
        <F label={t('detail.grain.originalReference')} data="originalReference">
          <Ltr>{g.originalReference}</Ltr>
        </F>
        <F label={t('detail.grain.partnerReference')} data="partnerReference">
          <Ltr>{g.partnerRefundReference}</Ltr>
        </F>
        <F label={t('detail.grain.statusApi')} data="statusApi">
          {g.hasStatusApi ? t('yes') : t('no')}
        </F>
        <F label={t('detail.grain.added')} data="added">
          <Ltr>{formatDateTime(g.addedTime)}</Ltr>
        </F>
        <F label={t('detail.grain.deadline')} data="deadline">
          <Ltr>{formatDateTime(g.parkDeadline)}</Ltr>
        </F>
        <F label={t('detail.grain.settledBy')} data="settledBy">
          <Ltr>{g.settledBy}</Ltr>
        </F>
        <F label={t('detail.grain.settledAt')} data="settledAt">
          <Ltr>{formatDateTime(g.settledTime)}</Ltr>
        </F>
        <F label={t('detail.grain.grainKey')} data="grainKey">
          <Ltr>{g.grainKey}</Ltr>
        </F>
      </Fields>
      {g.cashRuled && (
        <div className="mt-2 rounded-md bg-muted/50 p-2 text-sm" data-parked-cash-ruling="">
          <p className="text-xs font-semibold text-muted-foreground">{t('detail.grain.cashRuling')}</p>
          <p>
            <span className="text-muted-foreground">{t('detail.grain.cashReason')} </span>
            <bdi>{g.cashReason}</bdi>
          </p>
          <p>
            <span className="text-muted-foreground">{t('detail.grain.partnerEvidence')} </span>
            <bdi>{g.partnerEvidence}</bdi>
          </p>
        </div>
      )}
      <GrainSettleActions grain={g} returnState={returnState} canSettle={canSettle} money={money} />
    </div>
  )
}
