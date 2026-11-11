/**
 * The doors of "What the copilot knows about me" (ticket 894, BackOffice 3689), apart from `./api` so the panel's
 * chunk carries only the probe. Through `@/core/api` like every call (`.claude/rules/api-envelope.md`): a refusal
 * (`COPILOT-401` no grant, `COPILOT-430` the switch off or a value not allowed, `COPILOT-433` a set edit or a lookup
 * refused) arrives as a business `ApiError`, read with `apiErrorCode` / `apiErrorMessage`.
 *
 * Every change redraws the page from the door's own answer, then asks for the page afresh (R29: the server caches
 * nothing, so what is drawn is what the next question uses).
 */
import type { QueryClient } from '@tanstack/react-query'
import { api, apiErrorCode } from '@/core/api'
import type {
  CopilotDeleted,
  CopilotEditSetRequest,
  CopilotForgotten,
  CopilotKeptReading,
  CopilotKnowsMe,
  CopilotMeLookup,
  CopilotNamedSet,
  CopilotOwnReadingKind,
  CopilotSetMember,
} from '@/core/models/copilot'
import { fromMeWire, memberOf, readingOf, setOf, withPage, type MePage } from './me'

export const COPILOT_ME_KEY = ['copilot', 'me'] as const

/** No grant (`[Copilot, 01]`). */
export const ME_NO_GRANT = 'COPILOT-401'
/** Own readings are off: the page and its entry are hidden. */
export const ME_FEATURE_OFF = 'COPILOT-430'
/** A set edit or a lookup the server refused: its message is shown. */
export const ME_REFUSED = 'COPILOT-433'

/** A 430 on `GET Copilot/Me` is "feature off" (3689: the access probe does not say). */
export const meFeatureOff = (err: unknown): boolean => apiErrorCode(err) === ME_FEATURE_OFF

/** The panel's entry shows only when the page could be read: off, no grant, failed or pending all hide it. */
export const meEntryVisible = (q: { isSuccess: boolean }): boolean => q.isSuccess === true

/** The one query the panel's entry and the page share, so opening the page costs no second call. */
export function meQuery() {
  return { queryKey: COPILOT_ME_KEY, queryFn: () => copilotMeApi.me(), retry: false, staleTime: 0 } as const
}

export const copilotMeApi = {
  /** `GET Copilot/Me` → the page. */
  async me(): Promise<MePage> {
    return fromMeWire(await api.get<CopilotKnowsMe>('Copilot/Me'))
  },
  /** `POST Copilot/Me/Readings` `{ kind, value }` → the reading as kept (`keptBy: "page"`). */
  async keepReading(kind: CopilotOwnReadingKind, value: string): Promise<CopilotKeptReading | null> {
    return readingOf(await api.post<CopilotKeptReading>('Copilot/Me/Readings', { kind, value }))
  },
  /** `POST Copilot/Me/Readings/Delete` `{ kind }`. */
  deleteReading(kind: CopilotOwnReadingKind): Promise<CopilotDeleted> {
    return api.post<CopilotDeleted>('Copilot/Me/Readings/Delete', { kind })
  },
  /** `GET Copilot/Me/Lookup?text=` → the matches, best first. */
  async lookup(text: string): Promise<CopilotSetMember[]> {
    const r = await api.get<CopilotMeLookup>('Copilot/Me/Lookup', { text })
    return (Array.isArray(r?.matches) ? r.matches : []).map(memberOf).filter((m): m is CopilotSetMember => m !== null)
  },
  /** `POST Copilot/Me/Sets` `{ setId, members }` → the set, its members replaced in that order. */
  async editSet(body: CopilotEditSetRequest): Promise<CopilotNamedSet | null> {
    return setOf(await api.post<CopilotNamedSet>('Copilot/Me/Sets', body))
  },
  /** `POST Copilot/Me/Sets/Delete` `{ setId }`. */
  deleteSet(setId: string): Promise<CopilotDeleted> {
    return api.post<CopilotDeleted>('Copilot/Me/Sets/Delete', { setId })
  },
  /** `POST Copilot/Me/Forget` (no body) → how many readings and sets went. */
  forget(): Promise<CopilotForgotten> {
    return api.post<CopilotForgotten>('Copilot/Me/Forget', undefined)
  },
}

/**
 * The page's changes: each calls its door, redraws the cached page from the answer, and asks for it afresh. A refusal
 * throws before anything is redrawn, so the page stays as the server has it.
 */
export function meActions(qc: QueryClient) {
  const redraw = (change: (p: MePage) => MePage) => {
    qc.setQueryData<MePage>(COPILOT_ME_KEY, (p) => (p ? change(p) : p))
    void qc.invalidateQueries({ queryKey: COPILOT_ME_KEY, exact: true })
  }
  return {
    async changeReading(kind: CopilotOwnReadingKind, value: string): Promise<void> {
      const kept = await copilotMeApi.keepReading(kind, value)
      redraw((p) => withPage(p, { readings: [...p.readings.filter((r) => r.kind !== kind), ...(kept ? [kept] : [])] }))
    },
    async deleteReading(kind: CopilotOwnReadingKind): Promise<void> {
      // `deleted: false` is "already gone": either way it is not kept.
      await copilotMeApi.deleteReading(kind)
      redraw((p) => withPage(p, { readings: p.readings.filter((r) => r.kind !== kind) }))
    },
    async editSet(body: CopilotEditSetRequest): Promise<void> {
      const set = await copilotMeApi.editSet(body)
      redraw((p) => withPage(p, { sets: p.sets.map((s) => (s.setId === body.setId && set ? set : s)) }))
    },
    async deleteSet(setId: string): Promise<void> {
      await copilotMeApi.deleteSet(setId)
      redraw((p) => withPage(p, { sets: p.sets.filter((s) => s.setId !== setId) }))
    },
    /** Returns how many went. */
    async forget(): Promise<number> {
      const r = await copilotMeApi.forget()
      redraw((p) => withPage(p, { readings: [], sets: [] }))
      return typeof r?.removed === 'number' ? r.removed : 0
    },
  }
}
