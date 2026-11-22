import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import type { StockConsoleFleet } from '@/core/models/stock-console'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { canOpenStockConsole } from './access'
import { ageView } from './age'
import { fleetQuery } from './api'
import ConsoleNav from './ConsoleNav'
import { FLEET_FACTS, factView, feedLabel, type FactView, type FleetFact } from './fleet'
import HowRead from './HowRead'
import { HOW_FLEET } from './how-sections'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'

/**
 * Feeds and switches (oms 942, BackOffice spec 4157 story 71) — `/stock/console/fleet`. Read-only.
 *
 * The facts that belong to no store, read once on opening (`StockConsole/Fleet`): each feed's last full pass and its
 * age, the reserved recompute, the held-served switch, the hold ledger reader and today's take door. A fact the server
 * could not answer says "No answer" — never drawn as healthy. Refresh reads it again.
 */
export default function FleetPage() {
  const { t } = useTranslation('stock-console')
  return (
    <ScreenGate can={canOpenStockConsole} ns="stock-console" title={t('title')} subtitle={t('subtitle')}>
      <Fleet />
    </ScreenGate>
  )
}

function Fleet() {
  const { t } = useTranslation('stock-console')
  const read = useQuery(fleetQuery())
  // A failed read draws no kept answer: an old one beside the error would pass for the fleet now.
  const fleet = read.isError ? undefined : read.data

  return (
    <div className="flex min-w-0 flex-col gap-4" data-console-fleet="">
      <ConsoleNav />

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" data-read-at="">
        <span className="me-auto">{t('fleet.lead')}</span>
        {read.isFetching && (
          <span className="inline-flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('stores.refreshing')}
          </span>
        )}
        {fleet?.readAt && (
          <span>
            <Trans t={t} i18nKey="stores.readAt" values={{ at: formatDateTime(fleet.readAt) }} components={{ at: <Ltr /> }} />
          </span>
        )}
        <Button variant="outlined" onClick={() => void read.refetch()} disabled={read.isFetching} data-fleet-refresh="">
          <RefreshCw className={'h-3.5 w-3.5 ' + (read.isFetching ? 'animate-spin' : '')} aria-hidden />
          {t('stores.refresh')}
        </Button>
      </div>

      {read.isPending && <Loading label={t('fleet.loading')} />}
      {read.isError && <RefusalBanner error={read.error} />}
      {fleet && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FLEET_FACTS.map((fact) => (
            <FactCard key={fact} fact={fact} view={factView(fleet, fact)}>
              <FactBody fact={fact} fleet={fleet} />
            </FactCard>
          ))}
        </div>
      )}

      <HowRead section="fleet" paragraphs={HOW_FLEET} />
    </div>
  )
}

const VIEW_SEV = { noAnswer: 'bad', problem: 'warn' } as const

function FactCard({ fact, view, children }: { fact: FleetFact; view: FactView; children: ReactNode }) {
  const { t } = useTranslation('stock-console')
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-fleet-fact={fact} data-fact-view={view}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{t(`fleet.fact.${fact}`)}</h2>
        {view !== 'answered' && <StatusBadge sev={VIEW_SEV[view]}>{t(`fleet.view.${view}`)}</StatusBadge>}
      </div>
      {view === 'noAnswer' ? <p className="text-sm text-muted-foreground">{t('fleet.noAnswer')}</p> : children}
    </section>
  )
}

/** A time, or "never". */
function When({ at }: { at: string | null }) {
  const { t } = useTranslation('stock-console')
  return <span className="font-mono">{at ? <Ltr>{formatDateTime(at)}</Ltr> : t('store.never')}</span>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Age({ seconds }: { seconds: number | null }) {
  const { t } = useTranslation('stock-console')
  if (seconds === null) return null
  const age = ageView(seconds)
  // Words around the numbers ("3 min", "٣ د"): the words carry the order, so it takes its own direction, not Ltr.
  return <bdi>{t(age.key, age.values)}</bdi>
}

function FactBody({ fact, fleet }: { fact: FleetFact; fleet: StockConsoleFleet }) {
  const { t } = useTranslation('stock-console')
  switch (fact) {
    case 'feeds':
      return (
        <dl className="flex flex-col gap-1">
          {(fleet.feeds ?? []).map((f) => {
            const name = feedLabel(f.feed)
            return (
              <Row key={f.feed} label={'key' in name ? t(name.key) : f.feed}>
                <span className="inline-flex flex-wrap items-center gap-2" data-feed={f.feed}>
                  {f.lastCompletePassAt ? <When at={f.lastCompletePassAt} /> : t('fleet.neverPassed')}
                  <span className="text-xs text-muted-foreground">
                    <Age seconds={f.ageSeconds} />
                  </span>
                </span>
              </Row>
            )
          })}
        </dl>
      )
    case 'reservedRun': {
      const run = fleet.reservedRun!
      return (
        <dl className="flex flex-col gap-1">
          <Row label={t('fleet.reserved.lastSuccess')}>
            {run.lastSuccessAt ? <When at={run.lastSuccessAt} /> : t('fleet.reserved.neverSucceeded')}
          </Row>
          <Row label={t('fleet.reserved.lastStarted')}>
            <When at={run.lastStartedAt} />
          </Row>
          <Row label={t('fleet.reserved.lastFailure')}>
            <When at={run.lastFailureAt} />
          </Row>
          <Row label={t('fleet.reserved.failures')}>
            <Ltr>{formatFigure(run.consecutiveFailures)}</Ltr>
          </Row>
          {run.lastError && (
            <Row label={t('fleet.reserved.lastError')}>
              <bdi>{run.lastError}</bdi>
            </Row>
          )}
        </dl>
      )
    }
    case 'heldServed': {
      const sw = fleet.heldServed!
      return (
        <dl className="flex flex-col gap-1">
          <Row label={t('fleet.held.served')}>{t(sw.served ? 'fleet.held.on' : 'fleet.held.off')}</Row>
          <Row label={t('fleet.held.changedAt')}>
            <When at={sw.changedAt} />
          </Row>
          <Row label={t('fleet.held.subtractsHeld')}>{t(sw.subtractsHeld ? 'fleet.yes' : 'fleet.no')}</Row>
          <Row label={t('fleet.held.netting')}>
            <bdi>{sw.netting}</bdi>
          </Row>
          {sw.fellBackAt && (
            <Row label={t('fleet.held.fellBackAt')}>
              <When at={sw.fellBackAt} />
            </Row>
          )}
        </dl>
      )
    }
    case 'ledgerReader': {
      const reader = fleet.ledgerReader!
      return (
        <dl className="flex flex-col gap-1">
          <Row label={t('fleet.reader.lastPass')}>
            <When at={reader.lastPassAt} />
          </Row>
          <Row label={t('fleet.reader.lag')}>
            {reader.lagSeconds === null ? t('fleet.unknown') : <Age seconds={reader.lagSeconds} />}
          </Row>
          <Row label={t('fleet.reader.readThrough')}>
            <When at={reader.readThroughAt} />
          </Row>
        </dl>
      )
    }
    case 'takesToday': {
      const today = fleet.takesToday!
      return (
        <dl className="flex flex-col gap-1">
          <Row label={t('fleet.takes.day')}>
            <span className="font-mono">
              <Ltr>{today.day}</Ltr>
            </span>
          </Row>
          <Row label={t('fleet.takes.takes')}>
            <Ltr>{formatFigure(today.takes)}</Ltr>
          </Row>
          <Row label={t('fleet.takes.failed')}>
            <Ltr>{formatFigure(today.failed)}</Ltr>
          </Row>
          <Row label={t('fleet.takes.skipped')}>
            {today.skipped === null ? t('fleet.unknown') : <Ltr>{formatFigure(today.skipped)}</Ltr>}
          </Row>
        </dl>
      )
    }
  }
}
