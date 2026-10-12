import { create } from 'zustand'
import { useSession } from '@/core/session'

/** The Replay page's route: the drawer's Replay… and the console nav both open it. */
export const REPLAY_PATH = '/admin/sync/replay'

/**
 * The Replay page's **draft** (spec 470, ticket 474): the receipt JSON in its box, and the
 * receipt it was brought from by the receipt drawer's Replay… (`null` when the tester
 * pasted their own). The drawer hands the JSON over here, in memory, because the Replay
 * page is a page of the same console: no history state, no storage, no URL.
 *
 * 🚩 Privacy: a snapshot carries customer, loyalty and tender data. This store lives in the
 * module only — no `persist` middleware, nothing written anywhere — so it survives moving
 * between the console's pages and a reload empties it. A push leaves it as it is, so the
 * tester can replay the same JSON again. The session ending (sign-out, a 401, another
 * user) empties it too: a sign-out is no reload.
 */
export interface ReplaySource {
  storeCode: string
  receiptNumber: string
}

interface ReplayDraftState {
  text: string
  source: ReplaySource | null
  /** The tester typed or pasted in the box: the text changes, the source is kept to be compared. */
  edit: (text: string) => void
  /** The whole draft replaced: by the drawer's Replay…, with the receipt it came from. */
  replace: (text: string, source: ReplaySource | null) => void
  clear: () => void
}

export const useReplayDraft = create<ReplayDraftState>((set) => ({
  text: '',
  source: null,
  edit: (text) => set({ text }),
  replace: (text, source) => set({ text, source }),
  clear: () => set({ text: '', source: null }),
}))

useSession.subscribe((now, before) => {
  if (now.userId !== before.userId) useReplayDraft.getState().clear()
})

/**
 * The source the page names ("Brought from receipt …"): only while the JSON in the box is
 * still that receipt (its preflight's source receipt). A paste of another receipt, an
 * emptied box or JSON that no longer reads names nothing.
 */
export function shownSource(source: ReplaySource | null, sourceReceiptNumber: string | null | undefined): ReplaySource | null {
  return source !== null && sourceReceiptNumber === source.receiptNumber ? source : null
}
