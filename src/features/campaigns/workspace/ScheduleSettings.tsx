import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { RULE_WEEKDAYS, type RuleWeekday } from '@/core/models/rule-campaign'
import { formToWindow, scheduleProblems, windowToForm, type ScheduleForm } from '@/core/rules/schedule'
import { useWorkspace } from './context'
import { draftSave } from './settings-form'
import { SaveRow, SettingsField, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'
import Input from '@/core/ui/Input'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'


/**
 * Settings ▸ Schedule (ticket 509): the start and end days — either clearable, the end exclusive —
 * the weekdays and the daily hours (which may cross midnight), all in LOCAL time. The native date and time inputs give local
 * `yyyy-MM-dd` and `HH:mm` and the wire takes them as they are (`@/core/rules/schedule`): no `Date`
 * is built, so nothing can shift a day.
 */
export default function ScheduleSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<ScheduleForm>(windowToForm(d.campaign.window))
  const save = useSettingsSave('schedule', (form: ScheduleForm) => draftSave(d, { window: formToWindow(form) }), adoptNext)
  const problems = scheduleProblems(draft)

  const set = (change: Partial<ScheduleForm>) => {
    setDraft((d) => ({ ...d, ...change }))
    if (save.isError) save.reset()
  }
  const toggleDay = (day: RuleWeekday) =>
    set({ days: draft.days.includes(day) ? draft.days.filter((x) => x !== day) : RULE_WEEKDAYS.filter((x) => x === day || draft.days.includes(x)) })
  // Hours that end before they start run past midnight into the next day (`22:00` until `02:00`).
  const overnight = !!draft.hoursFrom && !!draft.hoursTo && draft.hoursTo < draft.hoursFrom

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
          {RULE_WEEKDAYS.map((day, i) => {
            const on = draft.days.includes(day)
            return (
              <Chip key={day} on={on} onClick={() => toggleDay(day)} data-settings-day={day}>
                {t(`weekdays.${i}`)}
              </Chip>
            )
          })}
        </span>
      </SettingsField>
      <SettingsField id="settings-hours-from" label={t('settings.schedule.hours')} hint={t('settings.schedule.hoursHint')}>
        <span className="flex flex-wrap items-center gap-2">
          <Input
            id="settings-hours-from"
            type="time"
            value={draft.hoursFrom}
            aria-label={t('settings.schedule.hoursFrom')}
            onChange={(e) => set({ hoursFrom: e.target.value })}
            data-settings-field="hoursFrom"
          />
          <span className="text-xs text-muted-foreground">{t('settings.schedule.hoursTo')}</span>
          <Input
            type="time"
            value={draft.hoursTo}
            aria-label={t('settings.schedule.hoursToLabel')}
            onChange={(e) => set({ hoursTo: e.target.value })}
            data-settings-field="hoursTo"
          />
          {(draft.hoursFrom || draft.hoursTo) && (
            <ClearButton label={t('settings.schedule.clearHours')} onClick={() => set({ hoursFrom: '', hoursTo: '' })} data="hours" />
          )}
        </span>
        {overnight && (
          <p className="text-xs text-muted-foreground" data-settings-overnight="">
            {t('settings.schedule.overnight')}
          </p>
        )}
        {(['hoursIncomplete', 'hoursSame'] as const).map(
          (p) =>
            problems.includes(p) && (
              <p key={p} className="text-xs text-danger-800" data-settings-problem={p}>
                {t(`settings.schedule.problem.${p}`)}
              </p>
            ),
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
          save.mutate(draft)
        }}
      />
    </SettingsFrame>
  )
}

function DayInput({ id, value, onChange, clearLabel, data }: { id: string; value: string; onChange: (value: string) => void; clearLabel: string; data: string }) {
  return (
    <span className="flex items-center gap-2">
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} data-settings-field={data} />
      {value && <ClearButton label={clearLabel} onClick={() => onChange('')} data={data} />}
    </span>
  )
}

function ClearButton({ label, onClick, data }: { label: string; onClick: () => void; data: string }) {
  return (
    <IconButton label={label} onClick={onClick} data-settings-clear={data}>
      <X className="size-4" aria-hidden />
    </IconButton>
  )
}
