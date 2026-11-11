import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CalendarClock, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import i18n from '@/core/i18n'
import type { AnalyticsPersonalSchedule, AnalyticsScheduleCadence, Weekday } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import type { Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { ANALYTICS_MY_SCHEDULES_KEY, analyticsApi } from './api'
import { actOnMySchedule, myScheduleRow, mySchedulesOff, type MyScheduleAct, type MyScheduleState } from './my-schedules'
import Refused from './Refused'
import { cadenceSummary } from './schedule'
import { analyticsErrorWords } from './wire'

const STATE_SEV: Record<MyScheduleState, Severity> = { active: 'ok', paused: 'mute', suspended: 'warn' }
const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)
/** The server cuts a title to 80 (3662); the field holds no more. */
const TITLE_MAX = 80

/**
 * "My schedules" at `/analytics/my-schedules` (ticket 886; BackOffice spec 3631 S24/S30, contract 3662): the reader's
 * personal schedules — the title, the days and time, the next send, paused or not — with Pause / Resume, Change time,
 * Rename and Delete (asked once more: it deletes the report too). Each row opens its report, read only. Any reader
 * with the view grant; while the switch is off (`ANALYTICS-424`) the menu does not offer it and the page says so.
 */
export default function MySchedulesPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('mySchedules.title')} subtitle={t('mySchedules.subtitle')}>
      <MySchedulesBody />
    </ScreenGate>
  )
}

type Dialog = { kind: 'retime' | 'rename' | 'delete'; schedule: AnalyticsPersonalSchedule }

function MySchedulesBody() {
  const { t } = useTranslation('boards')
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ANALYTICS_MY_SCHEDULES_KEY, queryFn: () => analyticsApi.mySchedules(), retry: false })
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const act = useMutation({
    mutationFn: (a: MyScheduleAct) => actOnMySchedule(list.data ?? [], a),
    onSuccess: (rows, a) => {
      qc.setQueryData(ANALYTICS_MY_SCHEDULES_KEY, rows)
      setDialog(null)
      toast.success(t(`mySchedules.${DONE[a.act]}`))
    },
    onError: (err) => {
      // A schedule gone under the page (another tab deleted it) — read the list again so the row leaves.
      void qc.invalidateQueries({ queryKey: ANALYTICS_MY_SCHEDULES_KEY })
      if (!dialog) toast.error(analyticsErrorWords(err, t('mySchedules.failed'), t))
    },
  })

  if (list.error && mySchedulesOff(list.error)) {
    return (
      <p className="text-sm text-muted-foreground" data-my-schedules-off>
        {t('mySchedules.off')}
      </p>
    )
  }
  if (list.error) return <Refused err={list.error} fallbackKey="mySchedules.loadFailed" />
  if (!list.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('mySchedules.loading')}
      </div>
    )
  }
  const take = (a: MyScheduleAct) => {
    act.reset()
    act.mutate(a)
  }
  const open = (kind: Dialog['kind'], schedule: AnalyticsPersonalSchedule) => {
    act.reset()
    setDialog({ kind, schedule })
  }
  const dialogError = dialog && act.error ? analyticsErrorWords(act.error, t('mySchedules.failed'), t) : null

  return (
    <div className="flex flex-col gap-3" data-my-schedules>
      <p className="text-sm text-muted-foreground">{t('mySchedules.intro')}</p>
      {list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-my-schedules-none>
          {t('mySchedules.none')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {(['title', 'when', 'nextSend', 'state', 'actions'] as const).map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 text-start font-medium">
                    {t(`mySchedules.col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.map((s) => {
                const row = myScheduleRow(s, t)
                const busy = act.isPending && act.variables?.id === s.id
                return (
                  <tr key={s.id} className="border-t border-border/60 align-top" data-my-schedule={s.id} data-my-schedule-state={row.state}>
                    <td className="px-3 py-2">
                      <Link to={row.reportHref} className="font-medium text-primary hover:underline" data-my-schedule-open>
                        <bdi>{saysIn(s.title, i18n.language)}</bdi>
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.when}</td>
                    <td className="px-3 py-2" data-my-schedule-next>
                      {row.nextSend ? <Ltr>{row.nextSend}</Ltr> : <span className="text-muted-foreground">{t('mySchedules.noNextSend')}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge sev={STATE_SEV[row.state]}>{t(`mySchedules.state.${row.state}`)}</StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.paused ? (
                          <Button variant="secondary" disabled={busy} onClick={() => take({ act: 'resume', id: s.id })} data-my-schedule-resume>
                            <Play className="size-3.5" aria-hidden />
                            {t('mySchedules.resume')}
                          </Button>
                        ) : (
                          <Button variant="secondary" disabled={busy} onClick={() => take({ act: 'pause', id: s.id })} data-my-schedule-pause>
                            <Pause className="size-3.5" aria-hidden />
                            {t('mySchedules.pause')}
                          </Button>
                        )}
                        <Button variant="secondary" disabled={busy} onClick={() => open('retime', s)} data-my-schedule-retime>
                          <CalendarClock className="size-3.5" aria-hidden />
                          {t('mySchedules.retime')}
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={() => open('rename', s)} data-my-schedule-rename>
                          <Pencil className="size-3.5" aria-hidden />
                          {t('mySchedules.rename')}
                        </Button>
                        <Button variant="danger-outlined" disabled={busy} onClick={() => open('delete', s)} data-my-schedule-delete>
                          <Trash2 className="size-3.5" aria-hidden />
                          {t('mySchedules.delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {dialog?.kind === 'retime' && <RetimeDialog schedule={dialog.schedule} busy={act.isPending} error={dialogError} onClose={() => setDialog(null)} onSave={(cadence, time) => take({ act: 'retime', id: dialog.schedule.id, cadence, time })} />}
      {dialog?.kind === 'rename' && <RenameDialog schedule={dialog.schedule} busy={act.isPending} error={dialogError} onClose={() => setDialog(null)} onSave={(title) => take({ act: 'rename', id: dialog.schedule.id, title })} />}
      {dialog?.kind === 'delete' && <DeleteDialog schedule={dialog.schedule} busy={act.isPending} error={dialogError} onClose={() => setDialog(null)} onConfirm={() => take({ act: 'delete', id: dialog.schedule.id })} />}
    </div>
  )
}

/** Each act's toast key. */
const DONE: Record<MyScheduleAct['act'], string> = { pause: 'paused', resume: 'resumed', retime: 'retimed', rename: 'renamed', delete: 'deleted' }

const titleOf = (s: AnalyticsPersonalSchedule) => fsi(saysIn(s.title, i18n.language))

interface DialogProps {
  schedule: AnalyticsPersonalSchedule
  busy: boolean
  error: string | null
  onClose: () => void
}

function DialogError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="text-sm text-attention-800" data-my-schedule-error>
      <bdi>{error}</bdi>
    </p>
  )
}

function Footer({ busy, onClose, onSave, label, danger = false, disabled = false }: { busy: boolean; onClose: () => void; onSave: () => void; label: string; danger?: boolean; disabled?: boolean }) {
  const { t } = useTranslation('boards')
  return (
    <>
      <Button variant="text" onClick={onClose}>
        {t('mySchedules.cancel')}
      </Button>
      <Button variant={danger ? 'danger' : 'primary'} disabled={busy || disabled} onClick={onSave} data-my-schedule-save>
        {label}
      </Button>
    </>
  )
}

/** Change the days and time: the cadence as a schedule's editor draws it, Riyadh time. */
function RetimeDialog({ schedule, busy, error, onClose, onSave }: DialogProps & { onSave: (cadence: AnalyticsScheduleCadence, time: string) => void }) {
  const { t } = useTranslation('boards')
  const [cadence, setCadence] = useState<AnalyticsScheduleCadence>(schedule.cadence)
  const [time, setTime] = useState(schedule.time)
  const c = cadence
  return (
    <Modal open onClose={onClose} title={t('mySchedules.retimeTitle', { title: titleOf(schedule) })} width="34rem" footer={<Footer busy={busy} onClose={onClose} onSave={() => onSave(cadence, time)} label={t('mySchedules.save')} disabled={!time} />}>
      <div className="flex flex-col gap-3" data-my-schedule-retime-dialog>
        <div className="flex gap-1">
          {(['daily', 'weekly', 'monthly'] as const).map((kind) => (
            <Chip
              key={kind}
              on={c.kind === kind}
              onClick={() => setCadence(kind === 'daily' ? { kind } : kind === 'weekly' ? { kind, days: c.kind === 'weekly' ? c.days : [0] } : { kind, day: c.kind === 'monthly' ? c.day : 1 })}
              data-schedule-cadence={kind}
            >
              {t(`schedule.cadence.${kind}`)}
            </Chip>
          ))}
        </div>
        {c.kind === 'weekly' && (
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d) => (
              <Chip
                key={d}
                on={c.days.includes(d)}
                onClick={() => setCadence({ kind: 'weekly', days: c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort((a, b) => a - b) })}
                title={t(`schedule.day.${d}`)}
                data-schedule-day={d}
              >
                {t(`schedule.dayShort.${d}`)}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          {c.kind === 'monthly' && (
            <Field label={t('schedule.cadence.dayOfMonth')} hint={t('schedule.cadence.dayOfMonthHint')}>
              <Select value={String(c.day)} onChange={(e) => setCadence({ kind: 'monthly', day: e.target.value === 'last' ? 'last' : Number(e.target.value) })} className="w-28">
                {MONTH_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="last">{t('schedule.cadence.lastDay')}</option>
              </Select>
            </Field>
          )}
          <Field label={t('schedule.time')} hint={t('schedule.timeHint')}>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} dir="ltr" className="w-32 font-mono" />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">{cadenceSummary({ cadence, time }, t)}</p>
        <DialogError error={error} />
      </div>
    </Modal>
  )
}

function RenameDialog({ schedule, busy, error, onClose, onSave }: DialogProps & { onSave: (title: string) => void }) {
  const { t } = useTranslation('boards')
  const [title, setTitle] = useState(saysIn(schedule.title, i18n.language))
  return (
    <Modal open onClose={onClose} title={t('mySchedules.renameTitle', { title: titleOf(schedule) })} footer={<Footer busy={busy} onClose={onClose} onSave={() => onSave(title)} label={t('mySchedules.save')} disabled={!title.trim()} />}>
      <div className="flex flex-col gap-3" data-my-schedule-rename-dialog>
        <Field label={t('mySchedules.titleLabel')} hint={t('mySchedules.titleHint')}>
          <Input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} dir="auto" />
        </Field>
        <DialogError error={error} />
      </div>
    </Modal>
  )
}

function DeleteDialog({ schedule, busy, error, onClose, onConfirm }: DialogProps & { onConfirm: () => void }) {
  const { t } = useTranslation('boards')
  return (
    <Modal open onClose={onClose} title={t('mySchedules.deleteTitle', { title: titleOf(schedule) })} footer={<Footer busy={busy} onClose={onClose} onSave={onConfirm} label={t('mySchedules.deleteConfirm')} danger />}>
      <div className="flex flex-col gap-3" data-my-schedule-delete-dialog>
        <p className="text-sm">{t('mySchedules.deleteBody')}</p>
        <DialogError error={error} />
      </div>
    </Modal>
  )
}
