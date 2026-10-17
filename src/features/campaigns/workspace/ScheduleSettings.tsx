import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { ruleCampaignApi } from '@/core/rules/api'
import { formToSchedule, scheduleProblems, scheduleToForm, type ScheduleForm } from '@/core/rules/schedule'
import { useWorkspace } from './context'
import { SETTINGS_CONTROL, SaveRow, togglePill, SettingsField, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'

const WEEK = [0, 1, 2, 3, 4, 5, 6]

/**
 * Settings ▸ Schedule (ticket 509): the start and end days — either clearable, the end exclusive —
 * the weekdays and the daily hours, all in LOCAL time. The native date and time inputs give local
 * `yyyy-MM-dd` and `HH:mm` and the wire takes them as they are (`@/core/rules/schedule`): no `Date`
 * is built, so nothing can shift a day.
 */
export default function ScheduleSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<ScheduleForm>(scheduleToForm(c.schedule))
  const save = useSettingsSave('schedule', (body: ReturnType<typeof formToSchedule>) => ruleCampaignApi.saveSchedule(c.id, body), adoptNext)
  const problems = scheduleProblems(draft)

  const set = (change: Partial<ScheduleForm>) => {
    setDraft((d) => ({ ...d, ...change }))
    if (save.isError) save.reset()
  }
  const toggleDay = (d: number) => set({ days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort((a, b) => a - b) })

  return (
    <SettingsFrame page="schedule">
      <SettingsField id="settings-from" label={t('settings.schedule.start')} hint={draft.from ? null : t('settings.schedule.startEmpty')}>
        <DayInput id="settings-from" value={draft.from} onChange={(from) => set({ from })} clearLabel={t('settings.schedule.clearStart')} data="from" />
      </SettingsField>
      <SettingsField id="settings-until" label={t('settings.schedule.end')} hint={draft.until ? t('settings.schedule.endExclusive') : t('settings.schedule.endEmpty')}>
        <DayInput id="settings-until" value={draft.until} onChange={(until) => set({ until })} clearLabel={t('settings.schedule.clearEnd')} data="until" />
        {problems.includes('untilNotAfterFrom') && (
          <p className="text-xs text-danger-800" data-settings-problem="untilNotAfterFrom">
            {t('settings.schedule.problem.untilNotAfterFrom')}
          </p>
        )}
      </SettingsField>
      <SettingsField label={t('settings.schedule.days')} hint={t('settings.schedule.daysHint')}>
        <span className="flex flex-wrap gap-1.5" role="group" aria-label={t('settings.schedule.days')} data-settings-days="">
          {WEEK.map((d) => {
            const on = draft.days.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={togglePill(on)}
                data-settings-day={d}
              >
                {t(`weekdays.${d}`)}
              </button>
            )
          })}
        </span>
      </SettingsField>
      <SettingsField id="settings-hours-from" label={t('settings.schedule.hours')} hint={t('settings.schedule.hoursHint')}>
        <span className="flex flex-wrap items-center gap-2">
          <input
            id="settings-hours-from"
            type="time"
            className={SETTINGS_CONTROL}
            value={draft.hoursFrom}
            aria-label={t('settings.schedule.hoursFrom')}
            onChange={(e) => set({ hoursFrom: e.target.value })}
            data-settings-field="hoursFrom"
          />
          <span className="text-xs text-muted-foreground">{t('settings.schedule.hoursTo')}</span>
          <input
            type="time"
            className={SETTINGS_CONTROL}
            value={draft.hoursTo}
            aria-label={t('settings.schedule.hoursToLabel')}
            onChange={(e) => set({ hoursTo: e.target.value })}
            data-settings-field="hoursTo"
          />
          {(draft.hoursFrom || draft.hoursTo) && (
            <ClearButton label={t('settings.schedule.clearHours')} onClick={() => set({ hoursFrom: '', hoursTo: '' })} data="hours" />
          )}
        </span>
        {problems.includes('hoursToNotAfterFrom') && (
          <p className="text-xs text-danger-800" data-settings-problem="hoursToNotAfterFrom">
            {t('settings.schedule.problem.hoursToNotAfterFrom')}
          </p>
        )}
      </SettingsField>
      <p className="text-xs text-muted-foreground">{t('settings.schedule.localTime')}</p>
      <SaveRow
        page="schedule"
        dirty={dirty}
        blocked={problems.length > 0}
        pending={save.isPending}
        error={save.error}
        onCancel={() => {
          reset()
          save.reset()
        }}
        onSave={() => {
          if (problems.length || save.isPending) return
          save.mutate(formToSchedule(draft))
        }}
      />
    </SettingsFrame>
  )
}

function DayInput({ id, value, onChange, clearLabel, data }: { id: string; value: string; onChange: (value: string) => void; clearLabel: string; data: string }) {
  return (
    <span className="flex items-center gap-2">
      <input id={id} type="date" className={SETTINGS_CONTROL} value={value} onChange={(e) => onChange(e.target.value)} data-settings-field={data} />
      {value && <ClearButton label={clearLabel} onClick={() => onChange('')} data={data} />}
    </span>
  )
}

function ClearButton({ label, onClick, data }: { label: string; onClick: () => void; data: string }) {
  return (
    <button
      type="button"
      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-settings-clear={data}
    >
      <X className="size-4" aria-hidden />
    </button>
  )
}
