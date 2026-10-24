import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ListTree } from 'lucide-react'

import type { Job, Mode } from '@/core/models/data-sync'
import { canOperateDataSync, dataSyncAccessQuery } from './api'
import { changesPath, showChangesLink } from './changes-helpers'

/**
 * The job drawer's link to its Changes view (ticket 562), for 560's `jobDrawerFooter` seam.
 *
 * Returns the footer, or `undefined` — so the drawer draws no footer at all — unless the campaign
 * is report-only (only those jobs write a manifest) and the reader holds `DataSync.Operate` (the
 * shared access probe; the door re-checks). Absent, never disabled.
 */
export function useChangesLinkFooter(mode: Mode | undefined): ((job: Job) => ReactNode) | undefined {
  const access = useQuery(dataSyncAccessQuery())
  if (!showChangesLink(mode, canOperateDataSync(access.data))) return undefined
  return (job) => <ChangesLink jobId={job.jobId} />
}

function ChangesLink({ jobId }: { jobId: string }) {
  const { t } = useTranslation('data-sync')
  return (
    <Link
      to={changesPath(jobId)}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent"
      data-changes-link={jobId}
    >
      <ListTree className="h-4 w-4" aria-hidden />
      {t('changes.link')}
    </Link>
  )
}
