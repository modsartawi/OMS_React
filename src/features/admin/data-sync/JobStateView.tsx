import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import type { Job } from '@/core/models/data-sync'
import { failureWords, jobStateWords, type JobStateWords } from './job-helpers'

/** A job's status badge, with its phase while Running (`Running · Comparing`). */
export function JobStatusView({ job }: { job: Pick<Job, 'status' | 'phase' | 'waitReason' | 'holdReason' | 'notBefore'> }) {
  const { t } = useTranslation('data-sync')
  const w = jobStateWords(job)
  return (
    <span className="inline-flex items-center gap-1.5" data-job-status={job.status}>
      <StatusBadge sev={w.sev}>{w.labelKey ? t(w.labelKey) : <Ltr>{job.status}</Ltr>}</StatusBadge>
      {w.phaseKey && (
        <span className="text-xs text-muted-foreground" data-job-phase={job.phase ?? ''}>
          {t(w.phaseKey)}
        </span>
      )}
    </span>
  )
}

/** Why a job waits or who holds it, in words; nothing when the door gave no reason. */
export function JobReasonView({ words }: { words: JobStateWords }) {
  const { t } = useTranslation('data-sync')
  if (!words.reasonKey) return null
  return (
    <span className="text-xs" data-job-reason={words.reasonKey}>
      {words.notBefore ? (
        <Trans
          t={t}
          i18nKey={words.reasonKey}
          values={{ at: formatDateTime(words.notBefore) }}
          components={{ at: <Ltr /> }}
        />
      ) : (
        t(words.reasonKey)
      )}
    </span>
  )
}

/**
 * A job's or a table's failure as a sentence, followed by the door's detail (free text, so `<bdi>`).
 * An unknown code shows the door's raw text instead.
 */
export function FailureView({ kind, reason }: { kind: 'job' | 'table'; reason: string | null }) {
  const { t } = useTranslation('data-sync')
  const w = failureWords(kind, reason)
  if (!w) return null
  return (
    <span className="text-xs text-danger-800" data-failure={w.code ?? 'raw'}>
      {w.sentenceKey ? t(w.sentenceKey) : <bdi>{w.raw}</bdi>}
      {w.sentenceKey && w.detail && (
        <>
          {' '}
          <bdi className="text-muted-foreground" data-failure-detail="">
            {w.detail}
          </bdi>
        </>
      )}
    </span>
  )
}
