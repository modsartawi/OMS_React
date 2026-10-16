import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { PICK_SUPPORT_KEY_KINDS, type PickSupportResolvedDelivery, type PickSupportSerialHold } from '@/core/models/pick-support'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenPickSupport } from '@/core/oms/access'
import { pickSupportApi, pickSupportKeys } from '@/core/pick-support/api'
import { Code, EnAr, PickSupportFailureBanner, Section, TD, TH, Val } from '@/core/pick-support/bits'
import DeliveryDiagnosis from '@/core/pick-support/DeliveryDiagnosis'
import { holdView, type HoldView } from '@/core/pick-support/diagnosis'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair } from '@/core/util/bidi'
import { openable, resolveView, searchFromParams, searchToParams } from './resolve-view'

/**
 * **Pick support** (ticket 496, BackOffice brief 2691; spec 2685, ADR 0085) — HQ support types any
 * number a store sent and reads what is wrong with the delivery, in the server's words.
 *
 * Behind `canOpenPickSupport` on the ONE shared OMS probe, the predicate the menu leaf reads. The
 * doors stay the boundary: a session without the grant that reaches one gets a bare 403.
 *
 * Tabs: Search (the default; this slice). The Stuck now census is ticket 498's tab.
 */
export default function PickSupportPage() {
  const { t } = useTranslation('pick-support')
  return (
    <ScreenGate query={omsAccessQuery()} can={canOpenPickSupport} ns="pick-support" title={t('title')} subtitle={t('subtitle')}>
      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 border-b border-border/60">
          <button
            type="button"
            role="tab"
            id="pick-support-tab-search"
            aria-selected
            aria-controls="pick-support-panel"
            className="-mb-px border-b-2 border-primary px-3 py-1.5 text-sm font-medium text-foreground"
            data-ps-tab="search"
          >
            {t('tabs.search')}
          </button>
        </div>
        <div role="tabpanel" id="pick-support-panel" aria-labelledby="pick-support-tab-search">
          <SearchTab />
        </div>
      </div>
    </ScreenGate>
  )
}

const INPUT =
  'h-9 w-full max-w-xl rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/**
 * Search: one input, Enter calls Resolve. The key lives in the URL (`?key=`), so a link to a case
 * can be shared and survives a reload; a row opened under a list or a hold is `?delivery=`.
 */
function SearchTab() {
  const { t } = useTranslation('pick-support')
  const { query, update, changedFromOutside } = useUrlQuery(searchFromParams, searchToParams)
  const [draft, setDraft] = useState(query.key)
  const queryClient = useQueryClient()

  // A key arriving from outside (a pasted link, Back) replaces what is typed; an echo of our own
  // write keeps it.
  useEffect(() => {
    if (changedFromOutside()) setDraft(query.key)
  }, [query.key, changedFromOutside])

  const resolve = useQuery({
    queryKey: pickSupportKeys.resolve(query.key),
    queryFn: () => pickSupportApi.resolve(query.key),
    enabled: query.key !== '',
    retry: false,
  })

  function submit() {
    const key = draft.trim()
    if (!key) return
    // The same number again still asks again — the lookup AND the diagnosis drawn under it: the
    // delivery may have changed since.
    if (key === query.key) void queryClient.invalidateQueries({ queryKey: pickSupportKeys.all })
    else update(() => ({ key, delivery: '' }))
  }

  const open = (deliveryNo: string) => update((q) => ({ ...q, delivery: deliveryNo }))
  // A failed re-ask shows its failure alone, never above the previous answer as if it were current.
  const view = resolve.data && !resolve.isError ? resolveView(resolve.data) : null
  // `?delivery=` opens a row only when it is one this key resolved to: a stale or edited link
  // does not draw an unrelated delivery under the list.
  const openedNo = view && openable(view).includes(query.delivery) ? query.delivery : ''

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        data-ps-search=""
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('search.label')}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('search.placeholder')}
            className={INPUT}
            autoFocus
            data-ps-key=""
          />
        </label>
        <Button type="submit" disabled={draft.trim() === '' || resolve.isFetching} data-ps-find="">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('search.submit')}
        </Button>
      </form>

      {query.key !== '' && resolve.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('search.looking')}
        </div>
      )}
      {resolve.isError && <PickSupportFailureBanner error={resolve.error} title={t('search.failedTitle')} fallback={t('search.failed')} />}

      {view?.kind === 'noMatch' && (
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-ps-no-match="">
          <p className="text-sm font-semibold">{t('noMatch.title')}</p>
          <EnAr en={view.messageEn} ar={view.messageAr} name="noMatch" />
        </div>
      )}
      {view?.kind === 'diagnosis' && <DeliveryDiagnosis key={view.deliveryNo} deliveryNo={view.deliveryNo} />}
      {view?.kind === 'holds' && (
        <>
          <HoldsTable holds={view.holds} opened={openedNo} onOpen={open} />
          {view.deliveries.length > 0 && <DeliveryList deliveries={view.deliveries} opened={openedNo} onOpen={open} />}
        </>
      )}
      {view?.kind === 'list' && <DeliveryList deliveries={view.deliveries} opened={openedNo} onOpen={open} />}
      {openedNo !== '' && <DeliveryDiagnosis key={openedNo} deliveryNo={openedNo} />}
    </div>
  )
}

/** A `matchedBy` code as a small chip: the kind of number, in the UI's words; an unlisted kind as its code. */
function KeyKindChip({ kind }: { kind: string }) {
  const { t } = useTranslation('pick-support')
  const known = (PICK_SUPPORT_KEY_KINDS as readonly string[]).includes(kind)
  return (
    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[0.6875rem] font-medium" data-ps-matched-by={kind}>
      {known ? t(`keyKind.${kind}`) : <Ltr>{kind}</Ltr>}
    </span>
  )
}

/** Several deliveries (an order, a serial held twice): each row opens that delivery's diagnosis. */
function DeliveryList({
  deliveries,
  opened,
  onOpen,
}: {
  deliveries: PickSupportResolvedDelivery[]
  opened: string
  onOpen: (deliveryNo: string) => void
}) {
  const { t } = useTranslation('pick-support')
  return (
    <Section name="list" title={t('list.title')}>
      {deliveries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className={TH}>{t('list.delivery')}</th>
                <th className={TH}>{t('list.order')}</th>
                <th className={TH}>{t('list.currentStore')}</th>
                <th className={TH}>{t('list.closeStatus')}</th>
                <th className={TH}>{t('list.matchedBy')}</th>
                <th className={TH}>{t('list.stuck')}</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => {
                const isOpen = d.deliveryNo === opened
                const shapes = d.shapes ?? []
                return (
                  <tr
                    key={d.deliveryNo}
                    className={'border-t border-border/40' + (isOpen ? ' bg-accent' : '')}
                    data-ps-row={d.deliveryNo}
                    data-ps-stuck={shapes.length > 0 ? '' : undefined}
                  >
                    <td className={TD}>
                      <Val value={d.deliveryNo} />
                    </td>
                    <td className={TD}>
                      <Val value={d.orderNo} />
                    </td>
                    <td className={TD}>
                      <Val value={d.currentStore} />
                    </td>
                    <td className={TD}>
                      <Val value={d.closeStatus} />
                    </td>
                    <td className={TD}>
                      <span className="flex flex-wrap gap-1">
                        {(d.matchedBy ?? []).map((k) => (
                          <KeyKindChip key={k} kind={k} />
                        ))}
                      </span>
                    </td>
                    <td className={TD}>
                      {shapes.length > 0 ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <StatusBadge sev="warn">{t('list.stuck')}</StatusBadge>
                          {shapes.map((s) => (
                            <Code key={s}>{s}</Code>
                          ))}
                        </span>
                      ) : (
                        <Val value="" />
                      )}
                    </td>
                    <td className={TD}>
                      {isOpen ? (
                        <span className="text-xs text-muted-foreground">{t('list.opened')}</span>
                      ) : (
                        <Button variant="outlined" onClick={() => onOpen(d.deliveryNo)} data-ps-open={d.deliveryNo}>
                          {t('list.open')}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

const HOLD_SEV: Record<HoldView, Severity> = { neutral: 'mute', stuck: 'warn', escalate: 'bad' }

/**
 * A serial's holds: one row per picking document and GTIN holding a unit, each with the server's
 * explanation (EN beside AR). STUCK links to its delivery's diagnosis; UNKNOWN — or a hold the
 * client does not know — reads as escalate.
 */
function HoldsTable({ holds, opened, onOpen }: { holds: PickSupportSerialHold[]; opened: string; onOpen: (deliveryNo: string) => void }) {
  const { t } = useTranslation('pick-support')
  return (
    <Section name="holds" title={t('holds.title')}>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className={TH}>{t('holds.serial')}</th>
              <th className={TH}>{t('holds.gtin')}</th>
              <th className={TH}>{t('holds.document')}</th>
              <th className={TH}>{t('holds.source')}</th>
              <th className={TH}>{t('holds.store')}</th>
              <th className={TH}>{t('holds.documentState')}</th>
              <th className={TH}>{t('holds.consumedByTrx')}</th>
              <th className={TH}>{t('holds.delivery')}</th>
              <th className={TH}>{t('holds.hold')}</th>
              <th className={TH}>{t('holds.explanation')}</th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h, i) => {
              const view = holdView(h.hold)
              const deliveryNo = (h.deliveryNo ?? '').trim()
              return (
                <tr key={`${h.documentNo}-${h.gtin}-${i}`} className="border-t border-border/40" data-ps-hold={h.hold} data-ps-hold-view={view}>
                  <td className={TD}>
                    <Val value={h.serialNumber} />
                  </td>
                  <td className={TD}>
                    <Val value={h.gtin} />
                  </td>
                  <td className={TD}>
                    <Val value={h.documentNo} />
                  </td>
                  <td className={TD}>
                    {/* `type · key`, one pair isolated once. */}
                    <Val value={formatPair(h.sourceType, h.sourceKey)} />
                  </td>
                  <td className={TD}>
                    <Val value={h.storeCode} />
                  </td>
                  <td className={TD}>
                    <Code>{h.documentState}</Code>
                  </td>
                  <td className={TD}>
                    <Val value={h.consumedByTrx} />
                  </td>
                  <td className={TD}>
                    <span className="flex flex-col items-start gap-1">
                      <Val value={deliveryNo} />
                      {view === 'stuck' && deliveryNo !== '' && deliveryNo !== opened && (
                        <Button variant="outlined" onClick={() => onOpen(deliveryNo)} data-ps-hold-open={deliveryNo}>
                          {t('holds.open')}
                        </Button>
                      )}
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="flex flex-col items-start gap-1">
                      <StatusBadge sev={HOLD_SEV[view]}>
                        <Ltr>{h.hold || t('dash')}</Ltr>
                      </StatusBadge>
                      {view === 'escalate' && <span className="text-xs font-medium text-danger-800">{t('verdict.escalate')}</span>}
                      {(h.shapes ?? []).map((s) => (
                        <Code key={s}>{s}</Code>
                      ))}
                    </span>
                  </td>
                  <td className={`${TD} min-w-80`}>
                    <EnAr en={h.explanationEn} ar={h.explanationAr} name="hold" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
