import { useId, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, Pencil, RefreshCw, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import {
  HUNGERSTATION_PROMOTION_ERRORS,
  type HungerStationPromotionDetail,
  type HungerStationPromotionItem,
  type HungerStationPromotionPart,
  type HungerStationPromotionSend,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import StatusBadge from '@/core/ui/StatusBadge'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { PROMOTIONS_KEY, promotionKey, promotionsApi } from './api'
import { PromotionStatusBadge, typeText } from './columns'
import { buyGetText, discountText, windowText } from './promotion-display'
import { jobStatusLabel } from './promotion-status'

/**
 * **One HungerStation promotion**, read-only (ticket 665; `GET Promotions/{id}`): its header (name,
 * EN/AR display names, HungerStation reason, limits, window), its **parts** — each with the name
 * sent to HungerStation and its latest job status — its stores (vendor id as sent), its items
 * (material, SKU, subtype, value, max quantity, part) and every send (when, who, reason, HTTP
 * status, job status). Opened from `?promotion=<id>`. The frame is the house side sheet.
 */
export default function PromotionSheet({ promotionId, onClose, onEdit }: { promotionId: string; onClose: () => void; onEdit: () => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  const titleId = useId()
  const detail = useQuery({ queryKey: promotionKey(promotionId), queryFn: () => promotionsApi.detail(promotionId), retry: false })
  const p = detail.data
  const refresh = useRefresh(promotionId)

  return (
    <SideSheet onClose={onClose} width="w-[72rem]" aria-labelledby={titleId} data-promotion-sheet={promotionId}>
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t('detail.eyebrow')}</span>
          <h2 id={titleId} className="text-sm font-semibold tracking-tight" data-promotion-title="">
            {p ? <bdi>{p.name}</bdi> : <Ltr>{promotionId}</Ltr>}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {p && <PromotionStatusBadge t={t} status={p.status} />}
          {/* 666: a draft opens in the editor; a sent one asks HungerStation now. */}
          {p?.status === 'draft' && (
            <Button variant="outlined" onClick={onEdit} data-promotion-edit="">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('detail.edit')}
            </Button>
          )}
          {p && p.status !== 'draft' && (
            <Button variant="outlined" disabled={refresh.isPending} onClick={() => refresh.mutate()} data-promotion-refresh="">
              <RefreshCw className={'h-3.5 w-3.5' + (refresh.isPending ? ' animate-spin' : '')} aria-hidden />
              {t('detail.refresh')}
            </Button>
          )}
          <IconButton label={t('detail.close')} onClick={onClose} data-promotion-close="">
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {refresh.isError && (
          <div data-promotion-refresh-error={apiErrorCode(refresh.error) ?? ''}>
            <ErrorBanner className="p-2.5" title={t('detail.refreshFailed')} message={apiErrorMessage(refresh.error, t('results.failed'))}>
              {apiErrorCode(refresh.error) && (
                <span className="font-mono text-xs">
                  <Ltr>{apiErrorCode(refresh.error)}</Ltr>
                </span>
              )}
            </ErrorBanner>
          </div>
        )}
        {detail.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-promotion-loading="">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('detail.loading')}
          </p>
        ) : detail.isError ? (
          <div data-promotion-error={apiErrorCode(detail.error) ?? ''}>
            <ErrorBanner
              className="p-3"
              title={t('detail.failed')}
              message={
                apiErrorCode(detail.error) === HUNGERSTATION_PROMOTION_ERRORS.noSuchPromotion
                  ? t('detail.notFound')
                  : apiErrorMessage(detail.error, t('results.failed'))
              }
            >
              {apiErrorCode(detail.error) && (
                <span className="font-mono text-xs">
                  <Ltr>{apiErrorCode(detail.error)}</Ltr>
                </span>
              )}
            </ErrorBanner>
          </div>
        ) : (
          <>
            <Header p={detail.data} />
            <Parts parts={detail.data.parts ?? []} />
            <Stores p={detail.data} />
            <Items items={detail.data.items ?? []} parts={detail.data.parts ?? []} />
            <Sends sends={detail.data.sends ?? []} parts={detail.data.parts ?? []} />
          </>
        )}
      </div>
    </SideSheet>
  )
}

/** 666: Refresh — asks HungerStation for each part's job now; its answer IS the detail. */
function useRefresh(promotionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => promotionsApi.refresh(promotionId),
    onSuccess: (answer) => {
      qc.setQueryData(promotionKey(promotionId), answer)
      void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY, predicate: (q) => q.queryKey[2] !== 'detail' })
    },
  })
}

const code = (v: string | null) =>
  v ? (
    <span className="font-mono text-[12.5px]">
      <Ltr>{v}</Ltr>
    </span>
  ) : null

const yesNo = (t: (k: string) => string, on: boolean) => <StatusBadge sev={on ? 'ok' : 'mute'}>{t(on ? 'detail.yes' : 'detail.no')}</StatusBadge>

/** "<at> by <who>", the time and the user each isolated through a slot. Blank when never. */
function ByAt({ at, by }: { at: string | null; by: string | null }) {
  const { t } = useTranslation('hungerstation-promotions')
  if (!at) return null
  return <Trans t={t} i18nKey="detail.byAt" values={{ at: formatDateTime(at), by: by ?? '' }} components={{ at: <Ltr />, by: <Ltr /> }} />
}

/** The promotion's header, label beside value. */
function Header({ p }: { p: HungerStationPromotionDetail }) {
  const { t } = useTranslation('hungerstation-promotions')
  const field = (label: string, value: ReactNode, data: string, wide = false) => (
    <div className={'flex flex-col gap-0.5' + (wide ? ' col-span-2' : '')} data-promotion-field={data}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
  const limit = (n: number | null) => (n === null ? t('detail.noLimit') : <Ltr>{figure(n)}</Ltr>)
  const hsReason = ['COMPETITIVENESS', 'OVERSTOCK', 'DELISTING', 'EXPIRING_SOON', 'NMR', 'TRADING'].includes(p.hsReason)
    ? t(`hsReasons.${p.hsReason}`)
    : <Ltr>{p.hsReason}</Ltr>
  const subtype = ['PERCENTAGE', 'ABSOLUTE', 'FINAL_PRICE'].includes(p.defaultSubtype) ? t(`subtypes.${p.defaultSubtype}`) : p.defaultSubtype
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 p-3 md:grid-cols-4" data-promotion-header="">
      {field(t('detail.chain'), code(p.chainKey), 'chain')}
      {field(t('detail.type'), typeText(t, p.type), 'type')}
      {field(t('detail.status'), <PromotionStatusBadge t={t} status={p.status} />, 'status')}
      {field(t('detail.hsReason'), hsReason, 'hsReason')}
      {field(t('detail.displayNameEn'), <bdi>{p.displayNameEn}</bdi>, 'displayNameEn', true)}
      {field(t('detail.displayNameAr'), <bdi>{p.displayNameAr}</bdi>, 'displayNameAr', true)}
      {field(t('detail.window'), <Ltr>{windowText(p.startAt, p.endAt)}</Ltr>, 'window', true)}
      {field(t('detail.orderLimit'), limit(p.orderLimit), 'orderLimit')}
      {field(t('detail.globalLimit'), limit(p.globalLimit), 'globalLimit')}
      {field(
        t('detail.defaultDiscount'),
        <span className="flex flex-wrap items-center gap-1.5">
          {subtype}
          {p.defaultValue !== null && <Ltr>{discountText(p.defaultSubtype, p.defaultValue)}</Ltr>}
        </span>,
        'defaultDiscount',
      )}
      {field(t('detail.stores'), p.allStores ? t('detail.allStores') : <Ltr>{figure(p.stores?.length ?? 0)}</Ltr>, 'storesScope')}
      {p.replacesId && field(t('detail.replaces'), code(p.replacesId), 'replaces')}
      {p.replacedById && field(t('detail.replacedBy'), code(p.replacedById), 'replacedBy')}
      {field(t('detail.created'), <ByAt at={p.createdAt} by={p.createdBy} />, 'created')}
      {field(t('detail.updated'), <ByAt at={p.updatedAt} by={p.updatedBy} />, 'updated')}
      {field(t('detail.sent'), <ByAt at={p.sentAt} by={p.sentBy} />, 'sent')}
      {p.switchedOffAt &&
        field(
          t('detail.switchedOff'),
          <span className="flex flex-col">
            <ByAt at={p.switchedOffAt} by={p.switchedOffBy} />
            {p.switchedOffReason && <bdi>{p.switchedOffReason}</bdi>}
          </span>,
          'switchedOff',
          true,
        )}
    </dl>
  )
}

/** A job status's badge: its words, `Unanswered` past 24 hours queued, or the value as sent. */
function JobBadge({ status, unanswered }: { status: string | null; unanswered: boolean }) {
  const { t } = useTranslation('hungerstation-promotions')
  const label = jobStatusLabel(status, unanswered)
  return <StatusBadge sev={label.sev}>{label.key ? t(label.key) : <Ltr>{label.raw}</Ltr>}</StatusBadge>
}

function Section({ title, data, hint, children }: { title: string; data: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" {...{ [data]: '' }}>
      <h3 className="text-xs font-semibold tracking-tight">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

function Parts({ parts }: { parts: HungerStationPromotionPart[] }) {
  const { t } = useTranslation('hungerstation-promotions')
  return (
    <Section title={t('detail.parts')} hint={t('detail.partsHint')} data="data-promotion-parts">
      {parts.length === 0 ? (
        <Empty>{t('detail.noParts')}</Empty>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.partColumns.name')}</th>
              <th className={TH}>{t('detail.partColumns.combination')}</th>
              <th className={TH}>{t('detail.partColumns.discount')}</th>
              <th className={TH + ' text-end'}>{t('detail.partColumns.skus')}</th>
              <th className={TH}>{t('detail.partColumns.jobStatus')}</th>
              <th className={TH}>{t('detail.partColumns.active')}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => {
              const buyGet = buyGetText(part)
              return (
                <tr key={part.partId} className="border-b border-border/40" data-promotion-part={part.partId} data-promotion-part-job={part.latestJobStatus ?? 'none'}>
                  <td className="px-2 py-1.5 align-top" data-promotion-part-name="">
                    <bdi>{part.name}</bdi>
                  </td>
                  <td className={TD} data-promotion-part-combination="">
                    {buyGet ? <Ltr>{buyGet}</Ltr> : t('detail.allItems')}
                  </td>
                  <td className={TD} data-promotion-part-discount="">
                    {part.subtype && (
                      <span className="flex items-center gap-1.5">
                        {t(`subtypes.${part.subtype}`)}
                        <Ltr>{discountText(part.subtype, part.value)}</Ltr>
                      </span>
                    )}
                  </td>
                  <td className={TD + ' text-end tabular-nums'} data-promotion-part-skus="">
                    <Ltr>{figure(part.skuCount)}</Ltr>
                  </td>
                  <td className={TD} data-promotion-part-status="">
                    <JobBadge status={part.latestJobStatus} unanswered={part.unanswered} />
                  </td>
                  <td className={TD} data-promotion-part-active={String(part.active)}>
                    {yesNo(t, part.active)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Section>
  )
}

function Stores({ p }: { p: HungerStationPromotionDetail }) {
  const { t } = useTranslation('hungerstation-promotions')
  const stores = p.stores ?? []
  return (
    <Section title={t('detail.stores')} data="data-promotion-stores">
      {stores.length === 0 ? (
        <Empty>{p.allStores ? t('detail.allStores') : t('detail.noStores')}</Empty>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.storeColumns.storeCode')}</th>
              <th className={TH}>{t('detail.storeColumns.storeName')}</th>
              <th className={TH}>{t('detail.storeColumns.vendorId')}</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.storeCode} className="border-b border-border/40" data-promotion-store={s.storeCode}>
                <td className={TD + ' font-mono'}>
                  <Ltr>{s.storeCode}</Ltr>
                </td>
                <td className="px-2 py-1.5 align-top">{s.storeName ? <bdi>{s.storeName}</bdi> : null}</td>
                <td className={TD + ' font-mono'} data-promotion-store-vendor="">
                  <Ltr>{s.vendorId}</Ltr>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

/** The part an item or a send belongs to, by the name it was sent under. */
const partNames = (parts: HungerStationPromotionPart[]) => new Map(parts.map((p) => [p.partId, p.name]))

function Items({ items, parts }: { items: HungerStationPromotionItem[]; parts: HungerStationPromotionPart[] }) {
  const { t } = useTranslation('hungerstation-promotions')
  const names = partNames(parts)
  const num = (n: number | null) => (n === null ? null : <Ltr>{figure(n)}</Ltr>)
  return (
    <Section title={t('detail.items')} data="data-promotion-items">
      {items.length === 0 ? (
        <Empty>{t('detail.noItems')}</Empty>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.itemColumns.material')}</th>
              <th className={TH}>{t('detail.itemColumns.sku')}</th>
              <th className={TH}>{t('detail.itemColumns.subtype')}</th>
              <th className={TH + ' text-end'}>{t('detail.itemColumns.value')}</th>
              <th className={TH + ' text-end'}>{t('detail.itemColumns.maxQuantity')}</th>
              <th className={TH + ' text-end'}>{t('detail.itemColumns.buy')}</th>
              <th className={TH + ' text-end'}>{t('detail.itemColumns.get')}</th>
              <th className={TH}>{t('detail.itemColumns.part')}</th>
              <th className={TH}>{t('detail.itemColumns.state')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.itemId}
                className={'border-b border-border/40' + (item.active ? '' : ' text-muted-foreground')}
                data-promotion-item={item.materialNumber}
                data-promotion-item-active={String(item.active)}
              >
                <td className={TD + ' font-mono'}>
                  <Ltr>{item.materialNumber}</Ltr>
                </td>
                <td className={TD + ' font-mono'} data-promotion-item-sku="">
                  {item.sku ? <Ltr>{item.sku}</Ltr> : null}
                </td>
                <td className={TD} data-promotion-item-subtype={item.subtype}>
                  {['PERCENTAGE', 'ABSOLUTE', 'FINAL_PRICE'].includes(item.subtype) ? t(`subtypes.${item.subtype}`) : <Ltr>{item.subtype}</Ltr>}
                </td>
                <td className={TD + ' text-end tabular-nums'} data-promotion-item-value="">
                  <Ltr>{discountText(item.subtype, item.value)}</Ltr>
                </td>
                <td className={TD + ' text-end tabular-nums'} data-promotion-item-max="">
                  {num(item.maxQuantity)}
                </td>
                <td className={TD + ' text-end tabular-nums'}>{num(item.buyQuantity)}</td>
                <td className={TD + ' text-end tabular-nums'}>{num(item.getQuantity)}</td>
                <td className="px-2 py-1.5 align-top" data-promotion-item-part={item.partId ?? ''}>
                  {item.partId ? <bdi>{names.get(item.partId) ?? item.partId}</bdi> : null}
                </td>
                <td className={TD}>
                  <StatusBadge sev={item.active ? 'ok' : 'mute'}>{t(item.active ? 'detail.active' : 'detail.removed')}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

function Sends({ sends, parts }: { sends: HungerStationPromotionSend[]; parts: HungerStationPromotionPart[] }) {
  const { t } = useTranslation('hungerstation-promotions')
  const names = partNames(parts)
  // Newest first, whatever order arrives: local wall-clock text sorts as time does.
  const ordered = [...sends].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  return (
    <Section title={t('detail.sends')} data="data-promotion-sends">
      {ordered.length === 0 ? (
        <Empty>{t('detail.noSends')}</Empty>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              <th className={TH}>{t('detail.sendColumns.sentAt')}</th>
              <th className={TH}>{t('detail.sendColumns.sentBy')}</th>
              <th className={TH}>{t('detail.sendColumns.reason')}</th>
              <th className={TH}>{t('detail.sendColumns.kind')}</th>
              <th className={TH}>{t('detail.sendColumns.part')}</th>
              <th className={TH + ' text-end'}>{t('detail.sendColumns.httpStatus')}</th>
              <th className={TH}>{t('detail.sendColumns.jobId')}</th>
              <th className={TH}>{t('detail.sendColumns.jobStatus')}</th>
              <th className={TH}>{t('detail.sendColumns.error')}</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((s) => (
              <tr key={s.sendId} className="border-b border-border/40" data-promotion-send={s.sendId}>
                <td className={TD} data-promotion-send-at="">
                  <Ltr>{formatDateTime(s.sentAt)}</Ltr>
                </td>
                <td className={TD + ' font-mono'} data-promotion-send-by="">
                  <Ltr>{s.sentBy}</Ltr>
                </td>
                <td className="px-2 py-1.5 align-top" data-promotion-send-reason="">
                  <bdi>{s.reason}</bdi>
                </td>
                <td className={TD} data-promotion-send-kind={s.kind}>
                  {s.kind === 'upsert' || s.kind === 'switchOff' ? t(`sendKinds.${s.kind}`) : <Ltr>{s.kind}</Ltr>}
                </td>
                <td className="px-2 py-1.5 align-top">
                  <bdi>{names.get(s.partId) ?? s.partId}</bdi>
                </td>
                <td className={TD + ' text-end tabular-nums'} data-promotion-send-http="">
                  {s.httpStatus !== null ? <Ltr>{String(s.httpStatus)}</Ltr> : null}
                </td>
                <td className={TD + ' font-mono'} data-promotion-send-job="">
                  {s.jobId ? <Ltr>{s.jobId}</Ltr> : null}
                </td>
                <td className={TD} data-promotion-send-status={s.jobStatus ?? 'none'}>
                  <JobBadge status={s.jobStatus} unanswered={s.unanswered} />
                </td>
                <td className="px-2 py-1.5 align-top text-danger-800">{s.error ? <bdi>{s.error}</bdi> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

