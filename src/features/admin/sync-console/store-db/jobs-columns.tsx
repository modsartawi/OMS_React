import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { StoreDbJob } from '@/core/models/store-database'
import CodeBadgeView from '../CodeBadgeView'
import { MONO, formatTime } from '../console-columns'
import { figure } from '../helpers'
import { jobFailure, jobKindKey, jobStateBadge } from './job-helpers'

/** The runner's error; server text, so isolated with `<bdi>` (dir auto). */
function ErrorCell({ data }: ICellRendererParams<StoreDbJob>) {
  const text = data ? jobFailure(data) : null
  if (!text) return null
  return (
    <bdi className="text-danger-800" data-job-error="">
      {text}
    </bdi>
  )
}

/** The Jobs panel's columns (oms 918, BO 4034): what, state, attempts, when it may start, ran, and how it ended. */
export function buildJobColumns(t: TFunction): ColDef<StoreDbJob>[] {
  return [
    {
      headerName: t('storeDb.jobs.columns.kind'),
      field: 'kind',
      width: 150,
      valueFormatter: (p: ValueFormatterParams<StoreDbJob, string>) => {
        const key = jobKindKey(p.value ?? '')
        return key ? t(key) : (p.value ?? '')
      },
    },
    {
      headerName: t('storeDb.jobs.columns.state'),
      field: 'state',
      width: 120,
      cellRenderer: (p: ICellRendererParams<StoreDbJob>) =>
        p.data ? (
          <span data-job-state={p.data.state}>
            <CodeBadgeView badge={jobStateBadge(p.data.state)} code={p.data.state} />
          </span>
        ) : null,
    },
    {
      headerName: t('storeDb.jobs.columns.attempts'),
      field: 'attempts',
      width: 100,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbJob, number>) => (p.value == null ? '' : figure(p.value)),
    },
    { headerName: t('storeDb.jobs.columns.notBefore'), field: 'notBefore', width: 150, valueFormatter: formatTime },
    { headerName: t('storeDb.jobs.columns.startedAt'), field: 'startedAt', width: 150, valueFormatter: formatTime },
    { headerName: t('storeDb.jobs.columns.finishedAt'), field: 'finishedAt', width: 150, valueFormatter: formatTime },
    { headerName: t('storeDb.jobs.columns.result'), field: 'result', flex: 1, minWidth: 180, tooltipField: 'result' },
    { headerName: t('storeDb.jobs.columns.error'), field: 'error', flex: 1, minWidth: 220, cellRenderer: ErrorCell },
    { headerName: t('storeDb.jobs.columns.requestedBy'), field: 'requestedBy', width: 120 },
    { headerName: t('storeDb.jobs.columns.requestedAt'), field: 'requestedAt', width: 150, valueFormatter: formatTime },
    { headerName: t('storeDb.jobs.columns.reason'), field: 'reason', flex: 1, minWidth: 180, tooltipField: 'reason' },
    { headerName: t('storeDb.jobs.columns.jobId'), field: 'jobId', width: 250, cellClass: MONO },
  ]
}
