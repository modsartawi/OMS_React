import type { Param } from '@/core/models/analytics'
import { streamProgress, type StreamWave } from './board'
import type { ParamNotice } from './BoardPanel'

/**
 * What a page folds up from its panels (board 771/823; report 827): which panels are fetching — the strip's
 * "Updating… n of N" wave — and each panel's word on the parameters, for the strip's fallback and 412 notices.
 */

/** Which panels are fetching, folded into the strip's wave as each one starts and lands. */
export function streamReducer(state: { fetching: ReadonlySet<string>; wave: StreamWave }, [id, on]: [string, boolean]) {
  if (state.fetching.has(id) === on) return state
  const fetching = new Set(state.fetching)
  if (on) fetching.add(id)
  else fetching.delete(id)
  return { fetching, wave: streamProgress(state.wave, [...fetching]) }
}

/** Each panel's word on the parameters (823), kept by panel; unchanged words keep the same map. */
export function noticeReducer(state: ReadonlyMap<string, ParamNotice>, [id, notice]: [string, ParamNotice]) {
  const was = state.get(id)
  if (was && was.invalid === notice.invalid && was.fellBack.join(' ') === notice.fellBack.join(' ')) return state
  const next = new Map(state)
  next.set(id, notice)
  return next
}

/** The strip's two lists: the parameters that fell back (the link's own, and any panel's), and those a 412 named. */
export function stripNotices(params: readonly Param[], linkFellBack: readonly string[], notices: ReadonlyMap<string, ParamNotice>): { fellBack: string[]; invalid: string[] } {
  const answered = [...notices.values()]
  const fellBack = [...new Set([...linkFellBack, ...answered.flatMap((n) => n.fellBack)])].filter((n) => params.some((p) => p.name === n))
  const invalid = [...new Set(answered.map((n) => n.invalid).filter((n): n is string => !!n))]
  return { fellBack, invalid }
}
