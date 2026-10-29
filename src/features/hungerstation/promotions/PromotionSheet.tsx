import { useEffect, useId, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, Pencil, Power, RefreshCw, Replace, Trash2, X } from 'lucide-react'
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
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { PROMOTIONS_KEY, promotionKey, promotionsApi } from './api'
import PartRefusals from './PartRefusals'
import { latestSend, partSending, partUnanswered, promotionPollInterval, sendUnanswered } from './part-refusals'
import { parseCombination } from './part-label'
import RemoveItemsDialog from './RemoveItemsDialog'
import ReplaceDialog from './ReplaceDialog'
import { promotionActions } from './replace-form'
import ResendDialog, { type ResendTarget } from './ResendDialog'
import SwitchOffDialog from './SwitchOffDialog'
import { PromotionStatusBadge } from './columns'
import { buyGetText, discountText, windowText } from './promotion-display'
import { jobStatusLabel } from './promotion-status'
import { editMode, lifecycleClosed, type EditMode } from './promotion-edit'
import { hsReasonText, isHsReason, isSubtype, subtypeText, typeText } from './promotion-words'

/**
 * **One HungerStation promotion**, read-only (ticket 665; `GET Promotions/{id}`): its header (name,
 * EN/AR display names, HungerStation reason, limits, window), its **parts** — each with the name
 * sent to HungerStation, its own status and its latest job — its stores (vendor id as sent), its
 * items (material, SKU, subtype, value, max quantity, part) and every send (when, who, reason, HTTP
 * status, job status). Opened from `?promotion=<id>`. The frame is the house side sheet.
 *
 * 670: a sent promotion still running offers **Edit** (in place, in the editor) and **Remove items**:
 * tick active items, give a reason, and they go out `active: false` in their parts; they then read
 * Removed and stay listed. Both wait while it reads Sending.
 * 671: a sent promotion that still runs offers **Replace** (a new name, stores, start or end) and
 * **Switch off** (the whole promotion), both disabled while it reads Sending. A switch-off that did
 * not take (it reads Failed once switched off or replaced) offers **Switch off again** — it retries
 * the parts still on HungerStation. The promotion it replaced and the one that replaced it are links
 * (`onOpen`).
 */
export default function PromotionSheet({
  promotionId,
  onClose,
  onEdit,
  onOpen,
  startReplace = false,
  onReplaceStarted,
}: {
  promotionId: string
  onClose: () => void
  onEdit: () => void
  /** Open another promotion in this sheet (the replace links). */
  onOpen: (promotionId: string) => void
  /** Open with the Replace dialog up (the editor's "Changing this replaces the promotion" hook). */
  startReplace?: boolean
  /** Review B7: the Replace dialog came up from `startReplace` — the page forgets the request, so a
   *  cancelled Replace never comes back (after a link out and back, or a reopen). */
  onReplaceStarted?: () => void
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const titleId = useId()
  // 🔑 The light poll (ticket 669): while it — or any part — reads Sending, the open detail
  // re-reads itself every 15 s (the server polls HungerStation every minute), and stops once it
  // reads anything else. It lives only as long as this sheet is open.
  const detail = useQuery({
    queryKey: promotionKey(promotionId),
    queryFn: () => promotionsApi.detail(promotionId),
    retry: false,
    refetchInterval: (query) => promotionPollInterval(query.state.data),
  })
  const p = detail.data
  const refresh = useRefresh(promotionId)
  const [resend, setResend] = useState<ResendTarget | null>(null)
  const mode = p ? editMode(p) : null
  const [dialog, setDialog] = useState<'replace' | 'switchOff' | null>(null)
  // 671: `startReplace` — opened from the editor's Replace hook (670), the dialog comes up at once.
  // From an effect, not the initial state: the sheet's own modal opens in its (child) effect first,
  // so the Replace modal lands ABOVE it in the top layer instead of under it.
  useEffect(() => {
    if (!startReplace) return
    setDialog('replace')
    onReplaceStarted?.()
  }, [startReplace, onReplaceStarted])
  const actions = p ? promotionActions(p) : null
  const waitTitle = actions?.sending ? t('detail.actionsWhileSending') : undefined
  const retryOff = !!p && lifecycleClosed(p)

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
          {/* 666: a draft opens in the editor; a sent one asks HungerStation now. 670: a sent one still
              running is edited in place, never while it reads Sending. */}
          {(mode === 'draft' || mode === 'inPlace' || mode === 'sending') && (
            <Button
              variant="outlined"
              disabled={mode === 'sending'}
              title={mode === 'sending' ? t('detail.editWhileSending') : undefined}
              onClick={onEdit}
              data-promotion-edit={mode}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t(mode === 'draft' ? 'detail.edit' : 'detail.editLive')}
            </Button>
          )}
          {p && p.status !== 'draft' && (
            <Button variant="outlined" disabled={refresh.isPending} onClick={() => refresh.mutate()} data-promotion-refresh="">
              <RefreshCw className={'h-3.5 w-3.5' + (refresh.isPending ? ' animate-spin' : '')} aria-hidden />
              {t('detail.refresh')}
            </Button>
          )}
          {/* 671: what HungerStation keys a promotion by changes only through Replace. */}
          {actions?.replace && (
            <Button variant="outlined" disabled={actions.sending} title={waitTitle} onClick={() => setDialog('replace')} data-promotion-replace="">
              <Replace className="h-3.5 w-3.5" aria-hidden />
              {t('detail.replace')}
            </Button>
          )}
          {actions?.switchOff && (
            <Button
              variant="danger-outlined"
              disabled={actions.sending}
              title={waitTitle}
              onClick={() => setDialog('switchOff')}
              data-promotion-switch-off={retryOff ? 'retry' : 'whole'}
            >
              <Power className="h-3.5 w-3.5" aria-hidden />
              {t(retryOff ? 'detail.switchOffAgain' : 'detail.switchOff')}
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
            <Header p={detail.data} onOpen={onOpen} />
            {promotionPollInterval(detail.data) !== false && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground" data-promotion-polling="">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('detail.polling')}
              </p>
            )}
            <Parts p={detail.data} onResend={(part) => setResend({ promotionId: detail.data.promotionId, partId: part.partId, name: part.name })} />
            <PartRefusals parts={detail.data.parts ?? []} />
            <Stores p={detail.data} />
            <Items p={detail.data} mode={mode} />
            <Sends p={detail.data} />
          </>
        )}
      </div>
      {resend && <ResendDialog target={resend} onClose={() => setResend(null)} />}
      {p && dialog === 'replace' && <ReplaceDialog promotion={p} onClose={() => setDialog(null)} onReplaced={onOpen} />}
      {p && dialog === 'switchOff' && <SwitchOffDialog promotion={p} retry={retryOff} onClose={() => setDialog(null)} />}
    </SideSheet>
  )
}

/** 666: Refresh — asks HungerStation for each open job now; its answer IS the detail. */
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

/** A subtype in words: its own, or — one the contract does not name — as sent, isolated. */
function Subtype({ value }: { value: string | null }) {
  const { t } = useTranslation('hungerstation-promotions')
  return isSubtype(value) || value === null ? <>{subtypeText(t, value)}</> : <Ltr>{value}</Ltr>
}

/** The promotion's header, label beside value. */
function Header({ p, onOpen }: { p: HungerStationPromotionDetail; onOpen: (promotionId: string) => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  const field = (label: string, value: ReactNode, data: string, wide = false) => (
    <div className={'flex flex-col gap-0.5' + (wide ? ' col-span-2' : '')} data-promotion-field={data}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
  const limit = (n: number | null) => (n === null ? t('detail.noLimit') : <Ltr>{figure(n)}</Ltr>)
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 p-3 md:grid-cols-4" data-promotion-header="">
      {field(t('detail.chain'), code(p.chainKey), 'chain')}
      {field(t('detail.type'), typeText(t, p.type), 'type')}
      {field(t('detail.status'), <PromotionStatusBadge t={t} status={p.status} />, 'status')}
      {field(t('detail.hsReason'), isHsReason(p.hsReason) ? hsReasonText(t, p.hsReason) : <Ltr>{p.hsReason}</Ltr>, 'hsReason')}
      {field(t('detail.displayNameEn'), <bdi>{p.displayNameEn}</bdi>, 'displayNameEn', true)}
      {field(t('detail.displayNameAr'), <bdi>{p.displayNameAr}</bdi>, 'displayNameAr', true)}
      {field(t('detail.window'), <Ltr>{windowText(p.startAt, p.endAt)}</Ltr>, 'window', true)}
      {field(t('detail.orderLimit'), limit(p.orderLimit), 'orderLimit')}
      {field(t('detail.globalLimit'), limit(p.globalLimit), 'globalLimit')}
      {field(
        t('detail.defaultDiscount'),
        <span className="flex flex-wrap items-center gap-1.5">
          <Subtype value={p.defaultSubtype} />
          {p.defaultValue ? <Ltr>{discountText(t, p.defaultSubtype, p.defaultValue)}</Ltr> : null}
        </span>,
        'defaultDiscount',
      )}
      {field(t('detail.stores'), p.allStores ? t('detail.allStores') : <Ltr>{figure(p.stores?.length ?? 0)}</Ltr>, 'storesScope')}
      {/* 671: the replace chain reads as one story — each end links to the other. */}
      {p.replacesPromotionId && field(t('detail.replaces'), <PromotionLink id={p.replacesPromotionId} onOpen={onOpen} data="data-promotion-replaces-link" />, 'replaces')}
      {p.replacedByPromotionId && field(t('detail.replacedBy'), <PromotionLink id={p.replacedByPromotionId} onOpen={onOpen} data="data-promotion-replaced-by-link" />, 'replacedBy')}
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

/** Another promotion, by its id, opened in this sheet. */
function PromotionLink({ id, onOpen, data }: { id: string; onOpen: (promotionId: string) => void; data: string }) {
  const { t } = useTranslation('hungerstation-promotions')
  return (
    <Button variant="link" className="font-mono" title={t('detail.openLinked')} onClick={() => onOpen(id)} {...{ [data]: id }}>
      <Ltr>{id}</Ltr>
    </Button>
  )
}

/** A job status's badge: its words, `No answer` for the 24-hour job, or the value as sent. */
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

/** A part can be resent (contract 3214) once sent, while active; it waits while that part reads
 *  Sending. Not on an Ended promotion: its window is past, HungerStation would not run it. */
const resendable = (p: HungerStationPromotionDetail, part: HungerStationPromotionPart) => p.status !== 'ended' && part.active && part.status !== null

function Parts({ p, onResend }: { p: HungerStationPromotionDetail; onResend: (part: HungerStationPromotionPart) => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  const parts = p.parts ?? []
  // The detail's part carries no SKU count: its active items, counted.
  const skus = (partId: string) => (p.items ?? []).filter((i) => i.active && i.partId === partId).length
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
              <th className={TH}>{t('detail.partColumns.status')}</th>
              <th className={TH}>{t('detail.partColumns.jobStatus')}</th>
              <th className={TH}>{t('detail.partColumns.active')}</th>
              <th className={TH}>{t('detail.partColumns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => {
              const combo = parseCombination(part.combination)
              const buyGet = buyGetText(combo)
              const job = latestSend(p, part.partId)?.jobStatus ?? null
              const unanswered = partUnanswered(p, part.partId)
              return (
                <tr key={part.partId} className="border-b border-border/40" data-promotion-part={part.partId} data-promotion-part-job={job ?? 'none'} data-promotion-part-state={part.status ?? 'none'}>
                  <td className="px-2 py-1.5 align-top" data-promotion-part-name="">
                    <bdi>{part.name}</bdi>
                  </td>
                  <td className={TD} data-promotion-part-combination="">
                    {buyGet ? <Ltr>{buyGet}</Ltr> : t('detail.allItems')}
                  </td>
                  <td className={TD} data-promotion-part-discount="">
                    {combo.subtype && (
                      <span className="flex items-center gap-1.5">
                        {subtypeText(t, combo.subtype)}
                        <Ltr>{discountText(t, combo.subtype, combo.value)}</Ltr>
                      </span>
                    )}
                  </td>
                  <td className={TD + ' text-end tabular-nums'} data-promotion-part-skus="">
                    <Ltr>{figure(skus(part.partId))}</Ltr>
                  </td>
                  <td className={TD} data-promotion-part-status="">
                    {part.status ? <PromotionStatusBadge t={t} status={part.status} /> : <StatusBadge sev="mute">{t('jobStatuses.none')}</StatusBadge>}
                  </td>
                  <td className={TD} data-promotion-part-latest-job="">
                    <JobBadge status={job} unanswered={unanswered} />
                    {unanswered && (
                      <p className="mt-1 max-w-[16rem] text-[11px] text-muted-foreground" data-promotion-part-unanswered="">
                        {t('detail.unansweredHint')}
                      </p>
                    )}
                  </td>
                  <td className={TD} data-promotion-part-active={String(part.active)}>
                    {yesNo(t, part.active)}
                  </td>
                  <td className={TD}>
                    {resendable(p, part) && (
                      <Button
                        variant="outlined"
                        disabled={partSending(part)}
                        title={partSending(part) ? t('detail.resendWhileSending') : undefined}
                        onClick={() => onResend(part)}
                        data-promotion-part-resend={part.partId}
                      >
                        {t('detail.resend')}
                      </Button>
                    )}
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

function Items({ p, mode }: { p: HungerStationPromotionDetail; mode: EditMode | null }) {
  const { t } = useTranslation('hungerstation-promotions')
  const items: HungerStationPromotionItem[] = p.items ?? []
  const names = partNames(p.parts ?? [])
  const num = (n: number | null) => (n === null ? null : <Ltr>{figure(n)}</Ltr>)
  // 670: items of a sent promotion are ticked and removed; never while it reads Sending.
  const selectable = mode === 'inPlace' || mode === 'sending'
  const locked = mode === 'sending'
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [removing, setRemoving] = useState(false)
  const active = items.filter((i) => i.active).map((i) => i.materialNumber)
  // A material removed meanwhile (or the selection of an older read) is not picked.
  const chosen = active.filter((m) => picked.has(m))
  const toggle = (m: string) => setPicked((prev) => (prev.has(m) ? new Set([...prev].filter((x) => x !== m)) : new Set([...prev, m])))
  const allOn = active.length > 0 && chosen.length === active.length
  // Removing EVERY active row is refused (contract 3215: that is a switch-off).
  const tooMany = chosen.length > 0 && chosen.length === active.length
  return (
    <Section title={t('detail.items')} data="data-promotion-items">
      {selectable && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-promotion-remove-bar="">
          <Button
            variant="outlined"
            disabled={locked || chosen.length === 0 || tooMany}
            title={locked ? t('detail.removeWhileSending') : chosen.length === 0 ? t('detail.removePick') : tooMany ? t('detail.removeAll') : undefined}
            onClick={() => setRemoving(true)}
            data-promotion-remove-items={chosen.length}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {chosen.length > 0 ? t('detail.removeItems', { count: chosen.length, n: fsi(figure(chosen.length)) }) : t('detail.removeNone')}
          </Button>
          <span className="text-xs text-muted-foreground">{tooMany ? t('detail.removeAll') : t('detail.removeHint')}</span>
        </div>
      )}
      {items.length === 0 ? (
        <Empty>{t('detail.noItems')}</Empty>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead className="border-b border-border/60 text-muted-foreground">
            <tr>
              {selectable && (
                <th className={TH}>
                  <input
                    type="checkbox"
                    aria-label={t('detail.removePickAll')}
                    checked={allOn}
                    disabled={locked || active.length === 0}
                    onChange={() => setPicked(allOn ? new Set() : new Set(active))}
                    data-promotion-item-pick-all=""
                  />
                </th>
              )}
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
            {items.map((item) => {
              // A blank subtype / value takes the promotion's default: shown greyed, as the editor does.
              const subtype = item.subtype ?? p.defaultSubtype
              const value = item.value || p.defaultValue || null
              return (
                <tr
                  key={item.rowNo}
                  className={'border-b border-border/40' + (item.active ? '' : ' text-muted-foreground')}
                  data-promotion-item={item.materialNumber}
                  data-promotion-item-active={String(item.active)}
                >
                  {selectable && (
                    <td className={TD} data-promotion-item-pick-cell="">
                      {item.active && (
                        <input
                          type="checkbox"
                          aria-label={t('detail.removePickOne', { material: fsi(item.materialNumber) })}
                          checked={picked.has(item.materialNumber)}
                          disabled={locked}
                          onChange={() => toggle(item.materialNumber)}
                          data-promotion-item-pick={item.materialNumber}
                        />
                      )}
                    </td>
                  )}
                  <td className={TD + ' font-mono'}>
                    <Ltr>{item.materialNumber}</Ltr>
                  </td>
                  <td className={TD + ' font-mono'} data-promotion-item-sku="">
                    {item.sku ? <Ltr>{item.sku}</Ltr> : null}
                  </td>
                  <td className={TD + (item.subtype === null ? ' italic text-muted-foreground' : '')} data-promotion-item-subtype={subtype ?? ''}>
                    <Subtype value={subtype} />
                  </td>
                  <td className={TD + ' text-end tabular-nums' + (item.value === null ? ' italic text-muted-foreground' : '')} data-promotion-item-value="">
                    <Ltr>{discountText(t, subtype, value)}</Ltr>
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
              )
            })}
          </tbody>
        </table>
      )}
      {removing && (
        <RemoveItemsDialog
          promotionId={p.promotionId}
          materialNumbers={chosen}
          onDone={() => {
            setPicked(new Set())
            setRemoving(false)
          }}
          onClose={() => setRemoving(false)}
        />
      )}
    </Section>
  )
}

const SEND_KINDS = ['UPSERT', 'SWITCH_OFF']

function Sends({ p }: { p: HungerStationPromotionDetail }) {
  const { t } = useTranslation('hungerstation-promotions')
  const names = partNames(p.parts ?? [])
  const sends: HungerStationPromotionSend[] = p.sends ?? []
  // Newest first; the contract sends them oldest first. Local wall-clock text sorts as time does.
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
              <th className={TH}>{t('detail.sendColumns.hsCreatedAt')}</th>
              <th className={TH}>{t('detail.sendColumns.hsUpdatedAt')}</th>
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
                  {SEND_KINDS.includes(s.kind) ? t(`sendKinds.${s.kind}`) : <Ltr>{s.kind}</Ltr>}
                </td>
                <td className="px-2 py-1.5 align-top">
                  <bdi>{names.get(s.partId) ?? s.partId}</bdi>
                </td>
                <td className={TD + ' text-end tabular-nums'} data-promotion-send-http="">
                  {/* 0: the call never got an HTTP answer (a transport error). */}
                  {s.httpStatus ? <Ltr>{String(s.httpStatus)}</Ltr> : null}
                </td>
                <td className={TD + ' font-mono'} data-promotion-send-job="">
                  {s.jobId ? <Ltr>{s.jobId}</Ltr> : null}
                </td>
                <td className={TD} data-promotion-send-status={s.jobStatus ?? 'none'}>
                  <JobBadge status={s.jobStatus} unanswered={sendUnanswered(p, s)} />
                </td>
                <td className="px-2 py-1.5 align-top text-danger-800">{s.error ? <bdi>{s.error}</bdi> : null}</td>
                {/* HungerStation's own times, as the server sends them: already local. */}
                <td className={TD} data-promotion-send-hs-created="">
                  {s.hsCreatedAt ? <Ltr>{formatDateTime(s.hsCreatedAt)}</Ltr> : null}
                </td>
                <td className={TD} data-promotion-send-hs-updated="">
                  {s.hsUpdatedAt ? <Ltr>{formatDateTime(s.hsUpdatedAt)}</Ltr> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}
