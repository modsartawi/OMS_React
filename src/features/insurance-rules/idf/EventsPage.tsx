import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatDateTime } from '@/core/util/date-format'
import { fsi } from '@/core/util/bidi'
import { formatFigure, formatMoney3 } from '@/core/util/number-format'
import { eventsQuery, mastersQuery } from './api'
import { decisionWordKey, formatDurationMs, IDF_EVENT_FILTER_OUTCOMES, outcomeWordKey, reasonWordKey, tierOfSource, type IdfEvent } from './events'
import { IDF_EVENTS_TABS, idfEventsFromParams, idfEventsToParams, typedFilter, windowOf, withFilter, type IdfEventsQuery } from './events-filter'
import { versionLabel } from './lookup'
import { masterName } from './masters'
import SwapReport from './SwapReport' // 627

/**
 * Insurance rules ▸ IDF events — `/insurance-rules/idf/events` (BackOffice spec 3157, door 3167; oms ticket 626).
 * A paged log of every IDF moment at the till, filtered by a local window, store, insurer (its customer id, 3167's
 * `payer=`), master (619's list) and outcome (`alternativeTaken` included). Prices are per base unit. The address is the state (`useUrlQuery`); a filter change goes back to page 1. Read-only.
 *
 * 627 adds the swap report as a tab of this page (`?tab=report`), sharing the filter bar (`IdfEventsFilter` in
 * `events-filter.ts`); the outcome filter belongs to the log alone and is hidden on the report.
 *
 * 🚩 UNGATED until 628: a bare 403 on the read is "You do not have access".
 */
export default function EventsPage() {
  const { t } = useTranslation('insurance-idf')
  const { query, update } = useUrlQuery(idfEventsFromParams, idfEventsToParams)
  const problem = windowOf(query)
  const set = (patch: Partial<Omit<IdfEventsQuery, 'page'>>) => update((q) => withFilter(q, patch))

  return (
    <section className="flex w-full flex-col gap-4" data-idf-events-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('events.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('events.lede')}</p>
      </header>

      <FilterBar query={query} set={set} />

      {/* 627 · Swap report tab */}
      <div className="flex gap-1" role="tablist" aria-label={t('report.tabs.label')} data-idf-events-tabs="">
        {IDF_EVENTS_TABS.map((id) => (
          <Chip key={id} variant="tab" on={query.tab === id} data-tab={id} onClick={() => update((q) => ({ ...q, tab: id, page: 1 }))}>
            {t(`report.tabs.${id}`)}
          </Chip>
        ))}
      </div>

      {problem ? (
        <p className="rounded-md border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-window-problem={problem}>
          {t(`events.filter.${problem}`)}
        </p>
      ) : query.tab === 'report' ? (
        <SwapReport filter={query} />
      ) : (
        <EventsLog query={query} onPage={(page) => update((q) => ({ ...q, page }))} />
      )}
    </section>
  )
}

function FilterBar({ query, set }: { query: IdfEventsQuery; set: (patch: Partial<Omit<IdfEventsQuery, 'page'>>) => void }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const masters = useQuery(mastersQuery())
  // Store and payer are typed: they apply on leaving the box, and Enter leaves it — one write path, so Enter never
  // writes twice. Only a real change applies (an untouched box keeps the page). Keyed on the address (at the input)
  // so Back resets them.
  const typed = (field: 'store' | 'payer') => ({
    defaultValue: query[field],
    placeholder: field === 'payer' ? t('masterForm.payerPlaceholder') : undefined,
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const patch = typedFilter(query, field, e.target.value)
      if (patch) set(patch)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur(),
    className: field === 'payer' ? 'w-36' : 'w-28',
    dir: 'ltr' as const,
  })
  return (
    <fieldset className="flex flex-wrap items-end gap-2" data-idf-events-filter="">
      <legend className="sr-only">{t('events.filter.label')}</legend>
      <Field label={t('events.filter.from')}>
        <Input type="date" value={query.from} onChange={(e) => e.target.value && set({ from: e.target.value })} data-filter="from" />
      </Field>
      <Field label={t('events.filter.to')}>
        <Input type="date" value={query.to} onChange={(e) => e.target.value && set({ to: e.target.value })} data-filter="to" />
      </Field>
      <Field label={t('events.filter.store')}>
        <Input key={`store:${query.store}`} {...typed('store')} data-filter="store" />
      </Field>
      <Field label={t('events.filter.payer')}>
        <Input key={`payer:${query.payer}`} {...typed('payer')} data-filter="payer" />
      </Field>
      <Field label={t('events.filter.master')}>
        <Select value={query.masterId} onChange={(e) => set({ masterId: e.target.value })} data-filter="master">
          <option value="">{t('events.anyMaster')}</option>
          {(masters.data ?? []).map((m) => (
            <option key={m.masterId} value={m.masterId}>
              {fsi(masterName(m, i18n.language))}
            </option>
          ))}
          {/* An address naming a master the list does not hold still shows it as chosen. */}
          {query.masterId && masters.data && !masters.data.some((m) => m.masterId === query.masterId) && <option value={query.masterId}>{fsi(query.masterId)}</option>}
        </Select>
      </Field>
      {/* 627: the outcome is the log's own filter, not the report's. */}
      {query.tab === 'events' && (
        <Field label={t('events.filter.outcome')}>
          <Select value={query.outcome} onChange={(e) => set({ outcome: e.target.value as IdfEventsQuery['outcome'] })} data-filter="outcome">
            <option value="">{t('events.anyOutcome')}</option>
            {IDF_EVENT_FILTER_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {t(`events.outcome.${o}`)}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </fieldset>
  )
}

function EventsLog({ query, onPage }: { query: IdfEventsQuery; onPage: (page: number) => void }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const events = useQuery({ ...eventsQuery(query), placeholderData: keepPreviousData })
  const masters = useQuery(mastersQuery())
  const nameOf = (id: string) => {
    const m = masters.data?.find((x) => x.masterId === id)
    return m ? masterName(m, i18n.language) : null
  }

  if (events.isError && isBareDenial(events.error)) return <DeniedCard ns="insurance-idf" hook="idf-events-denied" />
  if (events.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(events.error, t('events.failed'))} />
  if (!events.data) return <Loading text={t('events.loading')} />
  const { rows, total, pageSize } = events.data
  if (rows.length === 0)
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-events-empty="">
        {t('events.empty')}
      </p>
    )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground" data-idf-events-total="">
        <Trans t={t} i18nKey="events.total" values={{ total: formatFigure(total) }} components={{ v: <Ltr /> }} />
      </p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-idf-events="">
          <thead className="bg-muted/50">
            <tr>
              <th className={TH}>{t('events.columns.at')}</th>
              <th className={TH}>{t('events.columns.store')}</th>
              <th className={TH}>{t('events.columns.trx')}</th>
              <th className={TH}>{t('events.columns.payer')}</th>
              <th className={TH}>{t('events.columns.documentType')}</th>
              <th className={TH}>{t('events.columns.itemScanned')}</th>
              <th className={TH}>{t('events.columns.itemDispensed')}</th>
              <th className={TH}>{t('events.columns.source')}</th>
              <th className={TH}>{t('events.columns.master')}</th>
              <th className={TH}>{t('events.columns.decision')}</th>
              <th className={TH}>{t('events.columns.outcome')}</th>
              <th className={`${TH} text-end`}>{t('events.columns.scannedPrice')}</th>
              <th className={`${TH} text-end`}>{t('events.columns.dispensedPrice')}</th>
              <th className={`${TH} text-end`}>{t('events.columns.timeSpent')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <EventRow
                key={e.eventId}
                e={e}
                masterName={e.masterId ? nameOf(e.masterId) : null}
                version={versionLabel(masters.data ?? [], e.masterId, e.masterVersionId)}
              />
            ))}
          </tbody>
        </table>
        {showsPager(total, pageSize) && (
          <GridPager page={query.page} pageSize={pageSize} totalMatches={total} busy={events.isFetching} onPage={onPage} />
        )}
      </div>
    </div>
  )
}

/**
 * One event (3167). The master column is the general master when the event names none; the version reads as its
 * number when it is the master's live one, else its id. Prices are per base unit (money, 3 decimals).
 */
function EventRow({ e, masterName: name, version }: { e: IdfEvent; masterName: string | null; version: string | null }) {
  const { t } = useTranslation('insurance-idf')
  const word = outcomeWordKey(e.outcome)
  const decision = decisionWordKey(e.decision)
  const reason = reasonWordKey(e.reason)
  const tier = tierOfSource(e.source)
  const spent = formatDurationMs(e.durationMs)
  const dispensed = e.dispensedItemNumber || null
  return (
    <tr className="border-t border-border/60" data-event={e.eventId} data-outcome={e.outcome} data-master={e.masterId ?? ''}>
      <td className={`${TD} whitespace-nowrap`} data-col="at">
        <Ltr>{formatDateTime(e.occurredAt)}</Ltr>
      </td>
      <td className={TD} data-col="store">
        <Ltr>{e.store}</Ltr>
        {e.till && (
          <span className="block text-xs text-muted-foreground" data-col="till">
            {t('events.columns.till')} <Ltr>{e.till}</Ltr>
          </span>
        )}
      </td>
      <td className={TD} data-col="trx">
        {e.trxNumber && <Ltr>{e.trxNumber}</Ltr>}
      </td>
      <td className={TD} data-col="payer">
        {e.insurerCustomerId && <Ltr>{e.insurerCustomerId}</Ltr>}
      </td>
      <td className={TD} data-col="documentType">
        {e.documentType && <Ltr>{e.documentType}</Ltr>}
        {e.subDocumentType && (
          <span className="block text-xs text-muted-foreground">
            <Ltr>{e.subDocumentType}</Ltr>
          </span>
        )}
      </td>
      <td className={TD} data-col="itemScanned">
        <Ltr>{e.scannedItemNumber}</Ltr>
      </td>
      <td className={TD} data-col="itemDispensed">
        {dispensed && <Ltr>{dispensed}</Ltr>}
      </td>
      <td className={TD} data-col="source">
        {tier && t(`lookup.tier.${tier}`, { defaultValue: e.source ?? '' })}
      </td>
      <td className={TD} data-col="master">
        {e.masterId ? (
          <span className="flex flex-col">
            {name ? <bdi>{name}</bdi> : <Ltr>{e.masterId}</Ltr>}
            {version && (
              <span className="text-xs text-muted-foreground" data-version="">
                <Trans t={t} i18nKey="events.version" values={{ number: version }} components={{ v: <Ltr /> }} />
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground" data-general-master="">
            {t('report.general')}
          </span>
        )}
      </td>
      <td className={TD} data-col="decision">
        {decision ? t(decision) : e.decision && <Ltr>{e.decision}</Ltr>}
      </td>
      <td className={TD} data-col="outcome">
        {word ? t(word) : <Ltr>{e.outcome}</Ltr>}
        {e.reason && (
          <span className="block text-xs text-muted-foreground" data-reason={e.reason}>
            {reason ? t(reason) : <Ltr>{e.reason}</Ltr>}
          </span>
        )}
      </td>
      <td className={NUM} data-col="scannedPrice">
        {e.scannedUnitPrice != null && <Ltr>{formatMoney3(e.scannedUnitPrice)}</Ltr>}
      </td>
      <td className={NUM} data-col="dispensedPrice">
        {dispensed && e.dispensedUnitPrice != null && <Ltr>{formatMoney3(e.dispensedUnitPrice)}</Ltr>}
      </td>
      <td className={NUM} data-col="timeSpent">
        {spent && <Ltr>{spent}</Ltr>}
      </td>
    </tr>
  )
}
