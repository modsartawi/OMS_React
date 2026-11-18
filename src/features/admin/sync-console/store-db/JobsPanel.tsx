import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { StoreDbJob } from '@/core/models/store-database'
import TabGrid from '../TabGrid'
import { storeDbJobsQuery } from './api'
import { buildJobColumns } from './jobs-columns'
import type { StoreDbPanelProps } from './panel-views'

/**
 * The Jobs panel (oms 918, BO 4034): the store's jobs, newest first, with state, attempts, not before, start, finish,
 * result and error. Read on open and every 15 s while open (a queued job moves on the runner's tick).
 */
export default function JobsPanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const jobs = useQuery(storeDbJobsQuery(store.code))
  const columns = useMemo(() => buildJobColumns(t), [t])
  return (
    <section className="flex flex-col gap-2" data-jobs-panel={jobs.data?.length ?? ''}>
      <p className="text-xs text-muted-foreground">{t('storeDb.jobs.note')}</p>
      <TabGrid
        rows={jobs.data}
        columns={columns}
        rowId={jobId}
        pending={jobs.isPending}
        error={jobs.error}
        failed={t('storeDb.jobs.failed')}
        empty={t('storeDb.jobs.empty')}
        loading={t('storeDb.jobs.loading')}
        data="store-db-jobs"
        maxRows={15}
      />
    </section>
  )
}

const jobId = (row: StoreDbJob) => row.jobId
