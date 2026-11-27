import { TONE_DOT } from '@/core/findings/finding-card'
import type { CcRun } from '@/core/models/command-center'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatTimeOfDay } from '@/core/util/date-format'
import type { CcT } from './lang'

/**
 * The status line under the title (oms 946, spec 4165 story 66 "a status line on the home page with each run's time and
 * a green or red dot, so that a failure is seen"): the data-as-of day, then each overnight run with its finish time and
 * its dot. The server chose the dot (decisions §5); the run's state is written beside it, so the colour is never the only
 * sign of a failure.
 */
export default function StatusLine({ dataAsOf, runs, t }: { dataAsOf: string; runs: readonly CcRun[]; t: CcT }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-cc-status>
      <span className="font-medium text-foreground">{t('status.dataAsOf', { date: fsi(dataAsOf) })}</span>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label={t('status.label')}>
        {runs.map((run) => (
          <li key={run.agent} className="flex items-center gap-1.5" data-cc-run={run.agent}>
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${TONE_DOT[run.dot]}`} data-dot={run.dot} />
            <bdi>{run.label}</bdi>
            {run.finishedAt ? <Ltr>{formatTimeOfDay(run.finishedAt)}</Ltr> : <span>{t('status.notFinished')}</span>}
            <span>{t(`status.state.${run.state}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
