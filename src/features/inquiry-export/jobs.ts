import type { InquiryExportJob } from '@/core/inquiry-export/api'
import type { Severity } from '@/core/ui/severity'

/** How often My exports re-reads while a job is still waiting or running (ms). */
export const REFRESH_MS = 5000

/** TanStack's `refetchInterval`: poll while any job is waiting or running; stop when none is (story 11). */
export function refreshEvery(jobs: readonly InquiryExportJob[] | undefined): number | false {
  return jobs?.some((j) => j.status === 'Waiting' || j.status === 'Running') ? REFRESH_MS : false
}

/** What the File cell holds: a download while kept, "file removed" once swept (4320's sweeper), else nothing. */
export type JobFile = 'download' | 'removed' | 'none'

export function jobFile(job: InquiryExportJob): JobFile {
  if (job.fileDeletedTime) return 'removed'
  if (job.status === 'Done' && job.fileAvailable) return 'download'
  return 'none'
}

export const STATUS_SEV: Record<InquiryExportJob['status'], Severity> = {
  Waiting: 'mute',
  Running: 'go',
  Done: 'ok',
  Failed: 'bad',
  Cancelled: 'mute',
}
