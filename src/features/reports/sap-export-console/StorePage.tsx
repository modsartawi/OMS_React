import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { StoreDetail } from '@/core/models/sap-export'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { canOpenSapExport, sapExportAccessQuery } from './access'
import { storeDaysQuery, storeQuery } from './api'
import { LABEL_TOKEN_CLASS, WORST_FIRST, labelToken, unknownLabelCounts } from './label-helpers'
import IdentityBreaks from './IdentityBreaks'
import RecomputeControl from './RecomputeControl'
import { storeFacts, stripCells, type StoreFact } from './store-helpers'
import { figure, formatHours } from './storeday-helpers'
import StoreStrip from './StoreStrip'
import TokenBadgeView from './TokenBadgeView'

/**
 * One store — `/reports/sap-export/store/:code` (BackOffice spec 2579, ticket 464), read from the
 * rollup. Top to bottom: the header (the store's counts over the window and its export facts, a
 * missing SAP location or counter row in danger with its cause), the recompute, then the 30-day
 * strip whose cells open each store-day, then the store's identity breaks (465). An unknown store
 * (`404 NO_STORE`) is a not-found state.
 *
 * 🚩 **Read-only.** The recompute re-judges the console's own rollup and never touches export data.
 */
export default function StorePage() {
  const { t } = useTranslation('sap-export-console')
  const { code = '' } = useParams()
  return (
    <ScreenGate query={sapExportAccessQuery()} can={canOpenSapExport} ns="sap-export-console" title={t('title')} subtitle={t('subtitle')}>
      <StoreView key={code} code={code} />
    </ScreenGate>
  )
}

function StoreView({ code }: { code: string }) {
  const { t } = useTranslation('sap-export-console')
  const head = useQuery(storeQuery(code))
  const days = useQuery(storeDaysQuery(code))
  const cells = useMemo(() => (days.data ? stripCells(days.data.items) : []), [days.data])
  const notFound = (head.isError && apiErrorCode(head.error) === 'NO_STORE') || (days.isError && apiErrorCode(days.error) === 'NO_STORE')

  return (
    <div className="flex min-w-0 flex-col gap-4" data-store-page={code}>
      <Link to="/reports/sap-export" className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('store.back')}
      </Link>

      {notFound ? (
        <section className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card p-6" data-store-not-found="">
          <h2 className="text-lg font-semibold tracking-tight">
            <Trans t={t} i18nKey="store.notFound" values={{ code }} components={{ v: <Ltr /> }} />
          </h2>
          <p className="text-sm text-muted-foreground">{t('store.notFoundHint')}</p>
        </section>
      ) : (
        <>
          {head.isPending && <Loading text={t('store.loading')} />}
          {head.isError && <ErrorBanner className="p-3" message={apiErrorMessage(head.error, t('store.failed'))} />}
          {head.data && <Header store={head.data} />}
          {/* Outside the header, so a failed store read still leaves the way to re-judge the rollup. */}
          {!head.isPending && (
            <section className="rounded-lg border border-border/60 bg-card p-4">
              <RecomputeControl code={code} />
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-strip-section="">
            <h3 className="text-base font-semibold tracking-tight">
              {days.data ? (
                <Trans t={t} i18nKey="store.strip.title" count={cells.length} values={{ n: figure(cells.length) }} components={{ n: <Ltr /> }} />
              ) : (
                t('store.strip.titleLoading')
              )}
            </h3>
            {days.isPending && <Loading text={t('store.strip.loading')} />}
            {days.isError && <ErrorBanner className="p-3" message={apiErrorMessage(days.error, t('store.strip.failed'))} />}
            {days.data && <StoreStrip code={code} cells={cells} />}
          </section>

          <IdentityBreaks code={code} />
        </>
      )}
    </div>
  )
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {text}
    </div>
  )
}

function Header({ store }: { store: StoreDetail }) {
  const { t } = useTranslation('sap-export-console')
  const facts = storeFacts(store)
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4" data-store-header="">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold tracking-tight" data-store-heading="">
          <Trans t={t} i18nKey="store.heading" values={{ pair: formatPair(store.code, store.description) }} components={{ v: <Ltr /> }} />
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span data-as-of={store.computedAt ?? ''}>
            {store.computedAt ? (
              <Trans t={t} i18nKey="fleet.asOf" values={{ at: formatDateTime(store.computedAt) }} components={{ at: <Ltr /> }} />
            ) : (
              t('store.neverComputed')
            )}
          </span>
          <span data-store-total={store.total}>
            <Trans t={t} i18nKey="store.total" count={store.total} values={{ n: figure(store.total) }} components={{ n: <Ltr /> }} />
          </span>
        </div>
      </div>

      {/* The window's counts, worst first — the fleet row's numbers, not a filter. */}
      <div className="flex flex-wrap items-center gap-2" aria-label={t('store.labelsLabel')} data-store-labels="">
        {WORST_FIRST.map((label) => {
          const token = labelToken(label)
          return (
            <span
              key={label}
              className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ' + LABEL_TOKEN_CLASS[token.token]}
              data-store-label={label}
              data-token={token.token}
            >
              <span className="font-mono tabular-nums">
                <Ltr>{figure(store.labels[label])}</Ltr>
              </span>
              {token.labelKey && t(token.labelKey)}
            </span>
          )
        })}
        {/* A label a newer door counts but this bundle does not know: drawn raw, so the chips still add up. */}
        {unknownLabelCounts(store.labels).map(({ label, count }) => (
          <span
            key={label}
            className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ' + LABEL_TOKEN_CLASS.neutral}
            data-label-unknown={label}
          >
            <span className="font-mono tabular-nums">
              <Ltr>{figure(count)}</Ltr>
            </span>
            <Ltr>{label}</Ltr>
          </span>
        ))}
      </div>

      <dl className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3 text-sm" data-store-counts="">
        <Stat label={t('rails.legacy')} value={figure(store.railMix.legacy)} k="rail-legacy" />
        <Stat label={t('rails.new')} value={figure(store.railMix.new)} k="rail-new" />
        <Stat label={t('fleet.columns.oldestBehind')} value={formatHours(store.oldestBehindHours)} k="oldestBehindHours" />
        <Stat label={t('fleet.columns.breakDays')} value={figure(store.breakDays)} k="breakDays" />
      </dl>

      {(store.legacyStalled || store.legacyInventoryGated) && (
        <div className="flex flex-wrap items-center gap-2" data-store-markers="">
          {store.legacyStalled && (
            <span data-marker="legacyStalled">
              <TokenBadgeView badge={{ token: 'danger', labelKey: 'fleet.markers.legacyStalled' }} value="legacyStalled" />
            </span>
          )}
          {store.legacyInventoryGated && (
            <span data-marker="legacyInventoryGated">
              <TokenBadgeView badge={{ token: 'info', labelKey: 'fleet.markers.legacyInventoryGated' }} value="legacyInventoryGated" />
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t('store.facts.title')}</h3>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3 text-sm" data-store-facts="">
          {facts.map((fact) => (
            <Fact key={fact.key} fact={fact} />
          ))}
        </dl>
      </div>
    </section>
  )
}

function Stat({ label, value, k }: { label: string; value: string; k: string }) {
  return (
    <div className="flex flex-col gap-0.5" data-stat={k}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">
        <Ltr>{value}</Ltr>
      </dd>
    </div>
  )
}

function Fact({ fact }: { fact: StoreFact }) {
  const { t } = useTranslation('sap-export-console')
  return (
    <div
      className={'flex flex-col gap-0.5 rounded-md px-2 py-1.5 ' + (fact.danger ? LABEL_TOKEN_CLASS.danger : '')}
      data-fact={fact.key}
      data-danger={fact.danger ? '' : undefined}
    >
      <dt className={'text-xs ' + (fact.danger ? '' : 'text-muted-foreground')}>{t(`store.facts.${fact.key}`)}</dt>
      <dd className="flex items-center gap-1.5 font-medium" data-fact-value="">
        {fact.danger && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {fact.valueKey ? (
          <Trans t={t} i18nKey={fact.valueKey} count={fact.count} values={{ n: figure(fact.count ?? 0) }} components={{ n: <Ltr /> }} />
        ) : (
          <Ltr>{fact.value}</Ltr>
        )}
      </dd>
      {fact.causeKey && (
        <dd className="text-xs" data-fact-cause="">
          {t(fact.causeKey)}
        </dd>
      )}
    </div>
  )
}
