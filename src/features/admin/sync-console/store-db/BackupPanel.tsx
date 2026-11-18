import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { StoreDbJobKind } from '@/core/models/store-database'
import { apiErrorMessage } from '@/core/api'
import { usePermissions } from '@/core/permissions'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { canActStoreDb } from '../access'
import Loading from '../Loading'
import { storeDbScheduleQuery } from './api'
import JobButtons from './JobButtons'
import JobDialog from './JobDialog'
import type { StoreDbPanelProps } from './panel-views'
import LineValue from './LineValue'
import { readingLines } from './reading-helpers'
import ScheduleEditor from './ScheduleEditor'
import { scheduleWords } from './schedule-helpers'

const BACKUP_JOBS: readonly StoreDbJobKind[] = ['Backup']

/**
 * The Backup panel (oms 918, BO 4035): the last full backup from the reading, Back up now (Act), the store's
 * effective schedule and the fleet default — both editable with Act (spec D9: the backup schedule is Act's; the door checks Act, BO 4035).
 */
export default function BackupPanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const permissions = usePermissions()
  const act = canActStoreDb(permissions)
  const [kind, setKind] = useState<StoreDbJobKind | null>(null)
  const schedule = useQuery(storeDbScheduleQuery(store.code))
  const last = readingLines(store.reading).find((l) => l.key === 'lastBackup')

  return (
    <div className="flex flex-col gap-5" data-backup-panel="">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.backup.lastTitle')}</h3>
        <p className="text-sm tabular-nums" data-backup-last="">
          {last ? <LineValue line={last} /> : t('storeDb.readings.noReading')}
        </p>
      </section>
      {act && <JobButtons kinds={BACKUP_JOBS} onPick={setKind} hint={t('storeDb.backup.hint')} />}

      <section className="flex flex-col gap-3" data-backup-schedule={schedule.data?.source ?? ''}>
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.backup.scheduleTitle')}</h3>
        {schedule.isPending ? (
          <Loading label={t('storeDb.backup.loading')} />
        ) : schedule.error ? (
          <ErrorBanner className="p-3" message={apiErrorMessage(schedule.error, t('storeDb.backup.failed'))} />
        ) : schedule.data ? (
          <>
            <p className="text-sm" data-schedule-effective="">
              <Trans
                t={t}
                i18nKey={`storeDb.backup.effective.${schedule.data.source === 'Fleet' ? 'Fleet' : 'Store'}`}
                values={{ schedule: scheduleWords(t, schedule.data) }}
                components={{ schedule: <span />, source: <span className="text-muted-foreground" /> }}
              />
            </p>
            {act && <ScheduleEditor key={`store:${schedule.dataUpdatedAt}`} code={store.code} current={schedule.data} />}
            {act && (
              <div className="flex flex-col gap-2 rounded-md border border-border/60 p-3" data-fleet-default="">
                <h4 className="text-xs font-semibold text-muted-foreground">{t('storeDb.backup.fleetTitle')}</h4>
                <p className="text-sm">
                  {scheduleWords(t, schedule.data.fleetDefault)}
                </p>
                <p className="text-xs text-muted-foreground">{t('storeDb.backup.fleetNote')}</p>
                <ScheduleEditor key={`fleet:${schedule.dataUpdatedAt}`} code={null} current={schedule.data.fleetDefault} />
              </div>
            )}
          </>
        ) : null}
      </section>

      <JobDialog code={store.code} kind={kind} onClose={() => setKind(null)} />
    </div>
  )
}
