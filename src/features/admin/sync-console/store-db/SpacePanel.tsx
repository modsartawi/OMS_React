import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoreDbJobKind } from '@/core/models/store-database'
import { usePermissions } from '@/core/permissions'
import JobButtons from './JobButtons'
import JobDialog from './JobDialog'
import { jobActionsVisible } from './job-helpers'
import type { StoreDbPanelProps } from './panel-views'
import { LineValue } from './ReadingsPanel'
import { readingLines, type ReadingLineKey } from './reading-helpers'
import SideCopies from './SideCopies'

/** The reading lines that say where the space went: the cap, the data file used / free inside it, the log, the drive. */
const SPACE_LINES: readonly ReadingLineKey[] = ['cap', 'used', 'allocated', 'freeInFile', 'log', 'driveFree']

/** The Space panel's jobs (BO 4034, 4036, 4037), in the order senior support reaches for them. */
const SPACE_JOBS: readonly StoreDbJobKind[] = ['ShrinkLog', 'ShrinkData', 'Cleanup']

/**
 * The Space panel (oms 918): used vs free inside the data file and the log, from the page's reading; Shrink log,
 * Shrink data and Run cleanup now with the Act key (each through `JobDialog`, reason required); and the side copies
 * beside the live database (read-only here — 919 adds Drop).
 */
export default function SpacePanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const permissions = usePermissions()
  const [kind, setKind] = useState<StoreDbJobKind | null>(null)
  const lines = readingLines(store.reading).filter((l) => SPACE_LINES.includes(l.key))
  return (
    <div className="flex flex-col gap-5" data-space-panel="">
      <section className="flex flex-col gap-2" data-space-lines={lines.length}>
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.space.title')}</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('storeDb.readings.noReading')}</p>
        ) : (
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            {lines.map((line) => (
              <div key={line.key} className="contents" data-space-line={line.key}>
                <dt className="text-muted-foreground">{t(`storeDb.readings.lines.${line.key}`)}</dt>
                <dd className="min-w-0 tabular-nums">
                  <LineValue line={line} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      {jobActionsVisible(permissions) && <JobButtons kinds={SPACE_JOBS} onPick={setKind} hint={t('storeDb.space.hint')} />}
      <SideCopies copies={store.sideCopies} />
      <JobDialog code={store.code} kind={kind} onClose={() => setKind(null)} />
    </div>
  )
}
