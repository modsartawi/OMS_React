import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { AUDIT_KEY } from '../api'
import ReasonDialog from '../ReasonDialog'
import { STORE_DB_KEY, storeDbApi } from './api'
import { refusalKey } from './job-helpers'
import { BACKUP_FREQUENCIES, DEFAULT_WEEKDAY, STORE_FREQUENCIES, WEEKDAYS, scheduleChanged, scheduleReady, scheduleRequest, type ScheduleDraft, type ScheduleFrequency } from './schedule-helpers'

/**
 * Edits one backup schedule (oms 918, BO 4035): a store's (`code`) or the fleet default (`code: null`). Off / daily /
 * weekly + weekday, and for a store Fleet (follow the fleet default); Save asks for a reason on the console's reason dialog and sends `PUT StoreDatabase/BackupSchedule`,
 * then re-reads every store's schedule (a fleet default changes the stores that follow it) and the audit.
 */
export default function ScheduleEditor({ code, current }: { code: string | null; current: ScheduleDraft }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const [draft, setDraft] = useState<ScheduleDraft>(current)
  const [asking, setAsking] = useState(false)
  const ready = scheduleReady(draft) && scheduleChanged(draft, current)

  const save = useMutation({
    mutationFn: (reason: string) => storeDbApi.setBackupSchedule(scheduleRequest(code, draft, reason)),
    onSuccess: () => {
      notify.success(code ? t('storeDb.backup.saved', { code: fsi(code) }) : t('storeDb.backup.savedFleet'))
      void qc.invalidateQueries({ queryKey: STORE_DB_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      setAsking(false)
    },
  })

  return (
    <div className="flex flex-wrap items-end gap-3" data-schedule-editor={code === null ? 'fleet' : 'store'}>
      <Field label={t('storeDb.backup.frequency')} className="w-40">
        <Select
          value={draft.frequency}
          onChange={(e) => {
            const frequency = e.target.value as ScheduleFrequency
            setDraft({ frequency, weekday: frequency === 'Weekly' ? (draft.weekday ?? DEFAULT_WEEKDAY) : null })
          }}
          data-schedule-frequency=""
        >
          {(code === null ? BACKUP_FREQUENCIES : STORE_FREQUENCIES).map((f) => (
            <option key={f} value={f}>
              {t(`storeDb.backup.frequencies.${f}`)}
            </option>
          ))}
        </Select>
      </Field>
      {draft.frequency === 'Weekly' && (
        <Field label={t('storeDb.backup.weekday')} className="w-40">
          <Select
            value={draft.weekday ?? ''}
            onChange={(e) => setDraft({ frequency: 'Weekly', weekday: e.target.value === '' ? null : e.target.value })}
            data-schedule-weekday=""
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {t(`storeDb.backup.weekdays.${d}`)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Button variant="secondary" disabled={!ready} onClick={() => setAsking(true)} data-schedule-save="">
        {t('storeDb.backup.save')}
      </Button>
      <ReasonDialog
        open={asking}
        title={code ? t('storeDb.backup.saveTitle') : t('storeDb.backup.saveFleetTitle')}
        codes={code ? [code] : undefined}
        note={code ? t('storeDb.backup.saveNote') : t('storeDb.backup.saveFleetNote')}
        busy={save.isPending}
        error={save.error}
        codeLabel={refusalKey}
        confirmLabel={t('storeDb.backup.save')}
        onConfirm={(reason) => save.mutate(reason)}
        onClose={() => {
          save.reset()
          setAsking(false)
        }}
      />
    </div>
  )
}
