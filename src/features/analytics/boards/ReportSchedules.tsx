import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CalendarClock, History, Pause, Plus, Send, ShieldAlert, Trash2 } from 'lucide-react'
import { reportRunsHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsAudienceUser, AnalyticsModel, AnalyticsReport, AnalyticsSchedule, AnalyticsScheduleWrite, Weekday } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import { buttonClass } from '@/core/ui/control-classes'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair, fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsRunsKey, analyticsSchedulesKey } from './api'
import { ParamControl } from './FilterStrip'
import { canManageSchedules } from './item-actions'
import { defaultsOf, paramLabel, valueOf } from './params'
import { runValues } from './report'
import { cadenceSummary, RECIPIENT_CAP, recipientFilter, refusedRecipients, type RecipientRefusal } from './schedule'
import { useCandidates } from './ShareDialog'
import { useItemActor } from './use-item-save'
import { analyticsRefusal, refusalWords } from './wire'

const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]
const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

/** A user reads as `employee id · name`, one pair led by a machine value (as the share dialog's picker). */
const userOption = (u: AnalyticsAudienceUser): MultiSelectOption => ({ value: u.id, text: formatPair(u.employeeId || u.id, u.name), machine: true })
const nameOf = (u: AnalyticsAudienceUser | undefined, id: string) => u?.name || id

/** A new schedule: daily at 07:00 Riyadh, the report's defaults, in the screen's language, enabled, to nobody yet. */
const newDraft = (report: AnalyticsReport): AnalyticsScheduleWrite => ({
  cadence: { kind: 'daily' },
  time: '07:00',
  values: runValues(report.definition.params, defaultsOf(report.definition.params)),
  lang: i18n.language === 'ar' ? 'ar' : 'en',
  recipients: [],
  enabled: true,
})
const draftOf = ({ id: _id, suspended: _s, ...write }: AnalyticsSchedule): AnalyticsScheduleWrite => write

/**
 * The report's schedules (spec 819 §E, ticket 833; research 803): a "Schedules" button in the report's header for its
 * owner (an author) and curators (`canManageSchedules`), and a "Kept runs" link for anyone who may open the report —
 * owners, curators and recipients alike (story 127); the Runs door lists only the runs the caller may open.
 * `startOpen` opens the schedules dialog at once (the copilot's "Schedule…" link, story 108).
 */
export default function ReportSchedules({ report, model, startOpen = false }: { report: AnalyticsReport; model: AnalyticsModel; startOpen?: boolean }) {
  const { t } = useTranslation('boards')
  const manages = canManageSchedules({ owner: report.owner, tier: report.tier }, useItemActor())
  const [open, setOpen] = useState(startOpen)
  return (
    <>
      {manages && (
        <Button variant="secondary" onClick={() => setOpen(true)} data-report-schedules>
          <CalendarClock className="size-3.5" aria-hidden />
          {t('schedule.open')}
        </Button>
      )}
      <Link to={reportRunsHref(report.id)} className={buttonClass('secondary')} data-report-runs>
        <History className="size-3.5" aria-hidden />
        {t('runs.open')}
      </Link>
      {manages && open && <SchedulesDialog report={report} model={model} onClose={() => setOpen(false)} />}
    </>
  )
}

/** The dialog: the report's schedules, each with its sentence and state; one opens in the editor, or a new one. */
function SchedulesDialog({ report, model, onClose }: { report: AnalyticsReport; model: AnalyticsModel; onClose: () => void }) {
  const { t } = useTranslation('boards')
  const schedules = useQuery({ queryKey: analyticsSchedulesKey(report.id), queryFn: () => analyticsApi.schedules(report.id), retry: false })
  /** `null` is the list; `'new'` a new schedule; else the id of the one being edited. */
  const [editing, setEditing] = useState<string | null>(null)
  const title = saysIn(report.title, i18n.language)
  const modalTitle = title ? t('schedule.title', { title: fsi(title) }) : t('schedule.untitled')
  const current = editing && editing !== 'new' ? schedules.data?.find((s) => s.id === editing) : undefined

  if (editing && (editing === 'new' || current)) {
    return <ScheduleEditor key={editing} report={report} model={model} schedule={current ?? null} title={modalTitle} onBack={() => setEditing(null)} onSaved={(s) => setEditing(s.id)} onClose={onClose} />
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={modalTitle}
      width="44rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('schedule.close')}
          </Button>
          <Button onClick={() => setEditing('new')} data-schedule-new>
            <Plus className="size-3.5" aria-hidden />
            {t('schedule.new')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-schedules>
        <p className="text-sm text-muted-foreground">{t('schedule.intro')}</p>
        {schedules.isLoading && <p role="status" className="text-sm text-muted-foreground">{t('schedule.loading')}</p>}
        {schedules.error != null && (
          <p role="alert" className="text-sm text-attention-800">
            <bdi>{refusalWords(analyticsRefusal(schedules.error, t('schedule.loadFailed')), t)}</bdi>
          </p>
        )}
        {schedules.data?.length === 0 && <p className="text-sm text-muted-foreground" data-schedules-none>{t('schedule.none')}</p>}
        <ul className="flex flex-col gap-2">
          {schedules.data?.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 rounded-md border border-border/60 p-3" data-schedule-row={s.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium" data-schedule-summary>
                  {cadenceSummary(s, t)}
                </span>
                <ScheduleState schedule={s} />
                <span className="text-xs text-muted-foreground">{t(`schedule.lang.${s.lang}`)}</span>
                <span className="text-xs text-muted-foreground" data-schedule-recipients={s.recipients.length}>
                  {t('schedule.recipientCount', { count: s.recipients.length, n: fsi(s.recipients.length) })}
                </span>
                <Button variant="text" className="ms-auto" onClick={() => setEditing(s.id)} data-schedule-edit={s.id}>
                  {t('schedule.edit')}
                </Button>
              </div>
              {s.suspended && <SuspendedNote schedule={s} report={report} />}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

function ScheduleState({ schedule }: { schedule: AnalyticsSchedule }) {
  const { t } = useTranslation('boards')
  const state = schedule.suspended ? 'suspended' : schedule.enabled ? 'enabled' : 'paused'
  return (
    <span data-schedule-state={state}>
      <StatusBadge sev={state === 'suspended' ? 'warn' : state === 'enabled' ? 'ok' : 'mute'}>{t(`schedule.state.${state}`)}</StatusBadge>
    </span>
  )
}

/** Why a schedule is suspended: its owner lost a grant, or a saved value no longer resolves (naming the parameter). */
function SuspendedNote({ schedule, report }: { schedule: AnalyticsSchedule; report: AnalyticsReport }) {
  const { t } = useTranslation('boards')
  const s = schedule.suspended
  if (!s) return null
  const param = report.definition.params.find((p) => p.name === s.param)
  const said =
    s.reason === 'ownerGrant'
      ? t('schedule.suspended.ownerGrant')
      : s.reason === 'value'
        ? t('schedule.suspended.value', { param: fsi(param ? paramLabel(param, i18n.language, t) : (s.param ?? '')) })
        : t('schedule.suspended.other', { message: fsi(s.message || s.reason) })
  return (
    <p className="flex items-start gap-1 text-xs text-attention-800" role="note" data-schedule-suspended={s.reason}>
      <Pause className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{said}</span>
    </p>
  )
}

/**
 * One schedule's editor: the cadence (daily, weekly on chosen days, monthly on a day) and a Riyadh time; the values it
 * runs with, set with the strip's own controls; the email's language; the recipients, offered from
 * `AudienceCandidates` only when in the audience, holding the run grant and with a company address, at most 25;
 * sending on or paused. A saved schedule also has Send now and Delete. An `ANALYTICS-414` names each refused
 * recipient; a suspended schedule shows why.
 */
function ScheduleEditor({
  report,
  model,
  schedule,
  title,
  onBack,
  onSaved,
  onClose,
}: {
  report: AnalyticsReport
  model: AnalyticsModel
  schedule: AnalyticsSchedule | null
  title: string
  onBack: () => void
  onSaved: (s: AnalyticsSchedule) => void
  onClose: () => void
}) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<AnalyticsScheduleWrite>(() => (schedule ? draftOf(schedule) : newDraft(report)))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const candidates = useCandidates({ roles: [], users: [] }, true, report.id)
  const set = (patch: Partial<AnalyticsScheduleWrite>) => setDraft((d) => ({ ...d, ...patch }))
  const reread = () => void queryClient.invalidateQueries({ queryKey: analyticsSchedulesKey(report.id) })

  const save = useMutation({
    mutationFn: () => (schedule ? analyticsApi.updateSchedule(report.id, schedule.id, draft) : analyticsApi.createSchedule(report.id, draft)),
    onSuccess: (saved) => {
      queryClient.setQueryData<AnalyticsSchedule[]>(analyticsSchedulesKey(report.id), (list) => (list ? [...list.filter((s) => s.id !== saved.id), saved] : [saved]))
      reread()
      toast.success(t('schedule.saved'))
      onSaved(saved)
    },
  })
  const sendNow = useMutation({
    mutationFn: () => analyticsApi.sendNow(report.id, schedule!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: analyticsRunsKey(report.id) })
      toast.success(t('schedule.sent'))
    },
  })
  const remove = useMutation({
    mutationFn: () => analyticsApi.deleteSchedule(report.id, schedule!.id),
    onSuccess: () => {
      queryClient.setQueryData<AnalyticsSchedule[]>(analyticsSchedulesKey(report.id), (list) => list?.filter((s) => s.id !== schedule!.id))
      reread()
      toast.success(t('schedule.deleted'))
      onBack()
    },
  })
  const pending = save.isPending || sendNow.isPending || remove.isPending

  const filtered = recipientFilter(candidates.data?.users ?? [], report, draft.recipients)
  const userOf = (id: string): MultiSelectOption => {
    const u = candidates.seen.users.get(id)
    return u ? userOption(u) : { value: id, text: id, machine: true }
  }
  const refused = refusedRecipients(save.error)
  const failure = save.error ?? sendNow.error ?? remove.error
  const failureWords = failure && !refused ? refusalWords(analyticsRefusal(failure, t('schedule.failed')), t) : null
  const c = draft.cadence
  const valid = draft.recipients.length > 0 && /^\d{2}:\d{2}$/.test(draft.time) && (c.kind !== 'weekly' || c.days.length > 0)

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!pending}
      title={title}
      width="44rem"
      footer={
        <>
          {schedule &&
            (confirmDelete ? (
              <Button variant="danger" className="me-auto" onClick={() => remove.mutate()} disabled={pending} data-schedule-delete-confirm>
                <Trash2 className="size-3.5" aria-hidden />
                {t('schedule.deleteConfirm')}
              </Button>
            ) : (
              <Button variant="danger-outlined" className="me-auto" onClick={() => setConfirmDelete(true)} disabled={pending} data-schedule-delete>
                <Trash2 className="size-3.5" aria-hidden />
                {t('schedule.delete')}
              </Button>
            ))}
          <Button variant="text" onClick={onBack} disabled={pending} data-schedule-back>
            {t('schedule.back')}
          </Button>
          {schedule && (
            <Button variant="secondary" onClick={() => sendNow.mutate()} disabled={pending || !!schedule.suspended} title={t('schedule.sendNowHint')} data-schedule-send-now>
              <Send className="size-3.5" aria-hidden />
              {t('schedule.sendNow')}
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={!valid || pending} data-schedule-save>
            {t('schedule.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-schedule-editor={schedule?.id ?? 'new'}>
        {schedule?.suspended && <SuspendedNote schedule={schedule} report={report} />}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('schedule.cadence.label')}</span>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly'] as const).map((kind) => (
              <Chip
                key={kind}
                on={c.kind === kind}
                onClick={() => set({ cadence: kind === 'daily' ? { kind } : kind === 'weekly' ? { kind, days: c.kind === 'weekly' ? c.days : [0] } : { kind, day: c.kind === 'monthly' ? c.day : 1 } })}
                data-schedule-cadence={kind}
              >
                {t(`schedule.cadence.${kind}`)}
              </Chip>
            ))}
          </div>
        </div>
        {c.kind === 'weekly' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('schedule.cadence.days')}</span>
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((d) => (
                <Chip
                  key={d}
                  on={c.days.includes(d)}
                  onClick={() => set({ cadence: { kind: 'weekly', days: c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort((a, b) => a - b) } })}
                  title={t(`schedule.day.${d}`)}
                  data-schedule-day={d}
                >
                  {t(`schedule.dayShort.${d}`)}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          {c.kind === 'monthly' && (
            <Field label={t('schedule.cadence.dayOfMonth')} hint={t('schedule.cadence.dayOfMonthHint')}>
              <Select value={String(c.day)} onChange={(e) => set({ cadence: { kind: 'monthly', day: Number(e.target.value) } })} className="w-24" data-schedule-month-day>
                {MONTH_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t('schedule.time')} hint={t('schedule.timeHint')}>
            <Input type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} dir="ltr" className="w-32 font-mono" data-schedule-time />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground" data-schedule-draft-summary>
          {cadenceSummary(draft, t)}
        </p>

        {report.definition.params.length > 0 && (
          <div className="flex flex-col gap-1.5" data-schedule-values>
            <span className="text-sm font-medium">{t('schedule.values')}</span>
            <span className="text-xs text-muted-foreground">{t('schedule.valuesHint')}</span>
            <div className="flex flex-wrap items-end gap-3">
              {report.definition.params.map((param) => (
                <ParamControl
                  key={param.name}
                  param={param}
                  value={valueOf(param, draft.values)}
                  onChange={(v) => set({ values: runValues(report.definition.params, { ...draft.values, [param.name]: v }) })}
                  invalid={schedule?.suspended?.reason === 'value' && schedule.suspended.param === param.name}
                  model={model}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('schedule.lang.label')}</span>
            <div className="flex gap-1">
              {(['en', 'ar'] as const).map((l) => (
                <Chip key={l} on={draft.lang === l} onClick={() => set({ lang: l })} data-schedule-lang={l}>
                  {t(`schedule.lang.${l}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('schedule.enabled.label')}</span>
            <div className="flex gap-1">
              <Chip on={draft.enabled} onClick={() => set({ enabled: true })} data-schedule-enabled="on">
                {t('schedule.enabled.on')}
              </Chip>
              <Chip on={!draft.enabled} onClick={() => set({ enabled: false })} data-schedule-enabled="paused">
                {t('schedule.enabled.paused')}
              </Chip>
            </div>
          </div>
        </div>

        <Field label={t('schedule.recipients')} hint={filtered.full ? t('schedule.full', { cap: RECIPIENT_CAP }) : t('schedule.recipientsHint', { cap: RECIPIENT_CAP })}>
          <MultiSelect
            value={draft.recipients}
            onChange={(recipients) => set({ recipients: recipients.slice(0, RECIPIENT_CAP) })}
            options={filtered.offered.map(userOption)}
            optionOf={userOf}
            label={t('schedule.recipients')}
            loading={candidates.loading}
            failed={candidates.failed}
            onQueryChange={candidates.setTyped}
            data-testid="analytics-schedule-recipients"
          />
        </Field>
        {filtered.barred.length > 0 && (
          <div className="text-xs text-muted-foreground" data-schedule-barred-list>
            <p className="font-medium">{t('schedule.barredTitle')}</p>
            <ul className="list-disc ps-4">
              {filtered.barred.map(({ user, bar }) => (
                <li key={user.id} data-schedule-barred={user.id} data-schedule-bar={bar}>
                  {t('schedule.barRow', { name: fsi(nameOf(user, user.id)), why: t(`schedule.bar.${bar}`) })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {refused && <RefusedRecipients refused={refused} nameOf={(id) => nameOf(candidates.seen.users.get(id), id)} message={refusalWords(analyticsRefusal(save.error, t('schedule.failed')), t)} />}
        {failureWords && (
          <p className="flex items-start gap-1 text-xs text-attention-800" role="alert" data-schedule-refusal>
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <bdi>{failureWords}</bdi>
          </p>
        )}
      </div>
    </Modal>
  )
}

/** `ANALYTICS-414`: each refused recipient by name, with why; the server's words when it named none. */
function RefusedRecipients({ refused, nameOf, message }: { refused: RecipientRefusal[]; nameOf: (id: string) => string; message: string }) {
  const { t } = useTranslation('boards')
  return (
    <div className="flex items-start gap-1 text-xs text-attention-800" role="alert" data-schedule-refusal="ANALYTICS-414">
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {refused.length === 0 ? (
        <bdi>{message}</bdi>
      ) : (
        <div>
          <p className="font-medium">{t('schedule.refusedTitle')}</p>
          <ul className="list-disc ps-4">
            {refused.map((r) => (
              <li key={r.id} data-schedule-refused={r.id}>
                {t('schedule.barRow', { name: fsi(nameOf(r.id)), why: t(`schedule.bar.${r.why ?? 'unknown'}`, { cap: RECIPIENT_CAP }) })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
