/**
 * What stands under the plans (ticket 962, BackOffice spec 4354 §3; 4281 decisions 24, 29, 50): each goal with no plan
 * and each hidden plan, with its reason, and the run's ending. Pure.
 *
 * A goal with no plan carries the server's sentence (one of its three). A hidden plan's sentence is the screen's,
 * written from its code. Both lists follow the fixed order of the five goals.
 */
import { PLAN_GOALS, type AdviseMissingLine, type AdvisePlan, type AdviseReply, type Bilingual, type PlanGoal, type SolveEnding } from '@/core/models/sourcing-run'

export interface NoPlanNote {
  goal: PlanGoal
  code: string
  sentence: Bilingual
}

export interface HiddenPlanNote {
  goal: PlanGoal
  code: string
  as: PlanGoal | null
  minutesApart: number | null
  riyalsApart: number | null
  /** With `allPlans`, the plan itself; null when the reply did not send it. */
  plan: AdvisePlan | null
}

export interface MissingLineNote {
  lineNo: number
  code: string
  sentence: Bilingual
}

export interface PlanNotes {
  ending: SolveEnding
  /** The simple plan stood in: the page raises a banner. */
  fallbackAnswered: boolean
  /** What failed in the search, as the server wrote it (for developers; shown as data). */
  why: string | null
  noPlan: NoPlanNote[]
  hidden: HiddenPlanNote[]
  /** On "no plan possible": a reason for every line. */
  missingLines: MissingLineNote[]
}

const goalRank = (g: string) => {
  const i = (PLAN_GOALS as readonly string[]).indexOf(g)
  return i < 0 ? PLAN_GOALS.length : i
}
const byGoal = <T extends { goal: string }>(xs: readonly T[]) => [...xs].sort((a, b) => goalRank(a.goal) - goalRank(b.goal))
const sentence = (x: Bilingual): Bilingual => ({ en: x.en, ar: x.ar })
const missing = (m: AdviseMissingLine): MissingLineNote => ({ lineNo: m.lineNo, code: m.code, sentence: sentence(m) })

export function planNotes(reply: Pick<AdviseReply, 'solve' | 'plans' | 'noPlan' | 'hiddenPlans' | 'missingLines'>): PlanNotes {
  return {
    ending: reply.solve.ending,
    fallbackAnswered: reply.solve.ending === 'FALLBACK_ANSWERED' || reply.plans.some((p) => p.fallback),
    why: reply.solve.why || null,
    noPlan: byGoal(reply.noPlan ?? []).map((n) => ({ goal: n.goal, code: n.code, sentence: sentence(n) })),
    hidden: byGoal(reply.hiddenPlans ?? []).map((h) => ({
      goal: h.goal,
      code: h.code,
      as: h.as ?? null,
      minutesApart: h.minutesApart ?? null,
      riyalsApart: h.riyalsApart ?? null,
      plan: h.plan ?? null,
    })),
    missingLines: (reply.missingLines ?? []).map(missing),
  }
}
