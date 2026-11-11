import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Check, Loader2, X } from 'lucide-react'
import { MY_SCHEDULES_PATH } from '@/core/analytics-routes'
import { rereadMySchedules } from '@/core/analytics-schedules'
import type { CopilotAnswer, CopilotCadenceKind } from '@/core/models/copilot'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { useCopilotConversation } from './conversation-store'
import { CARD_WEEKDAYS, cardLive, cardReady, choiceProblem, confirmedNote, stoppedNote, withCadence, withDay, type CardState, type ProposalCard as Card } from './proposal'

const CADENCES: readonly CopilotCadenceKind[] = ['daily', 'weekly', 'monthly']
const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => String(i + 1))

/**
 * A `proposed` answer's card (ticket 885, BackOffice spec 3631 S13, S17 to S19): the server's lines in the screen's
 * language, then the values the reader may change (days, time, title, and the period choice when offered), with
 * Confirm and Cancel. Neither calls the model: each is a confirmation request (3664). Every line is the server's; the
 * panel adds only its own labels for the controls. A closed card keeps its lines and drops its controls; an expired one
 * says so and offers nothing.
 *
 * 887 (BackOffice 3665): a `pause`/`delete` card edits nothing. It offers the matched schedules as one radio list
 * (Confirm waits for a pick when several matched), shows the server's `COPILOT-441` message beside them, and draws
 * Delete's Confirm as destructive. After a confirmed pause/delete, "My schedules" is read again too.
 */
export function ProposalCard({ card, state }: { card: Card; state: CardState }) {
  const { t } = useTranslation('copilot')
  const qc = useQueryClient()
  const confirm = useCopilotConversation((s) => s.confirm)
  const cancel = useCopilotConversation((s) => s.cancel)
  const busy = useCopilotConversation((s) => s.inFlight !== null)
  const problem = useCopilotConversation((s) => (card.choices.length > 0 ? choiceProblem(s.conv, card.id) : null))
  const [values, setValues] = useState(card.values)
  const live = cardLive(state)

  const onConfirm = () =>
    void confirm(card, values)?.then((reply) => {
      // The list on "My schedules" (886) holds one more row now, or (887) one paused or one fewer.
      if (reply?.outcome === 'confirmed') rereadMySchedules(qc)
    })

  return (
    <section
      dir={card.dir}
      aria-label={t(card.kind === 'schedule' ? 'proposal.label' : `proposal.label_${card.kind}`)}
      className="flex flex-col gap-3 rounded-lg border border-primary-border bg-primary-050/60 p-3 text-sm"
      data-copilot-proposal={card.id}
      data-copilot-proposal-state={state}
    >
      <ul className="flex flex-col gap-0.5" data-copilot-proposal-lines>
        {card.lines.map((line, i) => (
          <li key={i} data-copilot-proposal-line>
            <bdi>{line}</bdi>
          </li>
        ))}
      </ul>

      {state === 'expired' ? (
        <p role="note" className="text-muted-foreground" data-copilot-proposal-expired>
          {t('proposal.expired')}
        </p>
      ) : state === 'confirmed' || state === 'cancelled' ? (
        <StatusBadge sev={state === 'confirmed' ? 'ok' : 'mute'}>{t(`proposal.${state}State`)}</StatusBadge>
      ) : (
        <fieldset disabled={!live || busy} className="flex flex-col gap-3" data-copilot-proposal-form>
          {card.choices.length > 0 ? (
            <StopChoices card={card} choice={values.choice ?? null} problem={problem} onChoose={(id) => setValues({ ...values, choice: id })} />
          ) : (
            <ScheduleFields card={card} values={values} setValues={setValues} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={card.destructive ? 'danger' : 'primary'}
              onClick={onConfirm}
              disabled={!cardReady(values, card) || state === 'sending'}
              data-copilot-proposal-confirm
            >
              {state === 'sending' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {state === 'sending' ? t('proposal.sending') : t(card.kind === 'schedule' ? 'proposal.confirm' : `proposal.confirm_${card.kind}`)}
            </Button>
            <Button variant="secondary" onClick={() => void cancel(card)} disabled={state === 'sending'} data-copilot-proposal-cancel>
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('proposal.cancel')}
            </Button>
          </div>
        </fieldset>
      )}
    </section>
  )
}

/** 887: the schedules a pause/delete card offers, one to pick; the server's COPILOT-441 message beside them. */
function StopChoices({ card, choice, problem, onChoose }: { card: Card; choice: string | null; problem: string | null; onChoose: (id: string) => void }) {
  const { t } = useTranslation('copilot')
  return (
    <div className="flex flex-col gap-1.5">
      {card.choices.length > 1 && <span className="text-xs font-medium text-muted-foreground">{t(`proposal.choose_${card.kind}`)}</span>}
      <div role="radiogroup" aria-label={t(`proposal.choose_${card.kind}`)} className="flex flex-col gap-1" data-copilot-proposal-choices>
        {card.choices.map((c) => (
          <label key={c.id} className="flex items-start gap-2" data-copilot-proposal-choice={c.id}>
            <input type="radio" name={`copilot-proposal-${card.id}`} value={c.id} checked={choice === c.id} onChange={() => onChoose(c.id)} className="mt-1" />
            <span className="flex flex-col">
              <bdi className="font-medium">{c.title}</bdi>
              <span className="text-xs text-muted-foreground">{c.when}</span>
            </span>
          </label>
        ))}
      </div>
      {problem && (
        <p role="alert" className="text-xs text-danger-800" data-copilot-proposal-problem>
          {problem}
        </p>
      )}
    </div>
  )
}

/** 885: a schedule card's values (days, time, title and, when offered, the period choice). */
function ScheduleFields({ card, values, setValues }: { card: Card; values: Card['values']; setValues: (v: Card['values']) => void }) {
  const { t } = useTranslation('copilot')
  const c = values.cadence
  return (
    <>
      <Field label={t('proposal.title')}>
        <Input value={values.title} maxLength={80} onChange={(e) => setValues({ ...values, title: e.target.value })} className="w-full" data-copilot-proposal-title />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t('proposal.cadence')}</span>
        <div className="flex flex-wrap gap-1">
          {CADENCES.map((kind) => (
            <Chip key={kind} on={c.kind === kind} onClick={() => setValues(withCadence(values, kind))} data-copilot-proposal-cadence={kind}>
              {t(`proposal.${kind}`)}
            </Chip>
          ))}
        </div>
        {c.kind === 'weekly' && (
          <div className="flex flex-wrap gap-1" aria-label={t('proposal.days')}>
            {CARD_WEEKDAYS.map((d) => (
              <Chip key={d} on={(c.days ?? []).includes(d)} onClick={() => setValues(withDay(values, d))} title={t(`proposal.day.${d}`)} data-copilot-proposal-day={d}>
                {t(`proposal.dayShort.${d}`)}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {c.kind === 'monthly' && (
          <Field label={t('proposal.dayOfMonth')}>
            <Select value={c.day ?? '1'} onChange={(e) => setValues({ ...values, cadence: { kind: 'monthly', days: null, day: e.target.value } })} className="w-28" data-copilot-proposal-month-day>
              {MONTH_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="last">{t('proposal.lastDay')}</option>
            </Select>
          </Field>
        )}
        <Field label={t('proposal.time')}>
          <Input type="time" value={values.time} onChange={(e) => setValues({ ...values, time: e.target.value })} dir="ltr" className="w-32 font-mono" data-copilot-proposal-time />
        </Field>
        {card.periodChoices.length > 0 && (
          <Field label={t('proposal.period')}>
            <Select
              value={values.periodChoice ?? card.periodChoices[0].key}
              onChange={(e) => setValues({ ...values, periodChoice: e.target.value === 'sameDates' ? 'sameDates' : 'sameLength' })}
              data-copilot-proposal-period
            >
              {card.periodChoices.map((p) => (
                <option key={p.key} value={p.key}>
                  {fsi(p.label)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </>
  )
}

/**
 * Under a `confirmed` answer's sentence (the server's, drawn as the answer text): the first send and the link to
 * "My schedules" (886). Under a refusal for the schedule limit, the same link, so the reader can make room. Under a
 * confirmed pause or delete (887), the same link: a paused schedule is resumed there.
 */
export function ScheduleLinks({ reply }: { reply: CopilotAnswer }) {
  const { t } = useTranslation('copilot')
  const note = confirmedNote(reply)
  const stopped = stoppedNote(reply)
  const limit = reply.scheduleRefusal?.reason === 'limit'
  if (!note && !stopped && !limit) return null
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs" data-copilot-schedule-links>
      {note && (
        <span data-copilot-first-send>
          {t('proposal.firstSend')} <Ltr>{formatDateTime(note.firstSendAt)}</Ltr>
        </span>
      )}
      <Link to={MY_SCHEDULES_PATH} className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2" data-copilot-my-schedules>
        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
        {t('proposal.mySchedules')}
      </Link>
    </div>
  )
}
