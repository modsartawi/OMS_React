import type { GuardAnswer, GuardAnswerBody, GuardFired, GuardReasonCode, GuardReasons, OrderGuards } from './guard-check'

// The guard dialog's rules (oms ticket 616, brief "Guard check" C10). Pure: no React, no `t`.
//
// - REFUSE → the line can only be removed or changed on the order (then checked again);
// - WARN → ticked ("I have checked") → `ack: true`;
// - OVERRIDE → the triad: intervention + outcome + reason (where the rule asks one) + an optional note,
//   and only with `INS_GUARD`; without it the line, too, can only be removed or changed;
// - a rule an HQ exception passed needs nothing.

/** What a fired rule asks of the user. */
export type GuardNeed = 'refuse' | 'override' | 'warn' | 'exception'

/** Why a fired rule is not answered yet, or `null` when it is (or needs nothing). */
export type GuardItemProblem =
  | 'remove'
  | 'noGrant'
  | 'interventionMissing'
  | 'outcomeMissing'
  | 'reasonMissing'
  | 'reasonCapped'
  | 'ackMissing'

/** What the user has picked for one fired rule, before it is sent. */
export interface GuardAnswerDraft {
  ack?: boolean
  intervention?: string
  outcome?: string
  reason?: string
  note?: string
}

/** Drafts by {@link guardKey}. */
export type GuardDrafts = Record<string, GuardAnswerDraft>

export const guardKey = (line: number, ruleId: string): string => `${line}:${ruleId}`

export interface GuardItem {
  key: string
  line: number
  fired: GuardFired
  need: GuardNeed
  /** Whether this OVERRIDE asks a reason (its rule is in `accepts`). */
  asksReason: boolean
  problem: GuardItemProblem | null
}

export interface GuardAnswerForm {
  items: GuardItem[]
  /** How many items still stand in the way. */
  open: number
  /** True when nothing stands in the way and there is something to send. */
  ready: boolean
  body: GuardAnswerBody | null
}

const activeCode = (codes: readonly GuardReasonCode[] | undefined, code: string | undefined): boolean =>
  !!code && (codes ?? []).some((c) => c.code === code && c.active)

const acceptedReasons = (reasons: GuardReasons | null, ruleId: string): string[] => reasons?.accepts?.[ruleId] ?? []

function needOf(outcome: string, fired: GuardFired): GuardNeed {
  if (outcome === 'exception' || (fired.exceptionId ?? '') !== '') return 'exception'
  if (fired.severity === 'REFUSE') return 'refuse'
  if (fired.severity === 'OVERRIDE') return 'override'
  return 'warn'
}

/** Check every fired rule of the order's last guard check against what has been picked. */
export function guardAnswer(input: {
  guards: OrderGuards
  reasons: GuardReasons | null
  drafts: GuardDrafts
  user: string
  /** The `INS_GUARD` grant. */
  canOverride: boolean
}): GuardAnswerForm {
  const { guards, reasons, drafts, user, canOverride } = input
  const capsUsed: Record<string, number> = {}
  const items: GuardItem[] = []
  const answers: GuardAnswer[] = []

  for (const l of guards.lines) {
    for (const fired of l.fired) {
      const key = guardKey(l.line, fired.ruleId)
      const need = needOf(l.outcome, fired)
      const draft = drafts[key] ?? {}
      const accepts = acceptedReasons(reasons, fired.ruleId)
      const asksReason = need === 'override' && accepts.length > 0
      let problem: GuardItemProblem | null = null

      if (need === 'refuse') problem = 'remove'
      else if (need === 'warn') {
        if (draft.ack === true) answers.push({ line: l.line, ruleId: fired.ruleId, ack: true })
        else problem = 'ackMissing'
      } else if (need === 'override') {
        if (!canOverride) problem = 'noGrant'
        else if (!activeCode(reasons?.intervention, draft.intervention)) problem = 'interventionMissing'
        else if (!activeCode(reasons?.outcome, draft.outcome)) problem = 'outcomeMissing'
        else if (asksReason && !(activeCode(reasons?.reason, draft.reason) && accepts.includes(draft.reason!)))
          problem = 'reasonMissing'
        else if (asksReason && overCap(reasons, draft.reason!, capsUsed)) problem = 'reasonCapped'
        else {
          const note = (draft.note ?? '').trim()
          answers.push({
            line: l.line,
            ruleId: fired.ruleId,
            intervention: draft.intervention,
            outcome: draft.outcome,
            ...(asksReason ? { reason: draft.reason } : {}),
            ...(note !== '' ? { note } : {}),
          })
        }
      }
      items.push({ key, line: l.line, fired, need, asksReason, problem })
    }
  }

  const open = items.filter((i) => i.problem !== null).length
  const ready = open === 0 && answers.length > 0
  return { items, open, ready, body: ready ? { lineHash: guards.lineHash, user, answers } : null }
}

/** Counts a use of a capped reason; true when this use is past its cap. */
function overCap(reasons: GuardReasons | null, code: string, used: Record<string, number>): boolean {
  const cap = reasons?.caps?.[code]
  if (cap === undefined) return false
  used[code] = (used[code] ?? 0) + 1
  return used[code] > cap
}

export interface ReasonChoice {
  code: string
  en: string
  ar: string
  disabled: boolean
}

/**
 * The reasons offered to one OVERRIDE: the active codes its rule accepts. A capped code is greyed once
 * the other lines' picks have used it up; the line that already holds it may keep it.
 */
export function reasonChoices(
  reasons: GuardReasons | null,
  ruleId: string,
  drafts: GuardDrafts,
  key: string,
): ReasonChoice[] {
  const accepts = acceptedReasons(reasons, ruleId)
  const own = drafts[key]?.reason
  return (reasons?.reason ?? [])
    .filter((c) => c.active && accepts.includes(c.code))
    .map((c) => {
      const cap = reasons?.caps?.[c.code]
      const usedByOthers = Object.entries(drafts).filter(([k, d]) => k !== key && d.reason === c.code).length
      const disabled = own !== c.code && cap !== undefined && usedByOthers >= cap
      return { code: c.code, en: c.en, ar: c.ar, disabled }
    })
}
