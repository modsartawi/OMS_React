import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { feedsQuery } from './api'
import { comparisonView } from './feeds'
import HowRead from './HowRead'
import { HOW_FEEDS } from './how-sections'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'

/**
 * A store's Feeds tab (oms 942, spec 4157 stories 49 and 51), read on opening: where the SAP feed stands for the store
 * (the last SAP document applied) and its last attempt; where the till feed stands and its last attempt; and, for a
 * counted store, the nightly comparison with SAP. A failed read draws no kept answer.
 */
export default function FeedsTab({ store }: { store: string }) {
  const { t } = useTranslation('stock-console')
  const read = useQuery(feedsQuery(store))
  const feeds = read.isError ? undefined : read.data

  return (
    <div className="flex min-w-0 flex-col gap-3" data-feeds-tab={store}>
      {read.isPending && <Loading label={t('feeds.loading')} />}
      {read.isError && <RefusalBanner error={read.error} />}
      {feeds && (
        <dl className="grid gap-2 sm:grid-cols-3">
          <Block title={t('feeds.sap')} name="sap">
            <Time label={t('feeds.place')} at={feeds.sapPlace} />
            <Time label={t('feeds.lastAttempt')} at={feeds.sapLastAttempt} />
          </Block>
          <Block title={t('feeds.till')} name="till">
            <Time label={t('feeds.place')} at={feeds.tillPlace} />
            <Time label={t('feeds.lastAttempt')} at={feeds.tillLastAttempt} />
          </Block>
          <Block title={t('feeds.comparison.title')} name="comparison">
            <Comparison view={comparisonView(feeds)} />
          </Block>
        </dl>
      )}
      <HowRead section="feeds" paragraphs={HOW_FEEDS} />
    </div>
  )
}

function Block({ title, name, children }: { title: string; name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 px-3 py-2" data-feeds-block={name}>
      <dt className="text-sm font-medium">{title}</dt>
      <dd className="flex flex-col gap-1 text-sm">{children}</dd>
    </div>
  )
}

function Time({ label, at }: { label: string; at: string | null }) {
  const { t } = useTranslation('stock-console')
  return (
    <span className="flex flex-wrap gap-x-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{at ? <Ltr>{formatDateTime(at)}</Ltr> : t('store.never')}</span>
    </span>
  )
}

function Comparison({ view }: { view: ReturnType<typeof comparisonView> }) {
  const { t } = useTranslation('stock-console')
  if (view.kind === 'notCounted') return <span className="text-muted-foreground">{t('feeds.comparison.notCounted')}</span>
  if (view.kind === 'notYet') return <span className="text-muted-foreground">{t('feeds.comparison.notYet')}</span>
  const ran = view.at ? (
    <span className="text-xs text-muted-foreground">
      <Trans t={t} i18nKey="feeds.comparison.ranAt" values={{ at: formatDateTime(view.at) }} components={{ at: <Ltr /> }} />
    </span>
  ) : null
  return (
    <span className="flex flex-col gap-1" data-comparison={view.kind}>
      {view.kind === 'differs' ? (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge sev="warn">{t('flagName.ComparisonDiffers')}</StatusBadge>
          <Trans
            t={t}
            i18nKey="feeds.comparison.differs"
            count={view.batches}
            values={{ n: formatFigure(view.batches) }}
            components={{ n: <Ltr /> }}
          />
        </span>
      ) : (
        <span>{t('feeds.comparison.matches')}</span>
      )}
      {ran}
    </span>
  )
}
