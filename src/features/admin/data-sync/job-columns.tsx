import type { ReactNode } from 'react'
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { AlertTriangle } from 'lucide-react'

import { pinEnd } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { formatCount } from '@/core/util/bidi'
import type { Job, TableTask } from '@/core/models/data-sync'
import CodeBadgeView from './CodeBadgeView'
import { codeText } from './code-words'
import CodeWord from './CodeWord'
import { FailureView, JobReasonView, JobStatusView } from './JobStateView'
import { MONO, formatTime } from './campaign-columns'
import { groupDigits } from './helpers'
import { jobStateWords, storeLabel, tableProgress, tableTaskStatusBadge } from './job-helpers'

const count = (p: ValueFormatterParams<TableTask, number>) => (p.value == null ? '' : groupDigits(p.value))

export interface JobColumnsOptions {
  /** Opens a job's drawer (`?job=`). */
  onOpen: (jobId: string) => void
  /**
   * 🔌 Seam for ticket 563 (per-job Pause / Resume / Cancel): when given, an `actions` column is
   * added at the row's end and draws this for each job. Absent → no column (a viewer, or before 563).
   */
  rowActions?: (job: Job) => ReactNode
}

/**
 * The campaign page's jobs grid (ticket 560): one row per store. The store opens the job's drawer;
 * status (+ phase), why it waits or who holds it, attempts, times and the failure in words.
 */
export function buildJobColumns(t: TFunction, opts: JobColumnsOptions): ColDef<Job>[] {
  const cols: ColDef<Job>[] = [
    {
      headerName: t('jobs.columns.store'),
      colId: 'store',
      width: 150,
      cellRenderer: (p: ICellRendererParams<Job>) => {
        if (!p.data) return null
        const job = p.data
        const label = storeLabel(job.store)
        return (
          <button
            type="button"
            onClick={() => opts.onOpen(job.jobId)}
            className="font-mono text-[12px] font-medium text-primary underline-offset-2 hover:underline"
            data-job-open={job.jobId}
          >
            <Ltr>{label}</Ltr>
          </button>
        )
      },
    },
    {
      headerName: t('jobs.columns.status'),
      colId: 'status',
      width: 200,
      cellRenderer: (p: ICellRendererParams<Job>) => (p.data ? <JobStatusView job={p.data} /> : null),
    },
    {
      headerName: t('jobs.columns.why'),
      colId: 'why',
      width: 300,
      cellRenderer: (p: ICellRendererParams<Job>) => (p.data ? <JobReasonView words={jobStateWords(p.data)} /> : null),
    },
    {
      headerName: t('jobs.columns.attempts'),
      field: 'attemptCount',
      width: 100,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<Job, number>) => (p.value == null ? '' : groupDigits(p.value)),
    },
    { headerName: t('jobs.columns.startedAt'), field: 'startedAt', width: 150, cellClass: MONO, valueFormatter: formatTime },
    { headerName: t('jobs.columns.finishedAt'), field: 'finishedAt', width: 150, cellClass: MONO, valueFormatter: formatTime },
    {
      headerName: t('jobs.columns.failure'),
      colId: 'failure',
      flex: 1,
      minWidth: 260,
      cellRenderer: (p: ICellRendererParams<Job>) => (p.data ? <FailureView kind="job" reason={p.data.failureReason} /> : null),
    },
  ]
  if (opts.rowActions) {
    const draw = opts.rowActions
    cols.push({
      headerName: t('jobs.columns.actions'),
      colId: 'actions',
      width: 180,
      sortable: false,
      // 🚩 Pinned (563): the row is wider than the grid, and an action scrolled off its end is
      // gone. AG Grid's sides are PHYSICAL, so the reading end comes from the boot direction.
      pinned: pinEnd,
      cellRenderer: (p: ICellRendererParams<Job>) => (p.data ? draw(p.data) : null),
    })
  }
  return cols
}

/** A table's chunk progress: a bar and `done / total`, or an indeterminate bar until it is sized. */
function ProgressCell({ task, t }: { task: TableTask; t: TFunction }) {
  const pr = tableProgress(task)
  return (
    <span className="flex h-full items-center gap-2" data-progress={pr.kind === 'determinate' ? pr.percent : 'indeterminate'}>
      {pr.kind === 'determinate' ? (
        <span
          className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pr.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${pr.percent}%` }} />
        </span>
      ) : (
        <span
          className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuetext={t('drawer.progressIndeterminate')}
        >
          <span className="block h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
        </span>
      )}
      <span className="font-mono text-[12px] tabular-nums">
        {pr.kind === 'determinate' ? <Ltr>{formatCount(groupDigits(pr.done), groupDigits(pr.total))}</Ltr> : t('drawer.progressIndeterminate')}
      </span>
    </span>
  )
}

/** A job's tables (the drawer): status, disposition, strategy, chunk progress, the counts, the failure, the truncation flag. */
export function buildTableTaskColumns(t: TFunction): ColDef<TableTask>[] {
  return [
    {
      headerName: t('drawer.columns.table'),
      field: 'table',
      width: 170,
      cellClass: MONO,
    },
    {
      headerName: t('drawer.columns.status'),
      colId: 'status',
      width: 170,
      cellRenderer: (p: ICellRendererParams<TableTask>) =>
        p.data ? (
          <span className="inline-flex items-center gap-1.5" data-table-status={p.data.status}>
            <CodeBadgeView badge={tableTaskStatusBadge(p.data.status)} code={p.data.status} />
            {p.data.status === 'Running' && p.data.phase && (
              <span className="text-xs text-muted-foreground">
                <CodeWord prefix="jobPhase" code={p.data.phase} />
              </span>
            )}
          </span>
        ) : null,
    },
    {
      headerName: t('drawer.columns.disposition'),
      field: 'disposition',
      width: 120,
      valueFormatter: (p: ValueFormatterParams<TableTask, string>) =>
        p.value ? codeText(t, 'disposition', p.value) : '',
    },
    {
      headerName: t('drawer.columns.strategy'),
      field: 'strategy',
      width: 100,
      valueFormatter: (p: ValueFormatterParams<TableTask, string>) =>
        p.value ? codeText(t, 'strategy', p.value) : '',
    },
    {
      headerName: t('drawer.columns.progress'),
      colId: 'progress',
      width: 200,
      cellRenderer: (p: ICellRendererParams<TableTask>) => (p.data ? <ProgressCell task={p.data} t={t} /> : null),
    },
    { headerName: t('drawer.columns.rowsCompared'), field: 'rowsCompared', width: 110, type: 'rightAligned', cellClass: MONO, valueFormatter: count },
    { headerName: t('drawer.columns.toInsert'), field: 'toInsert', width: 100, type: 'rightAligned', cellClass: MONO, valueFormatter: count },
    { headerName: t('drawer.columns.toUpdate'), field: 'toUpdate', width: 100, type: 'rightAligned', cellClass: MONO, valueFormatter: count },
    { headerName: t('drawer.columns.toDelete'), field: 'toDelete', width: 100, type: 'rightAligned', cellClass: MONO, valueFormatter: count },
    { headerName: t('drawer.columns.rowsApplied'), field: 'rowsApplied', width: 100, type: 'rightAligned', cellClass: MONO, valueFormatter: count },
    {
      headerName: t('drawer.columns.failure'),
      colId: 'failure',
      width: 320,
      autoHeight: true,
      wrapText: true,
      cellRenderer: (p: ICellRendererParams<TableTask>) => (p.data ? <FailureView kind="table" reason={p.data.failureReason} /> : null),
    },
    {
      headerName: t('drawer.columns.flags'),
      colId: 'flags',
      width: 190,
      cellRenderer: (p: ICellRendererParams<TableTask>) =>
        p.data?.manifestTruncated ? (
          <span className="inline-flex items-center gap-1 text-xs text-attention-800" title={t('drawer.truncatedHint')} data-truncated="">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {t('drawer.truncated')}
          </span>
        ) : null,
    },
  ]
}
