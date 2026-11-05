/**
 * The LF return outcome vocabulary, read once (spec 759 F4–F6; BackOffice 3369 §Wire, read 3376).
 *
 * The panel, its attention banner, the Force refund gate and the needing-action queue all read the
 * watch's `outcome` here, so a spelling the server sends cannot read one way on the list and another
 * on the details. Pure: no React, no i18n.
 *
 * The wire (3376, confirmed by 765) spells `nothing-received`; the client's code — which keys the
 * locale — is `nothingReceived`. Both read the same.
 */
import { LF_RETURN_OUTCOMES, type LfReturnOutcome } from '@/core/models/lf-return'

/** An outcome as the client reads it: a known one, or `unknown` for one it has not learned. */
export type LfReturnOutcomeReading = LfReturnOutcome | 'unknown'

/** The spellings that are not the canonical code. */
const ALIASES: Readonly<Record<string, LfReturnOutcome>> = { 'nothing-received': 'nothingReceived' }

/**
 * The outcome code, trimmed, with either spelling of *nothing received* accepted. Anything else —
 * absent, blank, a different case, a code the client has not learned — is `unknown`, never a guess.
 */
export function normaliseLfReturnOutcome(raw: string | null | undefined): LfReturnOutcomeReading {
  const code = (raw ?? '').trim()
  if ((LF_RETURN_OUTCOMES as readonly string[]).includes(code)) return code as LfReturnOutcome
  return Object.hasOwn(ALIASES, code) ? ALIASES[code] : 'unknown'
}

/** The outcomes that need a human — 3369's needing-action set, and nothing else. */
export type NeedingActionOutcome = Extract<LfReturnOutcome, 'unanswered' | 'nothingReceived' | 'short'>
export const NEEDS_ACTION_OUTCOMES: ReadonlySet<NeedingActionOutcome> = new Set(['unanswered', 'nothingReceived', 'short'])
/** The outcomes a force can still settle — open, or stuck (the needing-action set). */
export const FORCEABLE_OUTCOMES: ReadonlySet<LfReturnOutcome> = new Set(['open', ...NEEDS_ACTION_OUTCOMES])
/** Already settled: 3375 refuses a force on either. */
export const SETTLED_OUTCOMES: ReadonlySet<LfReturnOutcome> = new Set(['refunded', 'forced'])

const member = (set: ReadonlySet<string>, o: LfReturnOutcomeReading): boolean => o !== 'unknown' && set.has(o)

export const needsAction = (o: LfReturnOutcomeReading): o is NeedingActionOutcome => member(NEEDS_ACTION_OUTCOMES, o)
export const isForceable = (o: LfReturnOutcomeReading): o is LfReturnOutcome => member(FORCEABLE_OUTCOMES, o)
export const isSettled = (o: LfReturnOutcomeReading): o is LfReturnOutcome => member(SETTLED_OUTCOMES, o)
