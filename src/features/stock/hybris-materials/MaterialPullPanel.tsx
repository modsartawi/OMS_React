import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { CloudDownload } from 'lucide-react'
import { hybrisStockStatusQuery } from '@/core/hybris-stock/api'
import type { HybrisStockMaterialPullRow } from '@/core/models/hybris-stock'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure } from '@/core/util/number-format'

/**
 * The material list's pull from Hybris's product approvals (BackOffice 4180), read off `Status`: on or
 * off, the latest pull (applied or failed, and why), its counts — products, approved, unapproved, added,
 * re-enabled, disabled, unknown — and, after a failure, when the list was last applied. Approved and
 * unapproved products both get stock; only a product absent from the export is disabled.
 */
export default function MaterialPullPanel() {
  const { t } = useTranslation('hybris-stock-materials')
  const status = useQuery(hybrisStockStatusQuery())
  const pull = status.isSuccess ? status.data.materialPull : undefined
  if (!pull) return null

  const last = pull.lastPull
  const failed = last?.status === 'E'
  return (
    <section className="flex flex-col gap-1.5 rounded-md border border-border bg-card-2 px-3 py-2 text-xs" data-material-pull={pull.enabled ? 'on' : 'off'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CloudDownload className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-semibold">{t('pull.title')}</span>
        <StatusBadge sev={pull.enabled ? 'go' : 'mute'}>{t(pull.enabled ? 'pull.on' : 'pull.off')}</StatusBadge>
        {pull.enabled && (
          <span className="text-muted-foreground">
            <Trans t={t} i18nKey="pull.interval" values={{ n: figure(pull.intervalMinutes) }} components={{ n: <Ltr /> }} />
          </span>
        )}
        {last ? (
          <span className="flex flex-wrap items-center gap-x-2" data-pull-last={last.status}>
            <StatusBadge sev={failed ? 'bad' : 'go'}>{t(failed ? 'pull.failed' : 'pull.applied')}</StatusBadge>
            <Ltr>{formatDateTime(last.finishedAt)}</Ltr>
          </span>
        ) : (
          <span className="text-muted-foreground" data-pull-last="none">
            {t('pull.none')}
          </span>
        )}
      </div>
      {last && !failed && <Counts row={last} />}
      {failed && (
        <>
          <p className="text-danger-800" data-pull-error="">
            <bdi>{last.error}</bdi>
          </p>
          {pull.lastApplied ? (
            <div className="flex flex-col gap-1 text-muted-foreground" data-pull-last-applied="">
              <span>
                <Trans t={t} i18nKey="pull.lastApplied" values={{ at: formatDateTime(pull.lastApplied.finishedAt) }} components={{ at: <Ltr /> }} />
              </span>
              <Counts row={pull.lastApplied} />
            </div>
          ) : (
            <span className="text-muted-foreground">{t('pull.neverApplied')}</span>
          )}
        </>
      )}
      <p className="text-muted-foreground">{t('pull.note')}</p>
    </section>
  )
}

function Counts({ row }: { row: HybrisStockMaterialPullRow }) {
  const { t } = useTranslation('hybris-stock-materials')
  const items: [string, number][] = [
    ['products', row.products],
    ['approved', row.approved],
    ['unapproved', Math.max(0, row.products - row.approved)],
    ['added', row.added],
    ['enabled', row.enabled],
    ['disabled', row.disabled],
    ['unknown', row.unknown],
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1" data-pull-counts="">
      {row.generatedAt && (
        <span className="text-muted-foreground">
          <Trans t={t} i18nKey="pull.generatedAt" values={{ at: row.generatedAt }} components={{ at: <Ltr /> }} />
        </span>
      )}
      {items.map(([key, n]) => (
        <span key={key} data-pull-count={key}>
          <span className="text-muted-foreground">{t(`pull.count.${key}`)}</span>{' '}
          <span className="font-semibold">
            <Ltr>{figure(n)}</Ltr>
          </span>
        </span>
      ))}
    </div>
  )
}
