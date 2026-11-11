import { MY_SCHEDULES_PATH } from '@/core/analytics-routes'
import { apiErrorCode, apiErrorData } from '@/core/api'
import { saysIn } from '@/core/rules/sentence'
import type {
  CopilotAnswer,
  CopilotAskRequest,
  CopilotCadenceKind,
  CopilotPeriodChoice,
  CopilotProposal,
  CopilotProposalChoice,
  CopilotProposalKind,
  CopilotStopped,
  CopilotWeekday,
} from '@/core/models/copilot'
import type { CopilotConversation, CopilotTurn, TurnConfirms } from './conversation'

/**
 * The proposal card (ticket 885, BackOffice spec 3631 S13, S17 to S19; contract 3663/3664) — the pure seam between a
 * `proposed` answer and the card the panel draws. The server writes every line; the panel writes no wording of its own
 * about what is scheduled. An answer with no `proposal` (the switch off) has no card and draws as before.
 *
 * Ticket 887 (BackOffice 3665, spec 3631 S32) adds the `pause` and `delete` kinds: the same card, with no values to
 * edit, only the schedule to stop, named when one matched, picked from up to 4 `choices` when several did.
 */

/** The card's editable values (S17): days, time, title and, when offered, the period choice. */
export interface CardValues {
  title: string
  cadence: { kind: CopilotCadenceKind; days: CopilotWeekday[] | null; day: string | null }
  /** `HH:mm`, Riyadh. */
  time: string
  periodChoice: CopilotPeriodChoice | null
  /** 887, a pause/delete card only: the chosen schedule's id; null until one is picked. */
  choice?: string | null
}

/** A schedule a pause/delete card offers (887), in the screen's language. */
export interface CardChoice {
  id: string
  title: string
  when: string
  paused: boolean
}

export interface ProposalCard {
  id: string
  /** `schedule` (885): the values are edited; `pause`/`delete` (887): a schedule is chosen. */
  kind: CopilotProposalKind
  /** Delete's Confirm is drawn as destructive (887). */
  destructive: boolean
  /** 887: the schedules a pause/delete card offers (1..4); `[]` on a schedule card. */
  choices: CardChoice[]
  /** The proposal's own language: sent back on a confirmation, for the "expired" sentence (3664). */
  lang: 'en' | 'ar'
  /** The screen's direction: the card follows the panel's language. */
  dir: 'ltr' | 'rtl'
  /** The server's lines, in the screen's language, in order. */
  lines: string[]
  /** The values as proposed: the card's defaults. */
  values: CardValues
  /** The period choices to show, labelled in the screen's language; `[]` for a relative period. */
  periodChoices: { key: CopilotPeriodChoice; label: string }[]
}

const WEEKDAYS: readonly CopilotWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const CADENCES: readonly CopilotCadenceKind[] = ['daily', 'weekly', 'monthly']
const PERIODS: readonly CopilotPeriodChoice[] = ['sameLength', 'sameDates']

const isRtl = (lang: string) => lang.toLowerCase().startsWith('ar')

const isStop = (kind: CopilotProposalKind): boolean => kind === 'pause' || kind === 'delete'

/**
 * The card a reply draws, or none: only a `proposed` answer whose `proposal` has an id and is a `schedule`, or a
 * `pause`/`delete` offering at least one schedule (887).
 */
export function proposalCard(reply: Partial<CopilotAnswer> | null | undefined, lang: string): ProposalCard | null {
  if (!reply || reply.outcome !== 'proposed') return null
  const p = reply.proposal as Partial<CopilotProposal> | undefined
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || p.id.trim() === '') return null
  if (p.kind === 'pause' || p.kind === 'delete') return stopCard(p as CopilotProposal, lang)
  if (p.kind !== 'schedule') return null
  const v = (p.values ?? {}) as Partial<CopilotProposal['values']>
  const c = (v.cadence ?? {}) as Partial<CardValues['cadence']>
  const choices = Array.isArray(v.periodChoices) ? v.periodChoices.filter((x) => x && PERIODS.includes(x.key)) : []
  const offered = choices.map((x) => x.key)
  return {
    id: p.id,
    kind: 'schedule',
    destructive: false,
    choices: [],
    lang: v.lang === 'ar' ? 'ar' : 'en',
    dir: isRtl(lang) ? 'rtl' : 'ltr',
    lines: Array.isArray(p.lines) ? p.lines.map((l) => saysIn(l ?? { en: '', ar: '' }, lang)).filter((l) => l.trim() !== '') : [],
    values: {
      title: typeof v.title === 'string' ? v.title : '',
      cadence: {
        kind: CADENCES.includes(c.kind as CopilotCadenceKind) ? (c.kind as CopilotCadenceKind) : 'daily',
        days: Array.isArray(c.days) ? WEEKDAYS.filter((d) => c.days!.includes(d)) : null,
        day: typeof c.day === 'string' ? c.day : null,
      },
      time: typeof v.time === 'string' ? v.time : '07:00',
      periodChoice: v.periodChoice && offered.includes(v.periodChoice) ? v.periodChoice : (offered[0] ?? null),
    },
    periodChoices: choices.map((x) => ({ key: x.key, label: saysIn(x.label, lang) })),
  }
}

/**
 * A pause/delete card (887, 3665): the server's lines (the "- <title>, <when>" lines dropped when several matched, as
 * the choices are drawn as a list instead), the offered schedules, and the choice preset when only one was offered.
 */
function stopCard(p: CopilotProposal, lang: string): ProposalCard | null {
  const offered = (Array.isArray(p.choices) ? p.choices : []).filter(
    (c): c is CopilotProposalChoice => !!c && typeof c.id === 'string' && c.id.trim() !== '',
  )
  if (offered.length === 0) return null
  const choices = offered.map((c) => ({
    id: c.id,
    title: saysIn(c.title ?? { en: '', ar: '' }, lang),
    when: saysIn(c.when ?? { en: '', ar: '' }, lang),
    paused: c.paused === true,
  }))
  const v = (p.values ?? {}) as Partial<CopilotProposal['values']>
  const several = choices.length > 1
  const lines = (Array.isArray(p.lines) ? p.lines : [])
    .filter((l) => !(several && (l?.en ?? '').startsWith('- ')))
    .map((l) => saysIn(l ?? { en: '', ar: '' }, lang))
    .filter((l) => l.trim() !== '')
  const preset = typeof v.choice === 'string' && choices.some((c) => c.id === v.choice) ? v.choice : several ? null : choices[0].id
  return {
    id: p.id,
    kind: p.kind,
    destructive: p.kind === 'delete',
    choices,
    lang: v.lang === 'ar' ? 'ar' : 'en',
    dir: isRtl(lang) ? 'rtl' : 'ltr',
    lines,
    values: {
      title: typeof v.title === 'string' ? v.title : '',
      cadence: { kind: 'daily', days: null, day: null },
      time: typeof v.time === 'string' ? v.time : '',
      periodChoice: null,
      choice: preset,
    },
    periodChoices: [],
  }
}

/**
 * Confirm (S18, 3664): the proposal's id with every value the card holds, and the proposal's own language (read only
 * for the "expired" sentence). The period choice goes only when the card offered one. Not a question: `question` is `''`.
 * A pause/delete card (887, 3665) sends only the chosen schedule, and not even that when the card offered one.
 */
export function confirmationBody(conversationId: string, card: ProposalCard, values: CardValues): CopilotAskRequest {
  if (isStop(card.kind)) {
    const choice = card.choices.length > 1 && values.choice ? { choice: values.choice } : {}
    return { question: '', conversationId, confirmation: { proposalId: card.id, values: choice } }
  }
  const { title, cadence, time, periodChoice } = values
  return {
    question: '',
    conversationId,
    confirmation: {
      proposalId: card.id,
      values: {
        title,
        cadence: { kind: cadence.kind, days: cadence.days, day: cadence.day },
        time,
        ...(card.periodChoices.length > 0 && periodChoice ? { periodChoice } : {}),
        lang: card.lang,
      },
    },
  }
}

/** Cancel (S18, 3664): the proposal's id and a cancel; the server drops the proposal and saves nothing. */
export function cancellationBody(conversationId: string, card: ProposalCard): CopilotAskRequest {
  return { question: '', conversationId, confirmation: { proposalId: card.id, cancel: true } }
}

/**
 * Where a turn's card stands (S18, S19): `open` (Confirm and Cancel live), `sending` (a confirmation of it is out),
 * `confirmed`, `cancelled`, or `expired` — the server answered so, or a newer proposal in the conversation replaced it
 * (the server keeps one). A `not-confirmed` answer or a refusal (`COPILOT-440`) leaves it `open`: the proposal is
 * handed back to be mended. `none`: the turn draws no card.
 */
export type CardState = 'none' | 'open' | 'sending' | 'confirmed' | 'cancelled' | 'expired'

const CLOSING: Partial<Record<string, CardState>> = { confirmed: 'confirmed', cancelled: 'cancelled', expired: 'expired' }

const proposalIdOf = (turn: CopilotTurn | undefined): string | null =>
  turn?.reply?.outcome === 'proposed' && typeof turn.reply.proposal?.id === 'string' ? turn.reply.proposal.id : null

export function cardState(conv: CopilotConversation, index: number, inFlight?: { confirms?: TurnConfirms } | null): CardState {
  const id = proposalIdOf(conv.turns[index])
  if (id === null) return 'none'
  for (const later of conv.turns.slice(index + 1)) {
    if (later.confirms?.proposalId === id) {
      const closed = later.reply ? CLOSING[later.reply.outcome] : undefined
      if (closed) return closed
    } else if (proposalIdOf(later) !== null) return 'expired'
  }
  return inFlight?.confirms?.proposalId === id ? 'sending' : 'open'
}

/** Confirm and Cancel are drawn only on an open card. */
export const cardLive = (state: CardState): boolean => state === 'open' || state === 'sending'

/** A `confirmed` answer's first send and the link to "My schedules" (886), beside the server's sentence; else none. */
export function confirmedNote(reply: Partial<CopilotAnswer> | null | undefined): { firstSendAt: string; href: string } | null {
  if (!reply || reply.outcome !== 'confirmed' || !reply.confirmed || typeof reply.confirmed.firstSendAt !== 'string') return null
  return { firstSendAt: reply.confirmed.firstSendAt, href: MY_SCHEDULES_PATH }
}

/** 887: a confirmed pause/delete's schedule and the link to "My schedules", beside the server's sentence; else none. */
export function stoppedNote(reply: Partial<CopilotAnswer> | null | undefined): { kind: CopilotStopped['kind']; title: string; href: string } | null {
  const s = reply?.outcome === 'confirmed' ? reply.stopped : undefined
  if (!s || (s.kind !== 'pause' && s.kind !== 'delete')) return null
  return { kind: s.kind, title: typeof s.title === 'string' ? s.title : '', href: MY_SCHEDULES_PATH }
}

/**
 * 887: the server's `COPILOT-441` message (no choice, or one the card did not offer), when the latest confirmation of
 * this proposal was refused so; drawn beside the choices while the card stays open. Else null.
 */
export function choiceProblem(conv: CopilotConversation, proposalId: string): string | null {
  const last = [...conv.turns].reverse().find((t) => t.confirms?.proposalId === proposalId)
  if (!last || last.reply || apiErrorCode(last.refusal) !== 'COPILOT-441') return null
  const problems = (apiErrorData(last.refusal) as { problems?: { message?: unknown }[] } | null)?.problems
  const message = Array.isArray(problems) ? problems[0]?.message : undefined
  if (typeof message === 'string' && message.trim() !== '') return message
  return last.refusal instanceof Error ? last.refusal.message : null
}

/** The card switched to another cadence (S17): weekly starts on Monday, monthly on the 1st, unless it already was. */
export function withCadence(values: CardValues, kind: CopilotCadenceKind): CardValues {
  const c = values.cadence
  if (c.kind === kind) return values
  const cadence =
    kind === 'weekly' ? { kind, days: ['mon' as CopilotWeekday], day: null } : kind === 'monthly' ? { kind, days: null, day: '1' } : { kind, days: null, day: null }
  return { ...values, cadence }
}

/** A weekday put on or taken off a weekly card, the days kept in the week's order. */
export function withDay(values: CardValues, day: CopilotWeekday): CardValues {
  const days = values.cadence.days ?? []
  const next = days.includes(day) ? days.filter((d) => d !== day) : WEEKDAYS.filter((d) => d === day || days.includes(d))
  return { ...values, cadence: { kind: 'weekly', days: next, day: null } }
}

/** The weekdays in the week's order, for the card's day chips. */
export const CARD_WEEKDAYS = WEEKDAYS

/** Confirm is offered once the card is whole: a title, an `HH:mm` time, and a day on a weekly or monthly card. The server checks the rest (COPILOT-440). */
export function cardReady(values: CardValues, card?: ProposalCard): boolean {
  // 887: a pause/delete card is ready once one of its own schedules is chosen.
  if (card && isStop(card.kind)) return !!values.choice && card.choices.some((x) => x.id === values.choice)
  const c = values.cadence
  if (values.title.trim() === '' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) return false
  if (c.kind === 'weekly') return (c.days ?? []).length > 0
  if (c.kind === 'monthly') return !!c.day
  return true
}
