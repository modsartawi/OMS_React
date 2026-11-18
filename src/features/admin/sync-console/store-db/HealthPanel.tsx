import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { StoreDbHealthFinding } from '@/core/models/store-database'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { figure } from '../helpers'
import Loading from '../Loading'
import { storeDbHealthQuery } from './api'
import BlitzSection from './BlitzSection'
import { checkLabelKey, healthGroups, priorityBadge } from './health-helpers'
import type { StoreDbPanelProps } from './panel-views'

/**
 * The Health check panel (oms 917, BO 4032 door `GET StoreDatabase/HealthCheck`): the findings by priority, most
 * urgent first, each with its check, the server's detail and its plain-language fix. A check that faulted is a
 * finding too, and says so. Below them, sp_Blitz (oms 919, `BlitzSection`).
 */
export default function HealthPanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const health = useQuery(storeDbHealthQuery(store.code))
  const data = health.isError ? undefined : health.data
  const at = data?.takenAt ?? null

  return (
    <div className="flex flex-col gap-5" data-health-panel="">
      <section className="flex flex-col gap-3" data-health-findings={data?.findings.length ?? ''}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t('storeDb.health.intro')}</p>
          {at && (
            <span className="text-xs text-muted-foreground" data-health-taken-at={at}>
              <Trans t={t} i18nKey="storeDb.health.takenAt" values={{ at: formatDateTime(at) }} components={{ at: <Ltr /> }} />
            </span>
          )}
        </div>

        {health.isPending && <Loading label={t('storeDb.health.loading')} />}
        {health.isError && <ErrorBanner className="p-3" message={apiErrorMessage(health.error, t('storeDb.health.failed'))} />}
        {data && data.findings.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground" data-health-empty="">
            {t('storeDb.health.empty')}
          </p>
        )}
        {data &&
          healthGroups(data.findings).map((group) => (
            <ul key={group.priority} className="flex flex-col gap-2" data-health-priority={group.priority}>
              {group.findings.map((finding, i) => (
                <Finding key={`${finding.check}-${i}`} finding={finding} />
              ))}
            </ul>
          ))}
      </section>

      <BlitzSection store={store} />
    </div>
  )
}

/** One finding: the priority chip, the check's words (or the server's own word), the detail, then the fix. */
function Finding({ finding }: { finding: StoreDbHealthFinding }) {
  const { t } = useTranslation('sync-console')
  const badge = priorityBadge(finding.priority)
  const label = checkLabelKey(finding.check)
  return (
    <li
      className="flex flex-col gap-1.5 rounded-md border border-border/60 p-3 text-sm"
      data-health-finding={finding.check}
      data-health-faulted={finding.faulted ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge sev={badge.sev}>
          <Trans t={t} i18nKey={badge.labelKey} values={{ n: figure(finding.priority) }} components={{ n: <Ltr /> }} />
        </StatusBadge>
        <span className="font-medium" data-health-check="">
          {label ? t(label) : <Ltr>{finding.check}</Ltr>}
        </span>
        {finding.faulted && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-health-faulted-note="">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
            {t('storeDb.health.faulted')}
          </span>
        )}
      </div>
      <p className="break-words" data-health-detail="">
        <bdi>{finding.detail}</bdi>
      </p>
      {finding.fix && (
        <p className="break-words text-muted-foreground" data-health-fix="">
          <span className="me-1 font-medium text-foreground">{t('storeDb.health.fix')}</span>
          <bdi>{finding.fix}</bdi>
        </p>
      )}
    </li>
  )
}
